"""
Shared Parallel search implementation, used both by the MCP tool
(parallel_server.py, exposed to any MCP-speaking client) and directly by
LangGraph specialist nodes running in-process.

Uses the official `parallel-web` Python SDK (`pip install parallel-web`,
`from parallel import AsyncParallel`) against `POST /v1/search` -- confirmed
against docs.parallel.ai/api-reference/search/search and the SDK's generated
types (client_search_params.py / search_result.py / web_search_result.py) as
of Sep 2026:

  request:  search_queries: list[str] (required, >=1)
            advanced_settings: {max_results, ...} (optional)
  response: SearchResult.results: list[WebSearchResult]
            WebSearchResult: url, title | None, publish_date | None,
                              excerpts: list[str]

Parallel does not classify source type itself, so _infer_source_type is
still our own best-effort heuristic from the domain.
"""
import asyncio
import logging

from parallel import AsyncParallel

from app.cache.redis_client import get_cached_search, set_cached_search
from app.core.config import get_settings
from app.mcp.og_image import fetch_og_image

logger = logging.getLogger(__name__)

# Observed in practice: under the real concurrent load of 3-5 specialists
# fanning out search calls at once, Parallel intermittently returns
# AuthenticationError ("no API key provided") on a request built with the
# same key that a lone, isolated call always succeeds with. The SDK's own
# built-in retry (max_retries=2) doesn't cover this -- 401 isn't in its
# default retryable set, since a 401 is normally a real, non-transient auth
# failure. This one demonstrably isn't, so we retry it ourselves.
MAX_ATTEMPTS = 4
RETRY_BASE_DELAY_SECONDS = 1.5


def get_client() -> AsyncParallel:
    # Deliberately not cached/shared across calls -- see the retry note
    # above; a fresh client per attempt also rules out any lingering
    # per-connection state as a contributing factor.
    settings = get_settings()
    return AsyncParallel(api_key=settings.parallel_api_key)


async def search(query: str, run_id: str, max_results: int = 5) -> list[dict]:
    """Search the real web via Parallel for grounding evidence.

    Returns a list of dicts shaped like SourceObject candidates:
    {source_title, source_url, source_type, retrieved_snippet}.
    Callers MUST only cite results actually returned here -- never fabricate
    a source (Feature 5: Grounded Citation Requirement).
    """
    cached = get_cached_search(run_id, query)
    if cached is not None:
        return cached[:max_results]

    response = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            response = await get_client().search(
                search_queries=[query],
                advanced_settings={"max_results": max_results},
            )
            break
        except Exception as exc:
            if attempt == MAX_ATTEMPTS:
                raise
            logger.warning(
                "Parallel search attempt %d/%d failed (%s) for run %s, retrying...",
                attempt,
                MAX_ATTEMPTS,
                exc,
                run_id,
            )
            await asyncio.sleep(RETRY_BASE_DELAY_SECONDS * attempt)

    raw_results = response.results
    # Fetched concurrently, not sequentially -- with max_results up to 5,
    # doing this one-at-a-time would multiply the search's latency by up
    # to 5x. In parallel, the added wall-clock cost is bounded by the
    # single OG_IMAGE_TIMEOUT_SECONDS ceiling regardless of how many
    # results there are.
    image_urls = await asyncio.gather(*(fetch_og_image(r.url) for r in raw_results))

    results = [
        {
            "source_title": r.title or r.url,
            "source_url": r.url,
            "source_type": _infer_source_type(r.url),
            "retrieved_snippet": "\n\n".join(r.excerpts) if r.excerpts else "",
            "image_url": image_url,
        }
        for r, image_url in zip(raw_results, image_urls)
    ]

    set_cached_search(run_id, query, results)
    return results


def _infer_source_type(url: str) -> str:
    """Best-effort classification from the domain; specialists may reason
    about it further from the excerpt content."""
    lowered = url.lower()
    if any(d in lowered for d in ("courtlistener", "justia", "law360", ".gov")):
        return "legal_filing"
    if any(d in lowered for d in ("variety.com", "hollywoodreporter", "deadline.com")):
        return "entertainment_press"
    if any(d in lowered for d in ("aclu.org", "naacp.org", "adl.org")):
        return "advocacy_statement"
    return "news_article"
