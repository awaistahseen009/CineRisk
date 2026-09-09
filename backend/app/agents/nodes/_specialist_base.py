"""
Shared logic for the three specialist sub-agent nodes. Each specialist runs
two LLM calls per unit, never one:

1. IDENTIFICATION -- structured output (SuspicionList). Ask Gemini what, if
   anything, in this unit is worth checking, and for a search query per
   suspicion. This step never asserts a precedent exists; it only proposes
   what to go check (see IDENTIFICATION_OUTPUT_RULE). An empty list is a
   fully valid answer -- that's what lets a unit end up explicitly
   "reviewed and clear" (Feature 8) instead of just having nothing to show.

2. GROUNDING VERIFICATION -- structured output (GroundingVerdict), run only
   after a real Parallel search for that suspicion has come back. Gemini is
   shown the ACTUAL retrieved results and must decide whether any of them
   really substantiate the specific concern. Running a search is not the
   same as being grounded -- GROUNDING_SYSTEM_PROMPT says this explicitly,
   and the model must pick sources by index into the real result list
   rather than restate them, so it is structurally unable to fabricate a
   title/URL/snippet even if it wanted to.

If a suspicion gets zero search results, or the verifier finds none of the
results actually on point, the flag is built as UNCONFIRMED_SUSPICION /
LOW_UNGROUNDED. This is Feature 5's hard constraint, enforced at three
layers: the identification prompt (don't assert precedents), the
verification prompt (don't count a merely-related result), and the schema
(RiskFlag rejects status=GROUNDED with no sources).
"""
import asyncio
import logging
import time
from uuid import UUID

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_google_vertexai import ChatVertexAI
from pydantic import ValidationError

from app.agents.nodes._specialist_schemas import GroundingVerdict, Suspicion, SuspicionList
from app.agents.state import GraphState
from app.cache.redis_client import write_agent_status
from app.core.config import get_settings
from app.mcp import parallel_client, parallel_task
from app.models.schemas import (
    Confidence,
    FlagStatus,
    GroundingMethod,
    RiskFlag,
    Severity,
    SourceObject,
    SpecialistType,
)

logger = logging.getLogger(__name__)

# Vertex AI enforces a per-project, per-minute quota, and this graph fans out
# five specialists at once, each making two Gemini calls per unit (~13 calls
# for a 5-scene script versus ~6 Parallel searches). Bursting all of them at
# once is what produces 429 RESOURCE_EXHAUSTED, which killed the trademark
# specialist outright in run 5160b864 even though the run itself survived.
#
# Two mitigations, both cheap:
#   1. More retry headroom than the SDK default of 6. 429 is transient, and
#      the logs show the built-in retry already rescuing ~20 of 23 hits.
#   2. A modest cap on how many Gemini calls are in flight at once, so the
#      five branches queue briefly instead of spiking the quota together.
#
# The cap does NOT change what the live tree shows: a specialist is marked
# "running" the moment its node starts, not when its LLM call is admitted,
# so all five still light up simultaneously.
GEMINI_MAX_RETRIES = 10
_GEMINI_SLOTS = asyncio.Semaphore(3)

# Applied to BOTH LLM calls. Model-written text (explanations, grounding
# reasoning) renders straight into the report UI, so the product's
# typography rules have to reach the model, not just our own source files.
NO_EM_DASH_RULE = """

WRITING STYLE (applies to every field you produce)
Never use the em dash character in any text you write. Use a comma, colon, \
period, or parentheses instead. This text is rendered directly in the \
product UI, which does not use that character anywhere.
"""

IDENTIFICATION_OUTPUT_RULE = NO_EM_DASH_RULE + """

You are identifying SUSPECTED risks only -- you are not deciding whether \
they are real precedent-backed risks; that decision happens later, and only \
from actual search results, not from you. Never state or imply in your \
explanation that a precedent definitely exists -- describe the concern, not \
a verdict. If nothing in this unit raises a plausible concern within your \
mandate, return an empty suspicions list. Do not invent a marginal concern \
just to have something to report -- a clean unit is a valid, expected result."""

