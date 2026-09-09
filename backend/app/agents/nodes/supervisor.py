"""
Supervisor Agent.

Routes each auditable unit to the relevant specialist sub-agent(s) based on
content signals. A single unit can be routed to multiple specialists if it
trips multiple signal types.
"""
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_vertexai import ChatVertexAI
from pydantic import BaseModel, Field

from app.agents.state import GraphState, RoutingDecision
from app.cache.redis_client import write_agent_status
from app.core.config import get_settings
from app.models.schemas import SpecialistType

ROUTING_SYSTEM_PROMPT = """You are the routing supervisor for a content risk \
audit pipeline. Given one scene/unit of a script, decide which specialist \
reviewers should examine it:

- cultural_sensitivity: jokes, stereotypes, or references tied to \
  nationality, ethnicity, religion, gender, disability, or other identity.
- defamation_real_person: a named or clearly identifiable real person, or a \
  character whose name/profession/biography could resemble one.
- ip_plot_similarity: a distinctive plot device, premise, or scene structure \
  that might mirror an existing copyrighted work.
- trademark_brand_risk: a real, identifiable brand, product, or trademark \
  used in a way that could be damaging or imply endorsement.
- historical_misrepresentation: content presented as biographical, \
  historical, or "based on a true story" that depicts a real person or \
  event in a way that may be fabricated or materially distorted.

Return only the specialists that are plausibly relevant. A unit with no \
signal for any specialist should get an empty list -- that is a valid, \
expected answer, not a fallback to avoid."""


class RoutingResult(BaseModel):
    """Structured output contract for one unit's routing decision."""

    specialists: list[SpecialistType] = Field(
        default_factory=list,
        description="Zero or more specialists that should review this unit.",
    )


async def supervisor_node(state: GraphState) -> dict:
    run_id = state["run_id"]
    write_agent_status(str(run_id), "supervisor", "running")

    settings = get_settings()
    # Same quota hardening as the specialists: 429 RESOURCE_EXHAUSTED is
    # transient, and the routing call is a single point of failure for the
    # whole run, so give it more retry headroom than the SDK default of 6.
    llm = ChatVertexAI(
        model=settings.gemini_model,
        project=settings.google_cloud_project,
        location=settings.vertex_location,
        max_retries=10,
        thinking_budget=settings.gemini_thinking_budget,
    )
    router = llm.with_structured_output(RoutingResult)

    routing: list[RoutingDecision] = []
    for unit in state["units"]:
        result: RoutingResult = await router.ainvoke(
            [
                SystemMessage(content=ROUTING_SYSTEM_PROMPT),
                HumanMessage(content=unit.text),
            ]
        )
        routing.append({"unit_id": unit.id, "specialists": result.specialists})

    write_agent_status(str(run_id), "supervisor", "done", output_count=len(routing))
    return {"routing": routing}
