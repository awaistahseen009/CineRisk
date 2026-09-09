"""
SQLModel tables — Pydantic-compatible, mapped directly to Neon Postgres.
Mirrors the shapes in schemas.py so agent output validates and persists
without a separate translation layer.
"""
from datetime import datetime
from uuid import UUID, uuid4

from sqlmodel import Field, JSON, Relationship, SQLModel


class Run(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    source_document_name: str
    status: str = Field(default="queued")
    total_units: int | None = None
    units_complete: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Which Parallel escalation this run asked for, recorded per-run so the
    # live view and the finished report can both state exactly what was
    # requested. "none" | "verification" | "research".
    escalation_tier: str = Field(default="none")
    # Comma-separated severities eligible for escalation on THIS run, e.g.
    # "high,medium". Empty means the tier's own default applied.
    escalation_severities: str = Field(default="")

    units: list["Unit"] = Relationship(back_populates="run")


class Unit(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    run_id: UUID = Field(foreign_key="run.id", index=True)
    index: int
    text: str
    scene_number: str | None = None
    page_range: str | None = None
    line_range: str | None = None
    unit_type: str = Field(default="scene")
    status: str = Field(default="pending")  # pending | clear | flagged
    specialists_consulted: list[str] = Field(default_factory=list, sa_type=JSON)

    run: Run | None = Relationship(back_populates="units")
    flags: list["Flag"] = Relationship(back_populates="unit")


class Flag(SQLModel, table=True):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    unit_id: UUID = Field(foreign_key="unit.id", index=True)
    specialist: str
    excerpt: str
    explanation: str
    severity: str
    confidence: str
    status: str  # grounded | unconfirmed_suspicion
    # List[SourceObject]-shaped dicts; kept as JSON rather than a separate
    # table since sources are always read/written as a unit with the flag.
    sources: list[dict] = Field(default_factory=list, sa_type=JSON)

    # Grounding audit trail -- mirrors RiskFlag in schemas.py. Persisted so a
    # finished report can always prove what was actually searched for each
    # flag, how many results came back, and why the verifier ruled the way it
    # did, instead of that evidence living only in an ephemeral log line.
    search_query: str | None = None
    results_seen: int = Field(default=0)
    grounding_reasoning: str | None = None
    grounding_method: str = Field(default="search_api")
    grounding_confidence_label: str | None = None

    unit: Unit | None = Relationship(back_populates="flags")
