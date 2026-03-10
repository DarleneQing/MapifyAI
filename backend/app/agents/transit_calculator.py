"""
Crawling Agent Sub-2 — Transit Calculator (SBB public transport ETA).

Input:  state["candidate_providers"]  (stores from Sub-1, already filtered by opening hours)
        state["structured_request"]   (user location, requested_time, constraints)
Output: state["candidate_providers"]  (enriched with transit_info + reachability_status,
                                       unreachable providers removed)

Pipeline position: runs after crawling_search (Sub-1), before feasibility/ranking.
"""
import logging
import time
from datetime import datetime, timedelta

from app.agents.state import PlannerState
from app.agents.trace import add_step
from app.services.swiss_transit import get_transit_eta, TransitResult
from app.services.geo import haversine_km, eta_minutes

logger = logging.getLogger(__name__)

CLOSING_SOON_THRESHOLD_MINUTES = 30
HAVERSINE_FALLBACK_SPEED = 20.0


def get_closing_minutes(opening_hours: dict, requested_dt: datetime) -> int | None:
    """
    Extract the closing time as minutes-from-midnight for the requested day.

    For late-night venues that close past midnight (e.g. "17:00-02:00"),
    returns >1440 (e.g. 26*60 = 1560 for 02:00 next day).
    Returns None if the store is closed on the requested day.
    """
    day_key = requested_dt.strftime("%a").lower()
    hours_str = opening_hours.get(day_key)

    if not hours_str:
        return None

    try:
        open_str, close_str = hours_str.split("-")
        oh, om = map(int, open_str.split(":"))
        ch, cm = map(int, close_str.split(":"))
    except (ValueError, IndexError):
        return None

    open_total = oh * 60 + om
    close_total = ch * 60 + cm

    if close_total <= open_total:
        close_total += 24 * 60

    return close_total


def determine_reachability(
    transit: TransitResult,
    closing_minutes: int | None,
) -> str:
    """
    Classify provider reachability:
      - "reachable":     arrives well before closing
      - "closing_soon":  arrives within CLOSING_SOON_THRESHOLD of closing
      - "unreachable":   arrives after closing
    """
    if closing_minutes is None:
        return "reachable"

    try:
        arrival_dt = datetime.fromisoformat(transit.arrival_time)
        arrival_total = arrival_dt.hour * 60 + arrival_dt.minute
    except (ValueError, TypeError):
        return "reachable"

    remaining = closing_minutes - arrival_total
    if remaining <= 0:
        return "unreachable"
    if remaining <= CLOSING_SOON_THRESHOLD_MINUTES:
        return "closing_soon"
    return "reachable"


def _make_fallback_transit(provider: dict, departure_time: datetime) -> dict:
    """Build a minimal transit_info dict from haversine distance when API is unreachable."""
    dist = provider.get("distance_km", 0)
    minutes = eta_minutes(dist, HAVERSINE_FALLBACK_SPEED)
    arrival = departure_time + timedelta(minutes=minutes)
    return {
        "duration_minutes": minutes,
        "departure_time": departure_time.isoformat(),
        "arrival_time": arrival.isoformat(),
        "transport_types": ["estimated"],
        "num_transfers": 0,
    }


def run(state: PlannerState) -> PlannerState:
    """Agent entry point — enrich candidates with SBB transit info, filter by reachability."""
    start = time.time() * 1000
    req = state["structured_request"]
    user_loc = req["location"]
    requested_dt = datetime.fromisoformat(req["requested_time"])
    candidates = state["candidate_providers"]

    enriched: list[dict] = []
    stats = {"total": len(candidates), "reachable": 0, "closing_soon": 0, "unreachable": 0, "api_failures": 0}

    for provider in candidates:
        store_loc = provider["location"]

        transit = get_transit_eta(
            user_loc["lat"], user_loc["lng"],
            store_loc["lat"], store_loc["lng"],
            requested_dt,
        )

        if transit is None:
            stats["api_failures"] += 1
            provider["transit_info"] = _make_fallback_transit(provider, requested_dt)
            transit_for_reachability = TransitResult(
                duration_minutes=provider["transit_info"]["duration_minutes"],
                departure_time=provider["transit_info"]["departure_time"],
                arrival_time=provider["transit_info"]["arrival_time"],
                transport_types=["estimated"],
                num_transfers=0,
            )
        else:
            provider["transit_info"] = {
                "duration_minutes": transit.duration_minutes,
                "departure_time": transit.departure_time,
                "arrival_time": transit.arrival_time,
                "transport_types": transit.transport_types,
                "num_transfers": transit.num_transfers,
            }
            transit_for_reachability = transit

        closing = get_closing_minutes(provider.get("opening_hours", {}), requested_dt)
        status = determine_reachability(transit_for_reachability, closing)
        provider["reachability_status"] = status

        if status == "unreachable":
            stats["unreachable"] += 1
        else:
            if status == "closing_soon":
                stats["closing_soon"] += 1
            else:
                stats["reachable"] += 1
            enriched.append(provider)

    state["candidate_providers"] = enriched
    state["trace"] = add_step(
        state["trace"],
        agent="transit_calculator",
        input_data={"candidates": stats["total"]},
        output_data={
            "reachable": stats["reachable"],
            "closing_soon": stats["closing_soon"],
            "unreachable": stats["unreachable"],
            "api_failures": stats["api_failures"],
        },
        start_ms=start,
    )
    return state
