"""
Parallel's research API wrapped as an MCP tool server (FastMCP).

This is what keeps "actual runtime use of Parallel" unambiguous in the code:
every specialist agent node calls this tool (directly, or via MCP for
out-of-process clients) rather than hitting Gemini's own world knowledge, so
every risk flag can be traced back to a real search result (Feature 5).

Run standalone for local dev / MCP inspection:
    python -m app.mcp.parallel_server
"""
from fastmcp import FastMCP

from app.mcp import parallel_client

mcp = FastMCP("cinerisk-parallel")


@mcp.tool()
async def parallel_search(query: str, run_id: str, max_results: int = 5) -> list[dict]:
    """Search the real web via Parallel for grounding evidence.

    Args:
        query: The precedent/evidence search query (e.g. "lawsuit real person
            fictional character resemblance right of publicity").
        run_id: The current audit run id, used to scope result caching so
            overlapping specialist queries within one run don't re-hit the API.
        max_results: Max number of results to return.

    Returns:
        A list of dicts shaped like SourceObject candidates:
        {source_title, source_url, source_type, retrieved_snippet}.
        Specialist agents MUST only cite results actually returned here --
        never fabricate a source.
    """
    return await parallel_client.search(query, run_id, max_results)


if __name__ == "__main__":
    mcp.run()
