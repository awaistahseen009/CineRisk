"""The grounding rules are the product's core promise, so they are locked in
here rather than left to convention in the specialist nodes.

Two invariants, both enforced by RiskFlag itself:
  1. No sources -> cannot be reported as GROUNDED.
  2. No recorded search_query -> cannot be reported at all. Every specialist
     must go through a real Parallel search; a flag with no query is one
     that never did.
"""
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.agents.nodes import (
    cultural_sensitivity,
    defamation,
    historical_misrepresentation,
    ip_similarity,
    trademark_brand,
)
from app.agents.nodes._specialist_schemas import Suspicion
from app.models.schemas import (
    Confidence,
    FlagStatus,
    RiskFlag,
    Severity,
    SourceObject,
    SourceType,
    SpecialistType,
)

SPECIALIST_MODULES = [
    cultural_sensitivity,
    defamation,
    ip_similarity,
    trademark_brand,
    historical_misrepresentation,
]


def _source() -> SourceObject:
    return SourceObject(
        source_title="Real retrieved article",
        source_url="https://example.com/a",
        source_type=SourceType.NEWS_ARTICLE,
        retrieved_snippet="excerpt",
    )


def _flag(**overrides):
    kwargs = dict(
        unit_id=uuid4(),
        specialist=SpecialistType.CULTURAL_SENSITIVITY,
        excerpt="x",
        explanation="y",
        severity=Severity.HIGH,
        confidence=Confidence.LOW_UNGROUNDED,
        status=FlagStatus.UNCONFIRMED_SUSPICION,
        search_query="a real parallel query",
    )
    kwargs.update(overrides)
    return RiskFlag(**kwargs)


def test_flag_without_search_query_is_rejected():
    """A flag that never went through Parallel must not be constructible."""
    with pytest.raises(ValidationError, match="search_query"):
        _flag(search_query=None)


def test_flag_with_blank_search_query_is_rejected():
    with pytest.raises(ValidationError, match="search_query"):
        _flag(search_query="   ")


def test_grounded_flag_without_sources_is_rejected():
    with pytest.raises(ValidationError, match="GROUNDED"):
        _flag(status=FlagStatus.GROUNDED, sources=[])


def test_grounded_flag_with_a_real_source_is_allowed():
    flag = _flag(
        status=FlagStatus.GROUNDED,
        confidence=Confidence.HIGH,
        sources=[_source()],
        results_seen=5,
    )
    assert flag.status is FlagStatus.GROUNDED
    assert flag.results_seen == 5


def test_ungrounded_flag_still_records_its_search_attempt():
    """The audit trail is what distinguishes 'searched and found nothing'
    from 'never searched' -- an unconfirmed flag must still carry it."""
    flag = _flag(results_seen=5, grounding_reasoning="none were on point")
    assert flag.search_query
    assert flag.results_seen == 5
    assert flag.grounding_reasoning


@pytest.mark.asyncio
async def test_deep_verification_is_off_unless_requested(monkeypatch):
    """The Task API escalation must never fire on an ordinary run -- it costs
    minutes per flag, so it only runs when the upload opted in (or the env
    flag is set)."""
    from app.agents.nodes import _specialist_base as base

    called = False

    async def _fake_deep_verify(**_kwargs):
        nonlocal called
        called = True
        return None

    monkeypatch.setattr(base.parallel_task, "deep_verify", _fake_deep_verify)

    suspicion = Suspicion(
        excerpt="x", explanation="y", severity=Severity.HIGH, search_query="q"
    )
    result = await base._maybe_deep_verify(
        SpecialistType.CULTURAL_SENSITIVITY, suspicion, requested_verification=False, requested_research=False
    )
    assert result is None
    assert called is False, "deep verification ran without being requested"


@pytest.mark.asyncio
async def test_deep_verification_runs_when_requested_for_high_severity(monkeypatch):
    from app.agents.nodes import _specialist_base as base

    seen: dict = {}

    async def _fake_deep_verify(**kwargs):
        seen.update(kwargs)
        return None

    monkeypatch.setattr(base.parallel_task, "deep_verify", _fake_deep_verify)

    suspicion = Suspicion(
        excerpt="the excerpt", explanation="the concern", severity=Severity.HIGH, search_query="q"
    )
    await base._maybe_deep_verify(
        SpecialistType.CULTURAL_SENSITIVITY, suspicion, requested_verification=True
    )
    assert seen.get("concern") == "the concern"
    assert seen.get("excerpt") == "the excerpt"
    assert seen.get("processor") == "core"


