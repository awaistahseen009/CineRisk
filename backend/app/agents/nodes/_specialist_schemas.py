"""
Structured LLM I/O contracts for the specialist pipeline's two LLM calls
(identification, then grounding verification). These live separately from
app.models.schemas because they are internal call shapes for
`with_structured_output`, not the public report schema.
"""
from typing import Literal

from pydantic import BaseModel, Field

from app.models.schemas import Severity


class Suspicion(BaseModel):
    """One suspected risk identified by a specialist in a single unit,
    before any grounding has happened. This is a hypothesis, not a finding
    -- see IDENTIFICATION_OUTPUT_RULE in _specialist_base.py."""

    excerpt: str = Field(
        ..., description="Exact text copied verbatim from the unit that triggered this suspicion."
    )
    explanation: str = Field(
        ..., description="Plain-language, one-paragraph explanation of the concern."
    )
    severity: Severity = Field(
        ...,
        description=(
            "Cost/damage if this risk turns out to be real -- legal exposure, PR "
            "damage, audience backlash scale. Independent of how strong the "
            "evidence for it turns out to be."
        ),
    )
    search_query: str = Field(
        ...,
        description="A specific web search query likely to find a REAL documented precedent for this exact concern.",
    )


class SuspicionList(BaseModel):
    """Structured output contract for the identification step. An empty
    list is a valid, expected answer -- it is what lets a unit be marked
    reviewed-and-clear (Feature 8) instead of silently skipped."""

    suspicions: list[Suspicion] = Field(default_factory=list)


class GroundingVerdict(BaseModel):
    """Structured output contract for the grounding/verification step. The
    model is shown the ACTUAL retrieved search results and must decide
    whether any of them really substantiate the suspicion -- having search
    results is not the same as being grounded (see GROUNDING_SYSTEM_PROMPT).
    """

    grounded: bool = Field(
        ...,
        description=(
            "True only if at least one provided source genuinely documents a "
            "real precedent for THIS specific concern -- not merely a related "
            "topic or the same broad category."
        ),
    )
    matched_source_indices: list[int] = Field(
        default_factory=list,
        description=(
            "0-based indices into the provided source list that genuinely "
            "support the concern. Must be empty when grounded=false. Never "
            "reference an index outside the provided list."
        ),
    )
    confidence: Literal["high", "medium"] | None = Field(
        default=None,
        description=(
            "How directly the cited source's ACTUAL FACTS match this scene's "
            "specific portrayal, not whether they share a broad subject. "
            "'high' only when the source's facts closely parallel what "
            "happens here: a materially similar action, toward a materially "
            "similar target, in a materially similar setting. 'medium' when "
            "the connection is real but general, which is an honest answer "
            "and must not be upgraded just because the source was the best "
            "one the search returned. Required when grounded=true, must be "
            "null when grounded=false."
        ),
    )
    reasoning: str = Field(
        ...,
        description="One or two sentences on why the sources do (or do not) actually substantiate this specific concern.",
    )
