"""Ingestion endpoint: accepts a script/scene/treatment document -- either
an uploaded file or pasted raw text -- and starts an audit run (Feature 1)."""
import logging
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, UploadFile
from sqlmodel import Session

from app.agents.graph import cinerisk_graph
from app.api.routes.document_extract import MIN_CONTENT_CHARS, extract_text
from app.cache.redis_client import write_agent_status
from app.db.session import get_engine
from app.models.db import Run as RunRow
from app.models.schemas import RunStatusState

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/runs", tags=["ingestion"])


@router.post("", status_code=202)
async def create_run(
    background_tasks: BackgroundTasks,
    file: UploadFile | None = None,
    text: str | None = Form(None),
    deep_verification: bool = Form(False),
    deep_research: bool = Form(False),
    escalation_severities: str = Form(""),
) -> dict:
    """Start an audit run from either an uploaded file OR pasted raw text --
    exactly one of `file` (multipart) / `text` (form field) must be given.
    Returns immediately with a run_id; poll GET /api/runs/{run_id}/status or
    GET /api/runs/{run_id}/report."""
    has_file = file is not None and file.filename
    has_text = bool(text and text.strip())
    if not has_file and not has_text:
        raise HTTPException(status_code=400, detail="Provide either a file or pasted text.")

    if has_file:
        raw_bytes = await file.read()  # type: ignore[union-attr]
        filename = file.filename or "untitled"  # type: ignore[union-attr]
        # Raises HTTPException(400) itself for an unsupported extension, a
        # file that fails to parse, or one that parses to no real content --
        # every case gets a specific, user-facing message rather than a
        # silently garbled "audit" of binary noise decoded as UTF-8.
        raw_text = extract_text(filename, raw_bytes)
    else:
        raw_text = (text or "").strip()
        if len(raw_text) < MIN_CONTENT_CHARS:
            raise HTTPException(
                status_code=400,
                detail=f"Pasted text is too short to audit. Please provide at least {MIN_CONTENT_CHARS} characters.",
            )
        filename = "Pasted script"

    run_id = uuid4()

    with Session(get_engine()) as session:
        session.add(
            RunRow(
                id=run_id,
                source_document_name=filename,
                status=RunStatusState.QUEUED,
                escalation_tier=("research" if deep_research else "verification" if deep_verification else "none"),
                escalation_severities=escalation_severities.strip(),
            )
        )
        session.commit()

    write_agent_status(str(run_id), "intake", "pending")
    write_agent_status(str(run_id), "supervisor", "pending")
    write_agent_status(str(run_id), "aggregator", "pending")

    background_tasks.add_task(
        _run_pipeline, run_id, filename, raw_text, deep_verification, deep_research, escalation_severities
    )

    return {"run_id": str(run_id), "state": RunStatusState.QUEUED}


async def _run_pipeline(
    run_id: UUID,
    filename: str,
    raw_text: str,
    deep_verification: bool = False,
    deep_research: bool = False,
    escalation_severities: str = "",
) -> None:
    try:
        await cinerisk_graph.ainvoke(
            {
                "run_id": run_id,
                "source_document_name": filename,
                "raw_text": raw_text,
                "deep_verification": deep_verification,
                "deep_research": deep_research,
                "escalation_severities": [s.strip() for s in escalation_severities.split(",") if s.strip()],
                "units": [],
                "routing": [],
                "flags": [],
                "report_ready": False,
            }
        )
    except Exception:
        # Individual specialists already protect their own failures (see
        # run_specialist), but intake/supervisor/aggregator -- or something
        # entirely unexpected -- can still blow up the whole graph. Without
        # this, the run silently dies mid-flight and the frontend polls
        # /status forever with nothing ever reaching "done". Mark the run
        # failed in both places the frontend can observe it.
        logger.exception("Run %s failed", run_id)
        write_agent_status(str(run_id), "aggregator", "error", output_count=0)
        with Session(get_engine()) as session:
            run_row = session.get(RunRow, run_id)
            if run_row is not None:
                run_row.status = RunStatusState.FAILED
                session.add(run_row)
                session.commit()
