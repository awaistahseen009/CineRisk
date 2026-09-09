"""
Builds the LangGraph StateGraph for the full CineRisk pipeline:

    Intake -> Supervisor -> {Cultural Sensitivity, Defamation, IP Similarity,
                              Trademark & Brand Risk, Historical Misrepresentation}
           (fan-out, run concurrently) -> Aggregator

This graph is what gets deployed onto the Gemini Enterprise Agent Platform
via `agent_engines.LanggraphAgent` (see deploy.py).
"""
from langgraph.graph import END, START, StateGraph

from app.agents.nodes.aggregator import aggregator_node
from app.agents.nodes.cultural_sensitivity import cultural_sensitivity_node
from app.agents.nodes.defamation import defamation_node
from app.agents.nodes.historical_misrepresentation import historical_misrepresentation_node
from app.agents.nodes.intake import intake_node
from app.agents.nodes.ip_similarity import ip_similarity_node
from app.agents.nodes.supervisor import supervisor_node
from app.agents.nodes.trademark_brand import trademark_brand_node
from app.agents.state import GraphState
from app.models.schemas import SpecialistType

SPECIALIST_NODE_NAMES = {
    SpecialistType.CULTURAL_SENSITIVITY: "cultural_sensitivity",
    SpecialistType.DEFAMATION_REAL_PERSON: "defamation",
    SpecialistType.IP_PLOT_SIMILARITY: "ip_similarity",
    SpecialistType.TRADEMARK_BRAND_RISK: "trademark_brand",
    SpecialistType.HISTORICAL_MISREPRESENTATION: "historical_misrepresentation",
}


def _route_to_specialists(state: GraphState) -> list[str]:
    """Conditional edge out of the supervisor: fan out to every specialist
    that was assigned at least one unit. A unit can hit multiple specialists,
    so this is a set union across all routing decisions, not a per-unit
    switch -- each specialist node itself filters down to the units routed
    to it.
    """
    routed_specialists = {s for r in state["routing"] for s in r["specialists"]}
    targets = [SPECIALIST_NODE_NAMES[s] for s in routed_specialists]
    return targets or ["aggregator"]  # nothing routed -> skip straight to aggregation


def build_graph():
    graph = StateGraph(GraphState)

    graph.add_node("intake", intake_node)
    graph.add_node("supervisor", supervisor_node)
    graph.add_node("cultural_sensitivity", cultural_sensitivity_node)
    graph.add_node("defamation", defamation_node)
    graph.add_node("ip_similarity", ip_similarity_node)
    graph.add_node("trademark_brand", trademark_brand_node)
    graph.add_node("historical_misrepresentation", historical_misrepresentation_node)
    graph.add_node("aggregator", aggregator_node)

    graph.add_edge(START, "intake")
    graph.add_edge("intake", "supervisor")

    specialist_node_list = list(SPECIALIST_NODE_NAMES.values())
    graph.add_conditional_edges(
        "supervisor",
        _route_to_specialists,
        [*specialist_node_list, "aggregator"],
    )

    # Every specialist (whichever ran) funnels into the aggregator once done.
    for node_name in specialist_node_list:
        graph.add_edge(node_name, "aggregator")

    graph.add_edge("aggregator", END)

    return graph.compile()


cinerisk_graph = build_graph()
