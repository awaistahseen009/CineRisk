"""
Best-effort fetch of a source page's og:image (or twitter:image) meta tag,
so real source citations can show a real preview image when one exists.

This is deliberately fragile-tolerant: any failure (timeout, 4xx/5xx,
malformed HTML, no such tag) just returns None, never raises. A missing
preview image is a normal, expected outcome (a lot of legal filings and
plain-text pages have no og:image at all) -- it must never block or fail
the grounding pipeline, and it must never be faked. Uses only the stdlib
HTML parser (no BeautifulSoup dependency) since we only need one attribute
off one tag.
"""
import logging
from html.parser import HTMLParser

import httpx

logger = logging.getLogger(__name__)

OG_IMAGE_TIMEOUT_SECONDS = 2.5
# og:image and friends always live in <head>; capping how much of the
# response we even read keeps this fast and bounds memory on large pages.
MAX_HTML_BYTES = 80_000


class _OpenGraphImageParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.image_url: str | None = None
        self._in_head = False
        self._head_closed = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "head":
            self._in_head = True
        if self._head_closed or tag != "meta":
            return
        attr_dict = dict(attrs)
        prop = (attr_dict.get("property") or attr_dict.get("name") or "").lower()
        content = attr_dict.get("content")
        if prop in ("og:image", "og:image:url", "twitter:image") and content and not self.image_url:
            self.image_url = content

    def handle_endtag(self, tag: str) -> None:
        if tag == "head":
            self._head_closed = True


async def fetch_og_image(url: str) -> str | None:
    """Fetch `url` and return its og:image/twitter:image content, or None
    on any failure. Never raises."""
    try:
        async with httpx.AsyncClient(
            timeout=OG_IMAGE_TIMEOUT_SECONDS, follow_redirects=True
        ) as client:
            response = await client.get(
                url,
                headers={"User-Agent": "Mozilla/5.0 (compatible; CineRiskBot/1.0; +grounding-preview)"},
            )
            response.raise_for_status()
            html = response.text[:MAX_HTML_BYTES]
    except Exception as exc:  # noqa: BLE001 -- best-effort by design, see module docstring
        logger.debug("og:image fetch failed for %s: %s", url, exc)
        return None

    parser = _OpenGraphImageParser()
    try:
        parser.feed(html)
    except Exception as exc:  # noqa: BLE001 -- malformed HTML must not propagate
        logger.debug("og:image parse failed for %s: %s", url, exc)
        return None

    return parser.image_url
