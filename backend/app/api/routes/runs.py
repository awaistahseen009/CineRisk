"""Run-status endpoint: powers the frontend's Live Agent Status View."""
from uuid import UUID

from fastapi import APIRouter, HTTPException

from sqlmodel import Session

from app.cache.redis_client import read_run_status
from app.db.session import get_engine
from app.models.db import Run

router = APIRouter(prefix="/api/runs", tags=["runs"])

PIPELINE_AGENTS = [
    "intake",
    "supervisor",
    "cultural_sensitivity",
    "defamation_real_person",
    "ip_plot_similarity",
    "trademark_brand_risk",
    "historical_misrepresentation",
    "aggregator",
]

_PENDING_DEFAULT = {"state": "pending", "output_count": None, "sources": []}


@router.get("/{run_id}/status")
async def get_run_status(run_id: UUID) -> dict:
    """Returns per-agent state (pending/running/done/error), output counts,
    and (on completion) the real sources each agent found, written to Redis
    by each LangGraph node as it starts/finishes. The frontend polls (or,
    once wired to SSE, streams) this to render the pipeline visualization."""
    statuses = read_run_status(str(run_id))
    if not statuses:
        raise HTTPException(status_code=404, detail="Run not found")

    # The escalation choice lives in Postgres (per-run), not Redis, so the
    # live view can state which severities Parallel will actually be hit for
    # while the run is still going.
    escalation_tier, escalation_severities = "none", []
    with Session(get_engine()) as session:
        run_row = session.get(Run, run_id)
        if run_row is not None:
            escalation_tier = run_row.escalation_tier
            escalation_severities = [
                s for s in (run_row.escalation_severities or "").split(",") if s
            ]

    return {
        "run_id": str(run_id),
        "escalation_tier": escalation_tier,
        "escalation_severities": escalation_severities,
        "agents": [
            {"agent": agent, **statuses.get(agent, _PENDING_DEFAULT)} for agent in PIPELINE_AGENTS
        ],
    }