GROUNDING_SYSTEM_PROMPT = """You are the grounding verifier for a content \
risk audit pipeline. You will be given one suspected risk and the REAL \
search results that were retrieved for it. Your only job is to decide \
whether any of those results actually document a real precedent for this \
SPECIFIC concern.

Hard rules -- these define what "grounded" means in this system:
- A source only counts as support if it is genuinely on point: it \
  describes a real case, controversy, lawsuit, complaint, or documented \
  incident that closely matches the specific concern described -- not just \
  the same broad category or general subject area.
- Running a search and getting results back does NOT mean the suspicion is \
  grounded. If none of the results substantiate this specific concern, you \
  MUST set grounded=false, even though results exist in front of you.
- You may only reference sources by their index in the list you were \
  given. Never restate a title, URL, or snippet from your own memory or \
  invention -- the system looks up the real text by the index you return, \
  so an index is the only thing that reaches the final report.
- If you are unsure whether a source really supports the concern, treat it \
  as not grounded rather than guessing in favor of the suspicion -- false \
  negatives (missed flags) are far cheaper than false positives \
  (fabricated-sounding precedent) for this product.
- grounded=false must come with matched_source_indices=[] and confidence=null.

CONFIDENCE CALIBRATION
Confidence must reflect how directly the retrieved source's ACTUAL FACTS \
match this specific scene's specific portrayal. Sharing a broad subject is \
not a match. Before choosing a level, work out what concretely happened in \
the source (who did what, to whom, in what setting) and what concretely \
happens in this scene, then compare those two things, not their topics.

- confidence="high" only when the source's actual facts closely parallel \
  what happens in this scene: a materially similar action, carried out in a \
  materially similar way, toward a materially similar target. If you would \
  have to explain away a difference in the action, the target, or the \
  setting in order to call it a match, it is not high.
- confidence="medium" when the connection is real but general: the source \
  documents the same kind of concern without matching this situation's \
  particulars. This is an honest and expected answer, not a weaker one. Say \
  plainly in your reasoning that the parallel is general rather than exact.
- A source that discusses the same general subject but a materially \
  different situation, action, or target is NOT strong confirmation. Do not \
  promote it to "high" merely because it is the closest thing the search \
  returned. A precedent does not become stronger because nothing better was \
  available.
- If you notice yourself building an argument for why a loosely related \
  source ought to count, treat that as the signal to mark it "medium", or \
  to mark it not grounded at all. Report the match you actually found, not \
  the one the suspicion was hoping for.""" + NO_EM_DASH_RULE


async def run_specialist(
    state: GraphState,
    specialist: SpecialistType,
    agent_status_key: str,
    system_prompt: str,
) -> dict:
    run_id = state["run_id"]
    write_agent_status(str(run_id), agent_status_key, "running")

    try:
        routed_unit_ids = {r["unit_id"] for r in state["routing"] if specialist in r["specialists"]}
        units = [u for u in state["units"] if u.id in routed_unit_ids]

        settings = get_settings()
        llm = ChatVertexAI(
            model=settings.gemini_model,
            project=settings.google_cloud_project,
            location=settings.vertex_location,
            max_retries=GEMINI_MAX_RETRIES,
            thinking_budget=settings.gemini_thinking_budget,
        )
        identifier = llm.with_structured_output(SuspicionList)
        verifier = llm.with_structured_output(GroundingVerdict)

        deep_verification = bool(state.get("deep_verification", False))
        deep_research = bool(state.get("deep_research", False))
        escalation_severities = _parse_severities(state.get("escalation_severities"))

        flags: list[RiskFlag] = []
        for unit in units:
            suspicions = await _identify_suspicions(identifier, system_prompt, unit.text)
            for suspicion in suspicions:
                flags.append(
                    await _ground_and_build_flag(
                        verifier, run_id, unit.id, specialist, suspicion,
                        deep_verification, deep_research, escalation_severities,
                    )
                )
    except Exception:
        # A single specialist failing (a transient LLM/Parallel API error,
        # for instance) must not take the whole run down with it -- the
        # graph fans out 3-5 of these concurrently, and the others, plus
        # the aggregator, should still be able to finish. Surface it as a
        # real error status rather than leaving the node stuck on
        # "running" forever with nothing explaining why.
        logger.exception("Specialist %s failed for run %s", agent_status_key, run_id)
        write_agent_status(str(run_id), agent_status_key, "error", output_count=0)
        return {"flags": []}

    write_agent_status(
        str(run_id),
        agent_status_key,
        "done",
        output_count=len(flags),
        sources=_collect_sources(flags),
    )
    return {"flags": flags}


def _collect_sources(flags: list[RiskFlag], cap: int = 6) -> list[dict]:
    """Dedup real grounding sources across every flag this specialist
    produced, by URL, capped for a compact Redis payload. This is what the
    live status view's info affordance shows -- never fabricated, always a
    subset of what was actually returned by Parallel."""
    seen: dict[str, dict] = {}
    for flag in flags:
        for source in flag.sources:
            seen.setdefault(str(source.source_url), source.model_dump(mode="json"))
    return list(seen.values())[:cap]


