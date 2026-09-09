"""
Parallel Task API verification -- the "deep" grounding path.

WHY THIS EXISTS (measured, not assumed)
---------------------------------------
The Search API path (parallel_client.search + an LLM verifier reading the
real results) is fast and is what makes a live run watchable. But on this
project's own workload it grounds on whatever the query happened to surface,
and the LLM verifier scores its own confidence -- which it overstates. On
the Scene 2 cultural-sensitivity concern, the Search path returned generic
background reading (an academic paper on Muslim stand-up comedy, a
representation-statistics study, a Wikipedia overview) and the verifier
called that "high" confidence.

Asked the same question, the Task API 'core' processor returned specific
documented incidents instead -- The Siege (1998) CAIR/ADC protests, Fox's
24 (2005) where CAIR's complaint led the network to cut material and air
PSAs, the ADC's objection to Aladdin (1992) -- and rated itself "medium",
explicitly noting no source documented this exact combination of details.
Better precedents AND more honest calibration, because the confidence comes
from Parallel's Basis framework rather than from a model grading its own
homework.

TASK_API_ESCALATION_NOTE
------------------------
The catch is latency: that run took 281.8 seconds against ~2-4s for the
Search path. That rules it out as the default for every flag in an
interactive run. So it is used as an ESCALATION, not a replacement:
by default off; when enabled, only high-severity flags the fast path could
not ground are re-checked here. That targets exactly the case where "no
precedent found" is most expensive to get wrong, and leaves the fast path
untouched everywhere else.

Grounding discipline is identical to the Search path: every SourceObject is
built from a real Citation returned by Parallel (url/title/excerpt). Nothing
is ever authored by a model.

TWO ESCALATION TIERS, SAME CODE PATH
-------------------------------------
Parallel's "Deep Research" is not a separate endpoint or API -- per
docs.parallel.ai/task-api/task-deep-research it is the SAME /v1/tasks/runs
call used here, just pointed at the `pro`/`ultra` processor family instead
of `core`, with auto-schema output still fully supported (not only their
freeform "text schema" mode). So `deep_verify` below takes the processor and
timeout as parameters rather than hardcoding `core`: the "deep verification"
toggle uses the fast Task tier, the "deep research" toggle uses a materially
slower, more thorough tier, and both flow through this one function.
"""
import asyncio
import logging

from parallel import AsyncParallel
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.mcp.og_image import fetch_og_image
from app.mcp.parallel_client import _infer_source_type
from app.models.schemas import SourceObject

logger = logging.getLogger(__name__)


class PrecedentVerdict(BaseModel):
    """Output contract for the Task API run. Parallel attaches a FieldBasis
    (citations + reasoning + calibrated confidence) to each of these fields,
    which is the whole reason for using it over raw search."""

    precedent_exists: bool = Field(
        description=(
            "True ONLY if a real, documented case exists where closely comparable "
            "media content caused public backlash, an advocacy-group complaint, a "
            "lawsuit, a studio apology, or a platform removal. General commentary "
            "about the topic does NOT count as a precedent."
        )
    )
    precedent_summary: str = Field(
        description=(
            "One paragraph describing the specific documented precedent(s), naming "
            "the work and what actually happened. If none was found, say so plainly."
        )
    )


class DeepVerdict(BaseModel):
    """Normalized result handed back to the specialist pipeline."""

    grounded: bool
    reasoning: str
    confidence_label: str | None
    sources: list[SourceObject]


async def deep_verify(
    concern: str,
    excerpt: str,
    mandate: str,
    *,
    processor: str | None = None,
    timeout: float | None = None,
) -> DeepVerdict | None:
    """Re-check one suspicion with the Task API. Returns None on any failure
    -- this is an optional escalation and must never take a run down with
    it; the caller keeps whatever the fast path already concluded.

    `processor`/`timeout` let the caller pick the escalation tier (fast
    `core` "deep verification" vs. slow `pro`/`ultra` "deep research");
    defaults fall back to the `core`-tier settings for backward
    compatibility with existing callers."""
    settings = get_settings()
    client = AsyncParallel(api_key=settings.parallel_api_key)
    processor = processor or settings.task_api_processor
    timeout = timeout if timeout is not None else settings.task_api_timeout_seconds

    prompt = (
        f"You are checking a {mandate} concern raised against a film/TV script.\n\n"
        f"Concern:\n{concern}\n\n"
        f'Excerpt that triggered it:\n"{excerpt}"\n\n'
        "Find real, documented precedents for this SPECIFIC concern: actual "
        "incidents where comparable content drew public backlash, advocacy-group "
        "complaints, legal action, apologies, or removal. Do not count general "
        "commentary or background explainers as precedent."
    )

    try:
        result = await client.task_run.execute(
            input=prompt,
            processor=processor,
            output=PrecedentVerdict,
            timeout=timeout,
        )
    except Exception:
        logger.exception("Task API deep verification failed (processor=%s); keeping fast-path verdict", processor)
        return None

    parsed = result.output.parsed
    basis = list(result.output.basis or [])

    # Prefer the basis entry for the boolean field -- that is the one whose
    # confidence actually speaks to "is there a precedent at all".
    primary = next((b for b in basis if b.field == "precedent_exists"), None) or (basis[0] if basis else None)

    sources = await _citations_to_sources(basis)
    if not sources:
        # Same invariant as everywhere else: no real source, not grounded.
        return DeepVerdict(
            grounded=False,
            reasoning=parsed.precedent_summary,
            confidence_label=primary.confidence if primary else None,
            sources=[],
        )

    return DeepVerdict(
        grounded=bool(parsed.precedent_exists),
        reasoning=(primary.reasoning if primary else parsed.precedent_summary),
        confidence_label=primary.confidence if primary else None,
        sources=sources if parsed.precedent_exists else [],
    )


async def _citations_to_sources(basis, cap: int = 6) -> list[SourceObject]:
    """Flatten every FieldBasis's citations into deduplicated SourceObjects,
    reading strictly from what Parallel returned."""
    seen: dict[str, dict] = {}
    for field_basis in basis:
        for citation in field_basis.citations or []:
            if citation.url in seen:
                continue
            seen[citation.url] = {
                "source_title": citation.title or citation.url,
                "source_url": citation.url,
                "source_type": _infer_source_type(citation.url),
                "retrieved_snippet": "\n\n".join(citation.excerpts) if citation.excerpts else "",
            }
            if len(seen) >= cap:
                break

    entries = list(seen.values())
    images = await asyncio.gather(*(fetch_og_image(e["source_url"]) for e in entries))

    sources: list[SourceObject] = []
    for entry, image_url in zip(entries, images):
        try:
            sources.append(SourceObject(**entry, image_url=image_url))
        except Exception:
            continue
    return sources
