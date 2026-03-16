"""
Crawl real stores in Zurich via Apify and write backend/seed/zurich_providers.json.

Uses APIFY_API_TOKEN from .env. Run from backend directory:
  python -m scripts.crawl_zurich_seed

Searches multiple categories (hair salon, massage, dentist, repair, restaurant),
deduplicates by placeId, transforms to provider schema, and overwrites the seed file.
"""
import json
import sys
from pathlib import Path

# Run from backend; add parent to path so app imports work
backend = Path(__file__).resolve().parent.parent
if str(backend) not in sys.path:
    sys.path.insert(0, str(backend))

from dotenv import load_dotenv
load_dotenv(backend / ".env")

from app.config import APIFY_API_TOKEN
from app.services.apify_search import search_places
from app.agents.crawling_search import transform_apify_result

# Zurich HB (Hauptbahnhof)
ZURICH_LAT = 47.3779
ZURICH_LNG = 8.5402
RADIUS_KM = 2.0
MAX_PER_SEARCH = 12

# Search term -> seed category (restaurant, cafe, bar as distinct tags)
SEARCHES = [
    ("restaurant", "restaurant"),
    ("restaurants", "restaurant"),
    ("cafe", "cafe"),
    ("coffee shop", "cafe"),
    ("bar", "bar"),
    ("bars", "bar"),
]


def main() -> None:
    if not APIFY_API_TOKEN:
        raise SystemExit(
            "APIFY_API_TOKEN is not set. Add it to backend/.env and run again."
        )

    seen_ids: set[str] = set()
    all_providers: list[dict] = []

    for term, category in SEARCHES:
        print(f"Crawling: {term!r} -> category {category!r} ...")
        raw = search_places(
            term=term,
            lat=ZURICH_LAT,
            lng=ZURICH_LNG,
            radius_km=RADIUS_KM,
            max_results=MAX_PER_SEARCH,
        )
        for r in raw:
            pid = r.get("placeId") or r.get("cid") or (r.get("title") or r.get("name") or "")
            if pid in seen_ids:
                continue
            seen_ids.add(pid)
            p = transform_apify_result(r, ZURICH_LAT, ZURICH_LNG)
            p["category"] = category
            all_providers.append(p)
        print(f"  -> {len(raw)} results, total unique so far: {len(all_providers)}")

    # Build seed-compatible list: same keys as current zurich_providers.json
    seed_data = []
    for i, p in enumerate(all_providers, start=1):
        seed_data.append({
            "id": f"p{i:03d}",
            "name": p["name"],
            "category": p["category"],
            "location": p["location"],
            "address": p.get("address") or "",
            "rating": p["rating"],
            "review_count": p["review_count"],
            "price_range": p.get("price_range") or "",
            "opening_hours": p["opening_hours"],
            "website_url": p.get("website_url"),
            "google_maps_url": p.get("google_maps_url") or "",
            "images": p.get("images") or [],
            "reviews": p.get("reviews") or [],
        })

    out_path = backend / "seed" / "zurich_providers.json"
    out_path.write_text(
        json.dumps(seed_data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote {len(seed_data)} providers to {out_path}")


if __name__ == "__main__":
    main()
