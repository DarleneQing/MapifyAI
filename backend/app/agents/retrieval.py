"""
Provider Retrieval Agent  (Backend-1 — yours to implement)
-----------------------------------------------------------
Input:  state["structured_request"]  (category, location, radius_km)
Output: state["candidate_providers"]  list of Provider dicts

TODO:
  1. Query Supabase `providers` table filtered by category
  2. For each result compute distance using haversine_km() from services/geo.py
  3. Keep only providers within radius_km
  4. Sort by distance ascending
  5. Call add_step() to log the trace
"""
import json
import time
from pathlib import Path

from app.agents.state import PlannerState
from app.agents.trace import add_step
from app.services.geo import haversine_km

SEED_FILE = Path(__file__).parent.parent.parent / "seed" / "zurich_providers.json"


def _load_providers(category: str) -> list[dict]:
    """Load from seed file. Swap for DB query when Backend-2 is ready."""
    providers = json.loads(SEED_FILE.read_text())
    if category and category != "general":
        providers = [p for p in providers if p.get("category") == category]
    return providers


def run(state: PlannerState) -> PlannerState:
    start = time.time() * 1000
    req = state["structured_request"]
    loc = req["location"]
    radius = req.get("radius_km", 5.0)
    category = req.get("category", "")

    providers = _load_providers(category)

    candidates = []
    for p in providers:
        dist = haversine_km(loc["lat"], loc["lng"], p["location"]["lat"], p["location"]["lng"])
        if dist <= radius:
            p["distance_km"] = round(dist, 2)
            candidates.append(p)

    candidates.sort(key=lambda p: p["distance_km"])

    state["candidate_providers"] = candidates
    state["trace"] = add_step(
        state["trace"],
        agent="retrieval",
        input_data={"category": category, "location": loc, "radius_km": radius},
        output_data={"count": len(candidates)},
        start_ms=start,
    )
    return state
