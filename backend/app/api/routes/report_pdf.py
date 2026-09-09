"""
PDF export of a finished audit report.

Generated server-side rather than in the browser: the report already lives
in Postgres, so rendering it here keeps the client responsive (no blocking
the UI thread on canvas/serialisation work) and produces the same document
regardless of who exports it. Nothing is fabricated for the PDF -- it is the
same grounded findings, queries, and cited sources the report view shows.
"""
from io import BytesIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, PageBreak, Paragraph, SimpleDocTemplate, Spacer
from sqlmodel import Session, select

from app.db.session import get_session
from app.models.db import Flag, Run, Unit

router = APIRouter(prefix="/api/runs", tags=["reports"])

SEVERITY_COLOR = {
    "high": colors.HexColor("#C0392B"),
    "medium": colors.HexColor("#B7791F"),
    "low": colors.HexColor("#6B7280"),
}


def _escape(text: str) -> str:
    """ReportLab paragraphs accept a mini-HTML dialect, so raw report text
    has to be escaped or an excerpt containing < or & breaks the document."""
    return (
        (text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("t", parent=base["Title"], fontSize=20, leading=24, alignment=TA_LEFT),
        "meta": ParagraphStyle("m", parent=base["Normal"], fontSize=9, textColor=colors.HexColor("#6B7280"), leading=13),
        "scene": ParagraphStyle("s", parent=base["Heading2"], fontSize=13, leading=17, spaceBefore=14, spaceAfter=4),
        "flag": ParagraphStyle("f", parent=base["Heading3"], fontSize=11, leading=15, spaceBefore=8, spaceAfter=2),
        "body": ParagraphStyle("b", parent=base["Normal"], fontSize=9.5, leading=14),
        "mono": ParagraphStyle("c", parent=base["Code"], fontSize=8, leading=11, textColor=colors.HexColor("#374151")),
        "src": ParagraphStyle("src", parent=base["Normal"], fontSize=8, leading=11, leftIndent=10,
                              textColor=colors.HexColor("#374151")),
    }


@router.get("/{run_id}/report.pdf")
async def export_report_pdf(run_id: UUID, session: Session = Depends(get_session)):
    run = session.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")

    units = session.exec(select(Unit).where(Unit.run_id == run_id).order_by(Unit.index)).all()
    st = _styles()
    story = []

    story.append(Paragraph(_escape(run.source_document_name), st["title"]))

    all_flags: list[Flag] = []
    for u in units:
        all_flags.extend(session.exec(select(Flag).where(Flag.unit_id == u.id)).all())
    grounded = sum(1 for f in all_flags if f.status == "grounded")

    duration = None
    if run.status == "complete" and run.updated_at and run.created_at:
        elapsed = (run.updated_at - run.created_at).total_seconds()
        duration = elapsed if elapsed >= 1 else None

    meta = f"{len(units)} units reviewed, {len(all_flags)} flags, {grounded} grounded in a real source"
    if duration:
        meta += f", completed in {int(duration // 60)}m {int(duration % 60)}s"
    story.append(Paragraph(_escape(meta), st["meta"]))

    if run.escalation_tier and run.escalation_tier != "none":
        sev = ", ".join(s for s in (run.escalation_severities or "").split(",") if s) or "tier default"
        label = "Deep research (Parallel Task API, pro tier)" if run.escalation_tier == "research" else "Deep verification (Parallel Task API, core tier)"
        story.append(Paragraph(_escape(f"{label} applied to {sev} severity flags"), st["meta"]))
    else:
        story.append(Paragraph("Grounded via the Parallel Search API (fast path)", st["meta"]))

    story.append(Spacer(1, 6 * mm))

    for u in units:
        flags = session.exec(select(Flag).where(Flag.unit_id == u.id)).all()
        scene = u.scene_number or f"#{u.index + 1}"
        story.append(Paragraph(f"Scene {_escape(scene)}", st["scene"]))
        story.append(Paragraph(_escape((u.text or "")[:900]), st["mono"]))

        if not flags:
            story.append(Paragraph("Reviewed and clear: no risk flags raised.", st["body"]))
            continue

        for f in flags:
            block = []
            status = "GROUNDED" if f.status == "grounded" else "UNCONFIRMED SUSPICION"
            colour = SEVERITY_COLOR.get(f.severity, colors.black)
            head = f'<font color="{colour}"><b>{_escape(f.severity.upper())}</b></font> &nbsp; {_escape(f.specialist.replace("_", " ").title())} &nbsp; [{status}]'
            block.append(Paragraph(head, st["flag"]))
            block.append(Paragraph(f'"{_escape(f.excerpt)}"', st["mono"]))
            block.append(Paragraph(_escape(f.explanation), st["body"]))

            if f.search_query:
                block.append(Paragraph(
                    _escape(f'Searched Parallel for: "{f.search_query}" ({f.results_seen} results returned, '
                            f'{len(f.sources or [])} cited)'), st["meta"]))
            if f.grounding_reasoning:
                block.append(Paragraph(_escape(f.grounding_reasoning), st["meta"]))
            for s in (f.sources or []):
                block.append(Paragraph(
                    _escape(f"- {s.get('source_title', '')} ({s.get('source_url', '')})"), st["src"]))
            story.append(KeepTogether(block))

    buf = BytesIO()
    SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm, topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"CineRisk audit: {run.source_document_name}",
    ).build(story)
    buf.seek(0)

    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in run.source_document_name)[:60]
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="cinerisk-{safe}.pdf"'},
    )