@pytest.mark.asyncio
async def test_deep_research_uses_the_slower_processor_and_wins_over_verification(monkeypatch):
    """Deep research strictly subsumes deep verification, so when both are
    requested for the same run, the pro/ultra tier is what actually fires,
    not the fast core tier."""
    from app.agents.nodes import _specialist_base as base

    seen: dict = {}

    async def _fake_deep_verify(**kwargs):
        seen.update(kwargs)
        return None

    monkeypatch.setattr(base.parallel_task, "deep_verify", _fake_deep_verify)

    suspicion = Suspicion(
        excerpt="x", explanation="y", severity=Severity.HIGH, search_query="q"
    )
    await base._maybe_deep_verify(
        SpecialistType.CULTURAL_SENSITIVITY, suspicion, requested_verification=True, requested_research=True
    )
    settings = base.get_settings()
    assert seen.get("processor") == settings.deep_research_processor
    assert seen.get("processor") != "core"


@pytest.mark.asyncio
async def test_deep_verification_skips_non_high_severity(monkeypatch):
    """Escalation is reserved for the flags where being wrong is expensive."""
    from app.agents.nodes import _specialist_base as base

    called = False

    async def _fake_deep_verify(**_kwargs):
        nonlocal called
        called = True
        return None

    monkeypatch.setattr(base.parallel_task, "deep_verify", _fake_deep_verify)

    suspicion = Suspicion(
        excerpt="x", explanation="y", severity=Severity.MEDIUM, search_query="q"
    )
    await base._maybe_deep_verify(
        SpecialistType.CULTURAL_SENSITIVITY, suspicion, requested_verification=True
    )
    assert called is False


@pytest.mark.parametrize("module", SPECIALIST_MODULES, ids=lambda m: m.__name__.rsplit(".", 1)[-1])
def test_every_specialist_routes_through_the_shared_grounding_path(module):
    """All five specialists must delegate to run_specialist, which is the
    only code path that issues a Parallel search. If a specialist ever grows
    its own bespoke implementation, this fails."""
    source = __import__("inspect").getsource(module)
    assert "run_specialist(" in source, f"{module.__name__} does not call run_specialist"
    assert "from app.agents.nodes._specialist_base import run_specialist" in source


@pytest.mark.asyncio
async def test_deep_research_also_covers_medium_severity(monkeypatch):
    """Deep research reaches further than deep verification, not just
    slower. Gating it to high-only meant a run whose high-severity flags all
    grounded cleanly did no deep research at all, which is exactly what the
    user opted in for."""
    from app.agents.nodes import _specialist_base as base

    seen: dict = {}

    async def _fake_deep_verify(**kwargs):
        seen.update(kwargs)
        return None

    monkeypatch.setattr(base.parallel_task, "deep_verify", _fake_deep_verify)

    suspicion = Suspicion(
        excerpt="x", explanation="y", severity=Severity.MEDIUM, search_query="q"
    )
    await base._maybe_deep_verify(
        SpecialistType.IP_PLOT_SIMILARITY, suspicion, requested_research=True
    )
    assert seen, "deep research skipped a medium-severity ungrounded flag"


@pytest.mark.asyncio
async def test_deep_verification_still_ignores_medium_severity(monkeypatch):
    """The fast core tier keeps its narrow, cheap remit."""
    from app.agents.nodes import _specialist_base as base

    called = False

    async def _fake_deep_verify(**_kwargs):
        nonlocal called
        called = True
        return None

    monkeypatch.setattr(base.parallel_task, "deep_verify", _fake_deep_verify)

    suspicion = Suspicion(
        excerpt="x", explanation="y", severity=Severity.MEDIUM, search_query="q"
    )
    await base._maybe_deep_verify(
        SpecialistType.IP_PLOT_SIMILARITY, suspicion, requested_verification=True
    )
    assert called is False


@pytest.mark.asyncio
async def test_low_severity_never_escalates(monkeypatch):
    from app.agents.nodes import _specialist_base as base

    called = False

    async def _fake_deep_verify(**_kwargs):
        nonlocal called
        called = True
        return None

    monkeypatch.setattr(base.parallel_task, "deep_verify", _fake_deep_verify)

    suspicion = Suspicion(
        excerpt="x", explanation="y", severity=Severity.LOW, search_query="q"
    )
    await base._maybe_deep_verify(
        SpecialistType.IP_PLOT_SIMILARITY, suspicion, requested_research=True
    )
    assert called is False
