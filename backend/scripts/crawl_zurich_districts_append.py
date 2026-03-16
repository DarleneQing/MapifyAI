"""
Crawl additional Zurich districts via Apify and APPEND to existing seed.

Districts:
- Altstetten
- Oerlikon
- Stadelhofen

Categories per district:
- restaurant
- cafe
- bar
- hair salon (haircut)
- massage

Does not replace existing data. New entries get ids continuing after existing
and are placed before the existing providers in the seed file.

Run from backend directory:

  python -m scripts.crawl_zurich_districts_append

Reads backend/seed/zurich_providers.json, crawls the above districts,
dedupes by placeId and by (name, lat, lng), then writes:
  [new_entries] + [existing_entries]
"""

import json
import sys
from pathlib import Path
from typing import Iterable

backend = Path(__file__).resolve().parent.parent
if str(backend) not in sys.path:
  sys.path.insert(0, str(backend))

from dotenv import load_dotenv

load_dotenv(backend / ".env")

from app.config import APIFY_API_TOKEN
from app.services.apify_search import search_places
from app.agents.crawling_search import transform_apify_result

SEED_PATH = backend / "seed" / "zurich_providers.json"

# District centres (approx)
DISTRICTS: list[tuple[str, float, float]] = [
  ("Altstetten", 47.3850, 8.4772),
  ("Oerlikon", 47.4167, 8.5500),
  ("Stadelhofen", 47.366666666667, 8.5486111111111),
  ("Hardbrücke", 47.3850, 8.5170),
]

RADIUS_KM = 2.0
MAX_PER_SEARCH = 12

# Search term -> seed category
SEARCHES: list[tuple[str, str]] = [
  ("restaurant", "restaurant"),
  ("restaurants", "restaurant"),
  ("cafe", "cafe"),
  ("coffee shop", "cafe"),
  ("bar", "bar"),
  ("bars", "bar"),
  ("hair salon", "haircut"),
  ("massage", "massage"),
]


def provider_to_seed_entry(p: dict, id_str: str) -> dict:
  return {
    "id": id_str,
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
  }


def iter_existing_name_locs(existing: Iterable[dict]) -> set[tuple[str | None, float | None, float | None]]:
  out: set[tuple[str | None, float | None, float | None]] = set()
  for e in existing:
    loc = e.get("location") or {}
    out.add((e.get("name"), loc.get("lat"), loc.get("lng")))
  return out


def main() -> None:
  if not APIFY_API_TOKEN:
    raise SystemExit("APIFY_API_TOKEN is not set. Add it to backend/.env and run again.")

  # Load existing seed (may be empty)
  existing: list[dict] = []
  if SEED_PATH.exists():
    existing = json.loads(SEED_PATH.read_text(encoding="utf-8"))
    print(f"Loaded {len(existing)} existing providers from seed.")

  seen_ids: set[str] = set()
  existing_by_name_loc = iter_existing_name_locs(existing)

  new_providers: list[dict] = []

  for district_name, lat, lng in DISTRICTS:
    print(f"=== District: {district_name} ({lat}, {lng}) ===")
    for term, category in SEARCHES:
      print(f"  Crawling: {term!r} -> category {category!r} ...")
      raw = search_places(
        term=term,
        lat=lat,
        lng=lng,
        radius_km=RADIUS_KM,
        max_results=MAX_PER_SEARCH,
      )
      for r in raw:
        pid = r.get("placeId") or r.get("cid") or (r.get("title") or r.get("name") or "")
        if not pid or pid in seen_ids:
          continue
        p = transform_apify_result(r, lat, lng)
        p["category"] = category
        loc = p.get("location") or {}
        key = (p.get("name"), loc.get("lat"), loc.get("lng"))
        if key in existing_by_name_loc:
          continue
        seen_ids.add(pid)
        existing_by_name_loc.add(key)
        new_providers.append(p)
      print(f"    -> {len(raw)} results, new unique so far: {len(new_providers)}")

  # Append new entries before existing; ids continue after existing
  start_id = len(existing) + 1
  seed_data: list[dict] = []
  for i, p in enumerate(new_providers, start=start_id):
    seed_data.append(provider_to_seed_entry(p, f"p{i:03d}"))
  seed_data.extend(existing)

  SEED_PATH.write_text(
    json.dumps(seed_data, indent=2, ensure_ascii=False),
    encoding="utf-8",
  )
  print(
    f"Appended {len(new_providers)} new providers "
    f"(ids p{start_id:03d}–p{start_id + len(new_providers) - 1:03d}). "
    f"Total: {len(seed_data)}. Wrote to {SEED_PATH}"
  )


if __name__ == "__main__":
  main()

