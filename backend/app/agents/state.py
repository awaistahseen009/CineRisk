"""Shared LangGraph state, accumulated across Intake -> Supervisor ->
Specialists -> Aggregator."""
import operator
from typing import Annotated, TypedDict
from uuid import UUID

from app.models.schemas import AuditableUnit, RiskFlag, SpecialistType


class RoutingDecision(TypedDict):
    unit_id: UUID
    specialists: list[SpecialistType]


class GraphState(TypedDict):
    run_id: UUID
    source_document_name: str
    raw_text: str

    # Per-run opt-ins to Parallel Task API escalation, set from the upload
    # form so a user can trade wall-clock time for stronger grounding on a
    # given run without an env change and a restart. Two independent tiers:
    # deep_verification uses the fast `core` processor, deep_research uses
    # the much slower `pro`/`ultra` family (Parallel's "Deep Research" mode
    # -- see ENABLE_DEEP_RESEARCH in config.py). If both are set, deep
    # research wins, since it strictly subsumes what deep verification does.
    deep_verification: bool
    deep_research: bool
    # Severities eligible for escalation on this run, chosen in the
    # upload form's advanced settings. Empty list means fall back to the
    # tier's built-in default.
    escalation_severities: list[str]

    # Set by Intake Agent
    units: list[AuditableUnit]

    # Set by Supervisor Agent
    routing: list[RoutingDecision]

    # Appended to by each specialist node running in parallel; `operator.add`
    # lets LangGraph merge concurrent branch writes into one list.
    flags: Annotated[list[RiskFlag], operator.add]

    # Set by Aggregator Agent
    report_ready: bool
