from fastapi import APIRouter
from os import getenv
from typing import List, Dict, Any
import asyncio
import time
import feedparser
import httpx
from cachetools import TTLCache

router = APIRouter()
_CACHE = TTLCache(maxsize=4, ttl=int(getenv("NEWS_CACHE_TTL_SECONDS", "900")))
_DEFAULTS = [
    "https://www.cisa.gov/news-events/cybersecurity-advisories/rss.xml",
    "https://www.ncsc.gov.uk/api/1/services/v1/news-rss-feed.xml",
    "https://krebsonsecurity.com/feed/",
]

KEYWORDS = ["phishing", "scam", "spoof", "credential", "malware", "ransomware", "invoice", "paypal", "bank", "business email compromise", "bec"]

def _tags(text: str) -> List[str]:
    """Extract relevant tags from text based on keywords."""
    t = text.lower()
    hits = [k for k in KEYWORDS if k in t]
    return hits or ["phishing"]

async def _fetch(client: httpx.AsyncClient, url: str) -> List[Dict[str, Any]]:
    """Fetch and parse a single RSS feed."""
    try:
        r = await client.get(url, timeout=10)
        r.raise_for_status()
        parsed = feedparser.parse(r.text)
        out = []
        
        for e in parsed.entries[:20]:  # Limit to 20 items per feed
            title = getattr(e, "title", "Untitled")
            link = getattr(e, "link", "#")
            published = getattr(e, "published", "") or getattr(e, "updated", "")
            summary = getattr(e, "summary", "")[:280]  # Truncate summary
            source = parsed.feed.get("title", url)
            
            out.append({
                "id": link,
                "title": title,
                "summary": summary,
                "link": link,
                "published": published,
                "source": source,
                "tags": _tags(title + " " + summary),
            })
        return out
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return []

@router.get("/news")
async def news():
    """Fetch and return news items from RSS feeds with caching."""
    if "news" in _CACHE:
        return _CACHE["news"]

    urls = [u.strip() for u in (getenv("NEWS_RSS_FEEDS", "").split(",") if getenv("NEWS_RSS_FEEDS") else _DEFAULTS) if u.strip()]
    items: List[Dict[str, Any]] = []
    
    async with httpx.AsyncClient() as client:
        res = await asyncio.gather(*[_fetch(client, u) for u in urls], return_exceptions=True)
        for chunk in res:
            if isinstance(chunk, list):
                items.extend(chunk)

    # Sort by published date (best-effort)
    def ts(x):
        try:
            return time.mktime(feedparser.parse(x.get("published", "")).updated_parsed or time.gmtime(0))
        except:
            return 0
    
    items.sort(key=ts, reverse=True)
    _CACHE["news"] = items
    return items
