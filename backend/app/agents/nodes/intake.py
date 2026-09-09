"""
Intake Agent (Feature 1).

Breaks raw input (script text, scene description, or treatment) into
discrete auditable units, preserving a mapping back to each unit's exact
location in the source document.
"""
import re

from app.agents.state import GraphState
from app.cache.redis_client import write_agent_status
from app.models.schemas import AuditableUnit

SCENE_HEADER_RE = re.compile(r"^(INT\.|EXT\.|INT/EXT\.)", re.IGNORECASE | re.MULTILINE)


def intake_node(state: GraphState) -> dict:
    run_id = state["run_id"]
    write_agent_status(str(run_id), "intake", "running")

    text = state["raw_text"]
    if SCENE_HEADER_RE.search(text):
        chunks = _split_by_scene_headers(text)
    else:
        chunks = _split_by_paragraph(text)

    units = [
        AuditableUnit(
            run_id=run_id,
            index=i,
            text=chunk.strip(),
            scene_number=str(i + 1) if SCENE_HEADER_RE.search(text) else None,
            unit_type="scene" if SCENE_HEADER_RE.search(text) else "treatment_paragraph",
        )
        for i, chunk in enumerate(chunks)
        if chunk.strip()
    ]

    write_agent_status(str(run_id), "intake", "done", output_count=len(units))
    return {"units": units}


def _split_by_scene_headers(text: str) -> list[str]:
    positions = [m.start() for m in SCENE_HEADER_RE.finditer(text)]
    positions.append(len(text))
    return [text[positions[i] : positions[i + 1]] for i in range(len(positions) - 1)]


def _split_by_paragraph(text: str) -> list[str]:
    return [p for p in re.split(r"\n\s*\n", text) if p.strip()]
