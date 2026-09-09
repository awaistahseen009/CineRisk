"""
Pydantic schemas shared across the LangGraph agent, the FastAPI API layer,
and (via SQLModel in db.py) persistence.

These are the hard contracts referenced in the product spec:
- Feature 5 (Grounded Citation Requirement): every RiskFlag must carry a
  SourceObject, or be explicitly downgraded to an unconfirmed suspicion.
- Feature 6 (Severity & Confidence Ranking): every RiskFlag carries both
  scores independently.
- Feature 8 (Explicit "No Issues Found"): AuditableUnit.status covers the
  clean/reviewed case explicitly, it is never just "absence of flags".
"""
from datetime import datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, HttpUrl


class SpecialistType(StrEnum):
    CULTURAL_SENSITIVITY = "cultural_sensitivity"
    DEFAMATION_REAL_PERSON = "defamation_real_person"
    IP_PLOT_SIMILARITY = "ip_plot_similarity"
    TRADEMARK_BRAND_RISK = "trademark_brand_risk"
    HISTORICAL_MISREPRESENTATION = "historical_misrepresentation"


class SourceType(StrEnum):
    NEWS_ARTICLE = "news_article"
    LEGAL_FILING = "legal_filing"
    ADVOCACY_STATEMENT = "advocacy_statement"
    ENTERTAINMENT_PRESS = "entertainment_press"
    OTHER = "other"


