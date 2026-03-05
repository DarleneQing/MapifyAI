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
import time

from app.agents.state import PlannerState
from app.agents.trace import add_step
from app.services.geo import haversine_km
# from app.models.db import get_db


def run(state: PlannerState) -> PlannerState:
    start = time.time() * 1000
    req = state["structured_request"]
    loc = req["location"]
    radius = req.get("radius_km", 5.0)
    category = req.get("category", "")

    # TODO: replace stub with real DB query
    # db = get_db()
    # result = db.table("providers").select("*").eq("category", category).execute()
    # providers = result.data or []

    providers = []  # stub

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