async def _identify_suspicions(identifier, system_prompt: str, unit_text: str) -> list[Suspicion]:
    queued_at = time.perf_counter()
    async with _GEMINI_SLOTS:
        admitted_at = time.perf_counter()
        result: SuspicionList = await identifier.ainvoke(
            [
                SystemMessage(content=system_prompt + IDENTIFICATION_OUTPUT_RULE),
                HumanMessage(content=unit_text),
            ]
        )
    done_at = time.perf_counter()
    # Split waiting-for-a-slot from actual model time: without this the two
    # are indistinguishable, and a slow run looks the same whether the cause
    # is our own concurrency cap or Vertex being slow.
    logger.info(
        "TIMING identify: wait=%.1fs call=%.1fs suspicions=%d",
        admitted_at - queued_at,
        done_at - admitted_at,
        len(result.suspicions),
    )
    return result.suspicions


async def _ground_and_build_flag(
    verifier,
    run_id: UUID,
    unit_id: UUID,
    specialist: SpecialistType,
    suspicion: Suspicion,
    deep_verification: bool = False,
    deep_research: bool = False,
    escalation_severities: set[Severity] | None = None,
) -> RiskFlag:
    search_started = time.perf_counter()
    search_results = await parallel_client.search(query=suspicion.search_query, run_id=str(run_id))
    logger.info(
        "TIMING parallel_search: %.1fs results=%d", time.perf_counter() - search_started, len(search_results)
    )

    if not search_results:
        # Nothing came back at all -- there is nothing to verify, and
        # therefore nothing to ground on. No LLM call needed; this is
        # unconfirmed by construction. The query and the zero count are
        # still recorded: "we asked this and got nothing" is a materially
        # different claim from "we never asked."
        return _build_flag(
            unit_id,
            specialist,
            suspicion,
            sources=[],
            grounded=False,
            results_seen=0,
            grounding_reasoning="Parallel returned no results for this query.",
        )

    queued_at = time.perf_counter()
    async with _GEMINI_SLOTS:
        admitted_at = time.perf_counter()
        verdict: GroundingVerdict = await verifier.ainvoke(
            [
                SystemMessage(content=GROUNDING_SYSTEM_PROMPT),
                HumanMessage(content=_render_verification_prompt(suspicion, search_results)),
            ]
        )
    logger.info(
        "TIMING verify: wait=%.1fs call=%.1fs",
        admitted_at - queued_at,
        time.perf_counter() - admitted_at,
    )

    sources = _resolve_matched_sources(search_results, verdict) if verdict.grounded else []
    if not sources:
        # Either the verifier said not grounded, or it claimed matches that
        # don't actually resolve to real entries -- either way, no real
        # source survives from the fast path. Before settling for
        # "unconfirmed", escalate the cases where being wrong is most
        # expensive (see TASK_API_ESCALATION_NOTE in parallel_task.py).
        escalated = await _maybe_deep_verify(
            specialist, suspicion, deep_verification, deep_research, escalation_severities
        )
        if escalated is not None and escalated.grounded and escalated.sources:
            return _build_flag(
                unit_id,
                specialist,
                suspicion,
                sources=escalated.sources,
                grounded=True,
                confidence=(
                    Confidence.HIGH if escalated.confidence_label == "high" else Confidence.MEDIUM
                ),
                results_seen=len(search_results),
                grounding_reasoning=escalated.reasoning,
                grounding_method=GroundingMethod.TASK_API,
                grounding_confidence_label=escalated.confidence_label,
            )

        # The verifier's own reasoning is kept: it is the answer to "you
        # searched, so why is there still no citation?"
        return _build_flag(
            unit_id,
            specialist,
            suspicion,
            sources=[],
            grounded=False,
            results_seen=len(search_results),
            grounding_reasoning=(escalated.reasoning if escalated is not None else verdict.reasoning),
            grounding_method=(
                GroundingMethod.TASK_API if escalated is not None else GroundingMethod.SEARCH_API
            ),
        )

    return _build_flag(
        unit_id,
        specialist,
        suspicion,
        sources=sources,
        grounded=True,
        confidence=Confidence.HIGH if verdict.confidence == "high" else Confidence.MEDIUM,
        results_seen=len(search_results),
        grounding_reasoning=verdict.reasoning,
        grounding_confidence_label=verdict.confidence,
    )


