"""
Upstash Redis client (REST-based, via the official `upstash-redis` SDK --
takes the UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN pair straight
from the Upstash dashboard's "REST API" tab, no separate TCP connection
string needed, and fits Cloud Run's scale-to-zero model better than a
persistent socket). Used for two distinct purposes described in the spec:

1. Search-result cache: overlapping specialist queries on the same/related
   terms within a run should not re-hit the Parallel API.
2. Live per-agent status: each LangGraph node writes its start/finish state
   here as it runs; the frontend's Live Agent Status View polls/streams it.
"""
import json
from functools import lru_cache

from upstash_redis import Redis

from app.core.config import get_settings

SEARCH_CACHE_TTL_SECONDS = 60 * 60  # 1 hour, scoped to a run's lifetime
RUN_STATUS_TTL_SECONDS = 60 * 60 * 6


@lru_cache
def get_redis() -> Redis:
    settings = get_settings()
    return Redis(url=settings.upstash_redis_rest_url, token=settings.upstash_redis_rest_token)


def _search_cache_key(run_id: str, query: str) -> str:
    return f"cinerisk:search:{run_id}:{query}"


def get_cached_search(run_id: str, query: str) -> list[dict] | None:
    raw = get_redis().get(_search_cache_key(run_id, query))
    return json.loads(raw) if raw else None


def set_cached_search(run_id: str, query: str, results: list[dict]) -> None:
    get_redis().set(
        _search_cache_key(run_id, query), json.dumps(results), ex=SEARCH_CACHE_TTL_SECONDS
    )


def _run_status_key(run_id: str) -> str:
    return f"cinerisk:run_status:{run_id}"


def write_agent_status(
    run_id: str,
    agent: str,
    state: str,
    output_count: int | None = None,
    sources: list[dict] | None = None,
) -> None:
    """Called by each LangGraph node on start/finish. The whole run's status
    is kept as one JSON blob (read-modify-write) so the frontend can fetch
    the entire pipeline's state in a single round trip.

    `sources` (only meaningful on a "done" write) carries the real, capped
    SourceObject list this agent actually found -- this is what lets the
    live status view's info affordance show real grounding data mid-run
    instead of a placeholder.

    Note: this read-modify-write is only safe without interleaving because
    neither the get nor the set awaits anything, so within one asyncio event
    loop nothing else can run between them. It would need to become a real
    hash write (HSET) or a Lua/transaction if this ever runs across multiple
    processes/workers concurrently updating the same run.
    """
    redis = get_redis()
    key = _run_status_key(run_id)
    raw = redis.get(key)
    statuses = json.loads(raw) if raw else {}
    statuses[agent] = {"state": state, "output_count": output_count, "sources": sources or []}
    redis.set(key, json.dumps(statuses), ex=RUN_STATUS_TTL_SECONDS)


def read_run_status(run_id: str) -> dict[str, dict]:
    raw = get_redis().get(_run_status_key(run_id))
    return json.loads(raw) if raw else {}
