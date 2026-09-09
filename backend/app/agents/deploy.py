"""
Deploys the compiled LangGraph graph onto the Gemini Enterprise Agent
Platform via Vertex AI's `agent_engines.LanggraphAgent`.

This is the integration point that satisfies the hackathon's mandatory
Gemini/Agent Builder requirement -- the graph itself (graph.py) is plain
LangGraph and can also just be invoked in-process (see app/api/routes/runs.py)
for local dev without a live deployment.

Usage:
    python -m app.agents.deploy
"""
import vertexai
from vertexai.preview import reasoning_engines
from vertexai.preview.reasoning_engines import LanggraphAgent

from app.agents.graph import build_graph
from app.core.config import get_settings


def deploy() -> str:
    settings = get_settings()
    vertexai.init(project=settings.google_cloud_project, location=settings.google_cloud_location)

    agent = LanggraphAgent(
        model=settings.gemini_model,
        graph=build_graph,
        # TODO: set runnable_kwargs / checkpointer as needed once persistence
        # for long-running / resumable runs is wired up.
    )

    remote_agent = reasoning_engines.ReasoningEngine.create(
        agent,
        requirements=["-r requirements.txt"],
        display_name="cinerisk-audit-agent",
    )
    return remote_agent.resource_name


if __name__ == "__main__":
    print(deploy())
