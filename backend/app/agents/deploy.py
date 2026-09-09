"""Deploys the compiled CineRisk LangGraph graph onto Vertex AI Agent Engine
(the Gemini Enterprise Agent Runtime) via `agent_engines.LanggraphAgent`.

Run it from the `backend/` directory so that `extra_packages=["app"]`
resolves:

    python -m app.agents.deploy            # deploy a new engine
    python -m app.agents.deploy --list     # list engines already deployed

Notes on why this file looks the way it does, since the obvious version of
it does not work:

* `LanggraphAgent.__init__` takes no `graph` argument. It builds its own
  default ReAct runnable unless you hand it a `runnable_builder`, which is
  called as `runnable_builder(model=..., tools=..., checkpointer=...,
  model_tool_kwargs=..., runnable_kwargs=...)`. Our graph is a fixed
  supervisor pipeline rather than a tool-calling ReAct loop, so the builder
  ignores those arguments and returns our own compiled graph.
* Agent Engine is a REGIONAL service, so deployment is pinned to
  us-central1. That is a separate axis from the Vertex endpoint the Gemini
  calls inside the nodes use, which stays "global" for its much larger
  quota headroom. Agent Engine reserves GOOGLE_CLOUD_LOCATION and injects
  its own region, so that preference travels as CINERISK_VERTEX_LOCATION
  instead (see Settings.vertex_location).
* `requirements` must be real pip specifiers. A "-r requirements.txt" entry
  is not resolved by the packaging step and fails the remote build.
* The engine runs as the same service account as the Cloud Run backend, so
  the Secret Manager references below resolve with the grants Terraform
  already created.
"""
import argparse

import vertexai
from google.cloud.aiplatform_v1.types import SecretRef
from vertexai import agent_engines

from app.core.config import get_settings

# Agent Engine is regional and does not accept "global".
AGENT_ENGINE_LOCATION = "us-central1"

DISPLAY_NAME = "cinerisk-audit-agent"

# Only what the graph itself transitively imports. The FastAPI layer, the
# PDF exporter, and the document extractors are deliberately excluded: they
# are not reachable from build_graph() and every extra dependency is another
# way for the remote build to fail.
AGENT_REQUIREMENTS = [
    "google-cloud-aiplatform[agent_engines,langchain]>=1.70",
    "langgraph>=0.2",
    "langchain-core>=0.3",
    "langchain-google-vertexai>=2.0",
    "parallel-web>=1.0.1",
    "pydantic>=2.8",
    "pydantic-settings>=2.4",
    "sqlmodel>=0.0.22",
    "psycopg[binary]>=3.2",
    "upstash-redis>=1.1",
    "httpx>=0.27",
    "cloudpickle>=3.0",
]


def build_cinerisk_runnable(
    *,
    model=None,
    tools=None,
    checkpointer=None,
    model_tool_kwargs=None,
    runnable_kwargs=None,
):
    """Runnable builder handed to LanggraphAgent.

    LanggraphAgent calls this with its own model/tools/checkpointer; CineRisk
    is a fixed supervisor graph whose nodes construct their own ChatVertexAI
    clients, so those arguments are accepted and ignored. Imported lazily so
    that pickling this function does not drag the graph in with it.
    """
    from app.agents.graph import build_graph

    return build_graph()


def _secret(secret_id: str) -> SecretRef:
    return SecretRef(secret=secret_id, version="latest")


def deploy() -> str:
    settings = get_settings()
    project = settings.google_cloud_project
    staging_bucket = f"gs://{project}-agent-staging"

    vertexai.init(
        project=project,
        location=AGENT_ENGINE_LOCATION,
        staging_bucket=staging_bucket,
    )

    agent = agent_engines.LanggraphAgent(
        model=settings.gemini_model,
        runnable_builder=build_cinerisk_runnable,
    )

    remote_agent = agent_engines.create(
        agent,
        display_name=DISPLAY_NAME,
        description=(
            "CineRisk pre-release content risk audit: intake, supervisor "
            "routing, five concurrent risk specialists grounded through "
            "Parallel, and an aggregator."
        ),
        requirements=AGENT_REQUIREMENTS,
        extra_packages=["app"],
        service_account=f"cinerisk-backend@{project}.iam.gserviceaccount.com",
        env_vars={
            # GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION are RESERVED by
            # Agent Engine and rejected with FAILED_PRECONDITION if passed;
            # the runtime injects both itself. Its injected location is this
            # engine's region, so CINERISK_VERTEX_LOCATION is what keeps the
            # Gemini calls on the global endpoint (see config.py).
            "CINERISK_VERTEX_LOCATION": settings.google_cloud_location,
            "GEMINI_MODEL": settings.gemini_model,
            "UPSTASH_REDIS_REST_URL": settings.upstash_redis_rest_url,
            "PARALLEL_API_KEY": _secret("parallel-api-key"),
            "DATABASE_URL": _secret("database-url"),
            "UPSTASH_REDIS_REST_TOKEN": _secret("upstash-redis-rest-token"),
        },
        min_instances=0,
        max_instances=1,
    )
    return remote_agent.resource_name


def list_engines() -> list[str]:
    settings = get_settings()
    vertexai.init(project=settings.google_cloud_project, location=AGENT_ENGINE_LOCATION)
    return [f"{e.resource_name}  ({e.display_name})" for e in agent_engines.list()]


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CineRisk Agent Engine deployment.")
    parser.add_argument("--list", action="store_true", help="List deployed engines and exit.")
    args = parser.parse_args()

    if args.list:
        engines = list_engines()
        print("\n".join(engines) if engines else "(no engines deployed)")
    else:
        print(deploy())