class Severity(StrEnum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class Confidence(StrEnum):
    HIGH = "high"          # closely matching precedent, cited
    MEDIUM = "medium"      # related but not identical precedent
    LOW_UNGROUNDED = "low_ungrounded"  # plausible concern, no supporting source


class FlagStatus(StrEnum):
    GROUNDED = "grounded"                     # has >=1 real SourceObject
    UNCONFIRMED_SUSPICION = "unconfirmed_suspicion"  # no source found -> downgraded


class SourceObject(BaseModel):
    """A single real, retrieved grounding source for a risk flag.

    Every field here must come from an actual Parallel search result --
    never fabricated. See Feature 5.
    """

    source_title: str
    source_url: HttpUrl
    source_type: SourceType
    retrieved_snippet: str = Field(
        ..., description="Exact excerpt retrieved from the source that supports the flag."
    )
    # Best-effort og:image/twitter:image from the source page itself --
    # never fabricated, same grounding discipline as everything else here.
    # None whenever it can't be found or the fetch times out; the frontend
    # falls back to a favicon-based treatment in that case, never a fake
    # placeholder image.
    image_url: HttpUrl | None = None


class AuditableUnit(BaseModel):
    """A single chunk produced by the Intake Agent (Feature 1).

    Preserves a mapping back to the unit's exact location in the source
    document so every flag can point back to precisely where it lives.
    """

    id: UUID = Field(default_factory=uuid4)
    run_id: UUID
    index: int = Field(..., description="Order of this unit within the document.")
    text: str
    scene_number: str | None = None
    page_range: str | None = None
    line_range: str | None = None
    unit_type: str = Field(
        default="scene",
        description="e.g. scene, character_introduction, plot_beat, dialogue_line",
    )


class GroundingMethod(StrEnum):
    """Which verification path produced this flag's grounding verdict."""

    SEARCH_API = "search_api"    # Parallel /v1/search + LLM verifier over the real results
    TASK_API = "task_api"        # Parallel Task API (Basis: citations + calibrated confidence)


class RiskFlag(BaseModel):
    """A single risk finding raised by a specialist agent for one unit."""

    id: UUID = Field(default_factory=uuid4)
    unit_id: UUID
    specialist: SpecialistType
    excerpt: str = Field(..., description="Exact script excerpt that triggered the flag.")
    explanation: str = Field(..., description="Plain-language explanation of the concern.")
    severity: Severity
    confidence: Confidence
    status: FlagStatus
    sources: list[SourceObject] = Field(default_factory=list)

    # --- Grounding audit trail -------------------------------------------
    # Without these, an ungrounded flag is indistinguishable from one whose
    # search silently underperformed: you cannot tell whether the pipeline
    # searched and found nothing, or never really tried. Every flag now
    # carries the receipts for its own grounding attempt.
    search_query: str | None = Field(
        default=None,
        description="The exact query string sent to Parallel for this specific flag.",
    )
    results_seen: int = Field(
        default=0,
        description="How many real results Parallel returned for that query.",
    )
    grounding_reasoning: str | None = Field(
        default=None,
        description="The verifier's stated reason for grounding (or refusing to ground) this flag.",
    )
    grounding_method: GroundingMethod = Field(
        default=GroundingMethod.SEARCH_API,
        description="Which Parallel verification path produced this verdict.",
    )
    grounding_confidence_label: str | None = Field(
        default=None,
        description=(
            "Verifier-reported confidence as a raw label. From Parallel's own "
            "Basis framework when grounding_method=task_api."
        ),
    )

    def model_post_init(self, __context) -> None:
        # Enforce Feature 5 at the schema level: no sources -> must be
        # downgraded to an unconfirmed suspicion, never asserted as grounded.
        if not self.sources and self.status == FlagStatus.GROUNDED:
            raise ValueError(
                "RiskFlag has no sources but status=GROUNDED; "
                "ungrounded flags must be status=UNCONFIRMED_SUSPICION."
            )
        # Every specialist MUST ground through Parallel -- this makes that a
        # structural guarantee rather than a convention every node happens to
        # follow. A flag with no recorded query is one that never went
        # through the search path, so it cannot be reported at all: the
        # pipeline fails loudly here instead of quietly shipping a finding
        # that no external source was ever sought for.
        if not (self.search_query or "").strip():
            raise ValueError(
                f"RiskFlag from specialist '{self.specialist}' has no search_query; "
                "every flag must be produced via a real Parallel search "
                "(see run_specialist / _ground_and_build_flag)."
            )


class UnitReviewStatus(StrEnum):
    CLEAR = "clear"        # reviewed by all routed specialists, no flags
    FLAGGED = "flagged"    # has one or more RiskFlags


class UnitReport(BaseModel):
    """Aggregated, deduplicated view of one AuditableUnit for the final report."""

    unit: AuditableUnit
    specialists_consulted: list[SpecialistType]
    status: UnitReviewStatus
    flags: list[RiskFlag] = Field(default_factory=list)


class RunStatusState(StrEnum):
    QUEUED = "queued"
    INTAKE = "intake"
    SUPERVISOR_ROUTING = "supervisor_routing"
    SPECIALISTS_RUNNING = "specialists_running"
    AGGREGATING = "aggregating"
    COMPLETE = "complete"
    FAILED = "failed"


class AgentStatus(BaseModel):
    """Live per-agent status, written to Redis and streamed/polled by the
    frontend's Live Agent Status View."""

    agent: str  # "intake" | "supervisor" | one of SpecialistType | "aggregator"
    state: str  # "pending" | "running" | "done" | "error"
    output_count: int | None = None
    # A capped, deduplicated slice of the real SourceObjects this agent found
    # -- populated on completion so the live status view's info affordance
    # shows actual grounding data instead of a placeholder while the run is
    # still in progress (full detail remains available via the report once
    # the run completes).
    sources: list[SourceObject] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class RunStatus(BaseModel):
    run_id: UUID
    state: RunStatusState
    agents: list[AgentStatus] = Field(default_factory=list)
    total_units: int | None = None
    units_complete: int | None = None
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class AuditReport(BaseModel):
    run_id: UUID
    source_document_name: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    units: list[UnitReport] = Field(default_factory=list)

    @property
    def total_flags(self) -> int:
        return sum(len(u.flags) for u in self.units)

    @property
    def total_clear_units(self) -> int:
        return sum(1 for u in self.units if u.status == UnitReviewStatus.CLEAR)