async def _maybe_deep_verify(
    specialist: SpecialistType,
    suspicion: Suspicion,
    requested_verification: bool = False,
    requested_research: bool = False,
    severities: set[Severity] | None = None,
):
    """Escalate to the Task API where it earns its latency cost: a concern
    the fast path could not ground. Everything else keeps the fast verdict.

    Two tiers, both opt-in per run (upload form) or globally via env:
    deep RESEARCH (pro/ultra processor, Parallel's "Deep Research" mode,
    materially slower) takes priority when requested, since it strictly
    subsumes deep VERIFICATION (the fast core-tier escalation).

    The two tiers also differ in REACH, not just processor. Deep
    verification stays high-severity-only, because the core tier is meant
    as a cheap targeted second look. Deep research also covers medium:
    someone who explicitly opts into the slowest path is asking for the
    ungrounded flags to be chased down, and gating it to high alone meant
    a run whose high-severity flags all grounded cleanly did no deep
    research at all and gave no sign why (observed on run 7816f6c3, where
    the only two ungrounded flags were medium and were silently skipped).
    Low severity stays excluded at both tiers: not worth minutes each."""
    settings = get_settings()

    research_on = requested_research or settings.enable_deep_research
    verification_on = requested_verification or settings.enable_task_api_verification
    if not (research_on or verification_on):
        return None

    # An explicit per-run choice from the upload form's advanced settings
    # always wins; otherwise fall back to each tier's built-in default.
    eligible = severities or ({Severity.HIGH, Severity.MEDIUM} if research_on else {Severity.HIGH})
    if suspicion.severity not in eligible:
        return None

    processor = settings.deep_research_processor if research_on else settings.task_api_processor
    timeout = settings.deep_research_timeout_seconds if research_on else settings.task_api_timeout_seconds

    logger.info(
        "Escalating ungrounded %s-severity %s flag to Parallel Task API (%s)",
        suspicion.severity.value,
        specialist.value,
        processor,
    )
    return await parallel_task.deep_verify(
        concern=suspicion.explanation,
        excerpt=suspicion.excerpt,
        mandate=specialist.value.replace("_", " "),
        processor=processor,
        timeout=timeout,
    )


def _parse_severities(raw) -> set[Severity] | None:
    """Turn the per-run severity choice into a Severity set. Returns None for
    anything empty or unrecognised so callers fall back to the tier default
    rather than silently escalating nothing."""
    if not raw:
        return None
    values = raw.split(",") if isinstance(raw, str) else raw
    out = {Severity(v.strip().lower()) for v in values if str(v).strip().lower() in ("low", "medium", "high")}
    return out or None


def _resolve_matched_sources(search_results: list[dict], verdict: GroundingVerdict) -> list[SourceObject]:
    """Turn the verifier's chosen indices back into real SourceObjects,
    reading strictly from the original retrieved results -- never from
    anything the model wrote itself. Out-of-range indices or malformed
    entries are silently dropped rather than trusted."""
    sources = []
    for i in verdict.matched_source_indices:
        if not (0 <= i < len(search_results)):
            continue
        try:
            sources.append(SourceObject(**search_results[i]))
        except ValidationError:
            continue
    return sources


def _build_flag(
    unit_id: UUID,
    specialist: SpecialistType,
    suspicion: Suspicion,
    *,
    sources: list[SourceObject],
    grounded: bool,
    confidence: Confidence = Confidence.LOW_UNGROUNDED,
    results_seen: int = 0,
    grounding_reasoning: str | None = None,
    grounding_method: GroundingMethod = GroundingMethod.SEARCH_API,
    grounding_confidence_label: str | None = None,
) -> RiskFlag:
    # The verifier's reasoning is kept as its own field rather than appended
    # into the explanation prose: it is evidence about the grounding, not
    # part of the analysis, and the report renders the two differently.
    return RiskFlag(
        unit_id=unit_id,
        specialist=specialist,
        excerpt=suspicion.excerpt,
        explanation=suspicion.explanation,
        severity=suspicion.severity,
        confidence=confidence,
        status=FlagStatus.GROUNDED if grounded else FlagStatus.UNCONFIRMED_SUSPICION,
        sources=sources,
        search_query=suspicion.search_query,
        results_seen=results_seen,
        grounding_reasoning=grounding_reasoning,
        grounding_method=grounding_method,
        grounding_confidence_label=grounding_confidence_label,
    )


def _render_verification_prompt(suspicion: Suspicion, search_results: list[dict]) -> str:
    listed = "\n\n".join(
        f"[{i}] title: {r.get('source_title', '')}\n"
        f"    url: {r.get('source_url', '')}\n"
        f"    type: {r.get('source_type', '')}\n"
        f"    snippet: {r.get('retrieved_snippet', '')}"
        for i, r in enumerate(search_results)
    )
    return (
        f"Suspected concern:\n{suspicion.explanation}\n\n"
        f'Excerpt that triggered it:\n"{suspicion.excerpt}"\n\n'
        f"Search query used: {suspicion.search_query}\n\n"
        f"Retrieved results:\n{listed}\n\n"
        "Which, if any, of these results genuinely document a real precedent "
        "for this specific concern? Remember: a result about the same general "
        "topic that doesn't actually match this situation does not count."
    )
