"""
Feasibility Agent  (Backend-1 — yours to implement)
----------------------------------------------------
Input:  state["candidate_providers"], state["structured_request"]["requested_time"]
Output: state["feasible_providers"]  (subset that is open + reachable in time)

TODO:
  1. For each candidate, look up the opening hours for the requested day
  2. Compute ETA using eta_minutes() from services/geo.py
  3. Check: arrival time < closing time AND at least MIN_OPEN_BUFFER_MINUTES remaining
  4. Add a human-readable "time_label" to each passing provider (e.g. "~8 min away")
  5. Call add_step() to log the trace

Hint: opening_hours keys are "mon","tue","wed","thu","fri","sat","sun"
      values are "HH:MM-HH:MM" strings or null if closed
"""
import time
from datetime import datetime

from app.agents.state import PlannerState
from app.agents.trace import add_step
from app.services.geo import eta_minutes

TRAVEL_SPEED_KMH = 20.0
MIN_OPEN_BUFFER_MINUTES = 15


def _parse_hours(hours_str: str) -> tuple[int, int] | None:
    """Parse 'HH:MM-HH:MM', return (close_hour*60+close_min, open_total) or None."""
    try:
        open_str, close_str = hours_str.split("-")
        oh, om = map(int, open_str.split(":"))
        ch, cm = map(int, close_str.split(":"))
        return oh * 60 + om, ch * 60 + cm
    except Exception:
        return None


def _check_provider(provider: dict, requested_dt: datetime) -> tuple[bool, str]:
    """Return (is_feasible, time_label)."""
    day_key = requested_dt.strftime("%a").lower()  # "mon", "tue", ...
    hours_str = provider.get("opening_hours", {}).get(day_key)

    if not hours_str:
        return False, "closed today"

    parsed = _parse_hours(hours_str)
    if not parsed:
        return True, "open"

    open_total, close_total = parsed
    req_total = requested_dt.hour * 60 + requested_dt.minute
    dist_km = provider.get("distance_km", 0)
    travel = eta_minutes(dist_km, TRAVEL_SPEED_KMH)
    arrival = req_total + travel

    if req_total < open_total:
        return False, "not yet open"
    if arrival > close_total:
        return False, f"closes before you arrive"

    remaining = close_total - arrival
    if remaining < MIN_OPEN_BUFFER_MINUTES:
        label = f"closing soon — only {remaining} min after arrival"
    elif travel <= 10:
        label = f"~{travel} min away"
    else:
        label = f"~{travel} min away"

    return True, label


def run(state: PlannerState) -> PlannerState:
    start = time.time() * 1000
    req = state["structured_request"]
    requested_dt = datetime.fromisoformat(req["requested_time"])

    feasible = []
    for p in state["candidate_providers"]:
        ok, label = _check_provider(p, requested_dt)
        if ok:
            p["time_label"] = label
            feasible.append(p)

    state["feasible_providers"] = feasible
    if len(feasible) == 0:
        state["retry_count"] = state.get("retry_count", 0) + 1
    state["trace"] = add_step(
        state["trace"],
        agent="feasibility",
        input_data={"candidates": len(state["candidate_providers"])},
        output_data={"feasible": len(feasible)},
        start_ms=start,
    )
    return state
