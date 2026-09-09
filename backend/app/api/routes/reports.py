"""Report endpoint: the finished, scene-anchored audit report (Feature 7)."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.db import Flag, Run, Unit

router = APIRouter(prefix="/api/runs", tags=["reports"])


@router.get("/{run_id}/report")
async def get_report(run_id: UUID, session: Session = Depends(get_session)) -> dict:
    run = session.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    units = session.exec(
        select(Unit).where(Unit.run_id == run_id).order_by(Unit.index)
    ).all()

    unit_payloads = []
    for unit in units:
        flags = session.exec(select(Flag).where(Flag.unit_id == unit.id)).all()
        unit_payloads.append(
            {
                "unit": unit.model_dump(),
                "status": unit.status,
                "specialists_consulted": unit.specialists_consulted,
                "flags": [f.model_dump() for f in flags],
            }
        )

    # How long the audit actually took, end to end. Only meaningful once the
    # aggregator has stamped updated_at on completion; a run still in flight
    # reports null rather than a misleading partial number.
    duration_seconds: float | None = None
    if run.status == "complete" and run.updated_at and run.created_at:
        elapsed = (run.updated_at - run.created_at).total_seconds()
        # Runs finished before completion timestamping was added never had
        # updated_at stamped, so it still equals created_at. Reporting that
        # as a sub-second audit would be a lie; report nothing instead.
        duration_seconds = elapsed if elapsed >= 1.0 else None

    return {
        "run_id": str(run_id),
        "source_document_name": run.source_document_name,
        "status": run.status,
        "created_at": run.created_at.isoformat() if run.created_at else None,
        "completed_at": run.updated_at.isoformat() if run.updated_at else None,
        "duration_seconds": duration_seconds,
        "escalation_tier": run.escalation_tier,
        "escalation_severities": [s for s in (run.escalation_severities or "").split(",") if s],
        "units": unit_payloads,
    }
