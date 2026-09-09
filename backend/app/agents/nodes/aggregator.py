"""
Aggregator/Report Agent.

Collects all specialist findings per auditable unit, deduplicates
overlapping flags, and marks clean units as explicitly reviewed-and-clear
(Feature 8) so the final report proves full coverage rather than silently
omitting checked-and-clean sections. Persists the result so GET
/api/runs/{run_id}/report can serve it back afterwards.
"""
from datetime import datetime

from sqlmodel import Session

from app.agents.state import GraphState
from app.cache.redis_client import write_agent_status
from app.db.session import get_engine
from app.models.db import Flag as FlagRow
from app.models.db import Run as RunRow
from app.models.db import Unit as UnitRow
from app.models.schemas import AuditReport, RiskFlag, RunStatusState, UnitReport, UnitReviewStatus


def aggregator_node(state: GraphState) -> dict:
    run_id = state["run_id"]
    write_agent_status(str(run_id), "aggregator", "running")

    routing_by_unit = {r["unit_id"]: r["specialists"] for r in state["routing"]}
    flags_by_unit: dict = {}
    for flag in state["flags"]:
        flags_by_unit.setdefault(flag.unit_id, []).append(flag)

    unit_reports = [
        UnitReport(
            unit=unit,
            specialists_consulted=routing_by_unit.get(unit.id, []),
            status=(
                UnitReviewStatus.FLAGGED
                if flags_by_unit.get(unit.id)
                else UnitReviewStatus.CLEAR
            ),
            flags=_deduplicate(flags_by_unit.get(unit.id, [])),
        )
        for unit in state["units"]
    ]

    report = AuditReport(
        run_id=run_id,
        source_document_name=state["source_document_name"],
        units=unit_reports,
    )

    _persist_report(run_id, unit_reports)

    write_agent_status(
        str(run_id),
        "aggregator",
        "done",
        output_count=report.total_flags,
        sources=_run_wide_sources(unit_reports),
    )
    return {"report_ready": True}


def _run_wide_sources(unit_reports: list[UnitReport], cap: int = 8) -> list[dict]:
    """Dedup real grounding sources across the whole, deduplicated report --
    what the Aggregator's own info affordance shows: the evidence base the
    final report actually rests on."""
    seen: dict[str, dict] = {}
    for unit_report in unit_reports:
        for flag in unit_report.flags:
            for source in flag.sources:
                seen.setdefault(str(source.source_url), source.model_dump(mode="json"))
    return list(seen.values())[:cap]


def _persist_report(run_id, unit_reports: list[UnitReport]) -> None:
    with Session(get_engine()) as session:
        run_row = session.get(RunRow, run_id)
        if run_row is not None:
            run_row.status = RunStatusState.COMPLETE
            run_row.total_units = len(unit_reports)
            run_row.units_complete = len(unit_reports)
            # Stamped so the finished report can state how long the audit
            # actually took -- which matters a lot more now that a run can
            # opt into Task API deep verification and take minutes longer.
            run_row.updated_at = datetime.utcnow()
            session.add(run_row)

        for unit_report in unit_reports:
            unit = unit_report.unit
            session.add(
                UnitRow(
                    id=unit.id,
                    run_id=unit.run_id,
                    index=unit.index,
                    text=unit.text,
                    scene_number=unit.scene_number,
                    page_range=unit.page_range,
                    line_range=unit.line_range,
                    unit_type=unit.unit_type,
                    status=unit_report.status.value,
                    specialists_consulted=[s.value for s in unit_report.specialists_consulted],
                )
            )
            for flag in unit_report.flags:
                session.add(
                    FlagRow(
                        id=flag.id,
                        unit_id=flag.unit_id,
                        specialist=flag.specialist.value,
                        excerpt=flag.excerpt,
                        explanation=flag.explanation,
                        severity=flag.severity.value,
                        confidence=flag.confidence.value,
                        status=flag.status.value,
                        sources=[s.model_dump(mode="json") for s in flag.sources],
                        search_query=flag.search_query,
                        results_seen=flag.results_seen,
                        grounding_reasoning=flag.grounding_reasoning,
                        grounding_method=flag.grounding_method.value,
                        grounding_confidence_label=flag.grounding_confidence_label,
                    )
                )

        session.commit()


def _deduplicate(flags: list[RiskFlag]) -> list[RiskFlag]:
    """Collapse flags from different specialists that describe the same
    excerpt + explanation, ranking by severity then confidence so the
    highest-value flag survives.

    Note: this is intentionally simple pending real de-dup (embedding
    similarity) -- exact-match on the normalized excerpt is enough to catch
    the common case of two specialists independently flagging the same line.
    """
    severity_rank = {"high": 2, "medium": 1, "low": 0}
    confidence_rank = {"high": 2, "medium": 1, "low_ungrounded": 0}

    best_by_excerpt: dict[str, RiskFlag] = {}
    for flag in flags:
        key = flag.excerpt.strip().lower()
        existing = best_by_excerpt.get(key)
        if existing is None:
            best_by_excerpt[key] = flag
            continue
        current_rank = (severity_rank[flag.severity], confidence_rank[flag.confidence])
        existing_rank = (severity_rank[existing.severity], confidence_rank[existing.confidence])
        if current_rank > existing_rank:
            best_by_excerpt[key] = flag

    deduped = list(best_by_excerpt.values())
    deduped.sort(
        key=lambda f: (severity_rank[f.severity], confidence_rank[f.confidence]),
        reverse=True,
    )
    return deduped
