"""
Swiss public transport client — transport.opendata.ch + haversine fallback.

Provides transit ETA between two WGS84 coordinate pairs using:
  1. transport.opendata.ch  (GET /v1/connections)  — free, no auth, CORS-enabled
  2. Haversine-based estimate                      — offline fallback

API docs: https://transport.opendata.ch/docs.html
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta

import httpx
from pydantic import BaseModel

from app.services.geo import haversine_km

logger = logging.getLogger(__name__)

OPENDATA_BASE_URL = "https://transport.opendata.ch/v1"
HTTP_TIMEOUT_SECONDS = 3   # fail fast — haversine fallback takes over immediately
HAVERSINE_FALLBACK_SPEED_KMH = 20.0

# Circuit breaker: once a ConnectTimeout or ConnectError is observed, skip all
# further API attempts within this process lifetime and fall back to haversine.
# Prevents N*timeout seconds of blocking when the API is unreachable.
_api_reachable: bool = True

CATEGORY_TO_MODE = {
    "s": "train",
    "ic": "train",
    "ir": "train",
    "ice": "train",
    "re": "train",
    "ec": "train",
    "r": "train",
    "rj": "train",
    "tgv": "train",
    "bus": "bus",
    "nfb": "bus",
    "tram": "tram",
    "t": "tram",
    "bat": "ship",
    "fun": "cableway",
}


class TransitResult(BaseModel):
    duration_minutes: int
    departure_time: str
    arrival_time: str
    transport_types: list[str]
    num_transfers: int


# ---------------------------------------------------------------------------
# Parsing helpers
# ---------------------------------------------------------------------------

def _parse_duration_string(raw: str | None) -> int | None:
    """Parse transport.opendata.ch duration format like '00d00:27:00' to minutes."""
    if not raw:
        return None
    match = re.match(r"(\d+)d(\d{2}):(\d{2}):(\d{2})", raw)
    if not match:
        return None
    days, hours, minutes, _ = (int(g) for g in match.groups())
    return days * 24 * 60 + hours * 60 + minutes


def _normalize_category(category: str) -> str:
    """Map a transport category string to a standard mode name."""
    return CATEGORY_TO_MODE.get(category.strip().lower(), category.strip().lower())


def _extract_transport_types(sections: list[dict] | None) -> list[str]:
    """Extract unique transport modes from opendata.ch connection sections."""
    if not sections:
        return []
    modes: list[str] = []
    for sec in sections:
        journey = sec.get("journey")
        if not journey:
            continue
        cat = journey.get("category", "")
        mode = _normalize_category(cat)
        if mode and mode not in modes:
            modes.append(mode)
    return modes


# ---------------------------------------------------------------------------
# Connection parser
# ---------------------------------------------------------------------------

def parse_opendata_connection(conn: dict) -> TransitResult | None:
    """Parse a single connection from transport.opendata.ch /v1/connections."""
    departure = (conn.get("from") or {}).get("departure")
    arrival = (conn.get("to") or {}).get("arrival")
    if not departure or not arrival:
        return None

    duration = _parse_duration_string(conn.get("duration"))
    if duration is None:
        return None

    sections = conn.get("sections") or []
    transport_types = _extract_transport_types(sections)
    pt_legs = [s for s in sections if s.get("journey")]
    num_transfers = max(0, len(pt_legs) - 1)

    return TransitResult(
        duration_minutes=duration,
        departure_time=departure,
        arrival_time=arrival,
        transport_types=transport_types,
        num_transfers=num_transfers,
    )


# ---------------------------------------------------------------------------
# Station lookup
# ---------------------------------------------------------------------------

def find_nearest_station(lat: float, lng: float) -> dict | None:
    """
    Find nearest public transport station via transport.opendata.ch /v1/locations.

    The ``type`` query parameter only works with ``query``, not with
    coordinate look-ups, so the response may contain addresses and POIs
    whose ``id`` is None.  We filter those out ourselves.
    """
    global _api_reachable
    if not _api_reachable:
        return None

    try:
        resp = httpx.get(
            f"{OPENDATA_BASE_URL}/locations",
            params={"x": lat, "y": lng},
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()
        stations = data.get("stations") or []
        for s in stations:
            if s.get("id"):
                return {"id": s["id"], "name": s.get("name", "")}
        return None
    except (httpx.ConnectTimeout, httpx.ConnectError) as exc:
        logger.warning(
            "transport.opendata.ch unreachable (%.4f, %.4f) — disabling API for this process: %s",
            lat, lng, exc,
        )
        _api_reachable = False
        return None
    except Exception:
        logger.warning("Failed to find nearest station for (%.4f, %.4f)", lat, lng, exc_info=True)
        return None


# ---------------------------------------------------------------------------
# API query
# ---------------------------------------------------------------------------

def _query_opendata_api(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    departure_time: datetime,
) -> TransitResult | None:
    """Query transport.opendata.ch GET /v1/connections via station lookup."""
    if not _api_reachable:
        return None

    try:
        origin_station = find_nearest_station(origin_lat, origin_lng)
        dest_station = find_nearest_station(dest_lat, dest_lng)
        if not origin_station or not dest_station:
            return None

        resp = httpx.get(
            f"{OPENDATA_BASE_URL}/connections",
            params={
                "from": origin_station["id"],
                "to": dest_station["id"],
                "date": departure_time.strftime("%Y-%m-%d"),
                "time": departure_time.strftime("%H:%M"),
                "limit": 1,
            },
            timeout=HTTP_TIMEOUT_SECONDS,
        )
        resp.raise_for_status()
        data = resp.json()
        connections = data.get("connections") or []
        if not connections:
            return None
        return parse_opendata_connection(connections[0])
    except Exception:
        logger.warning("OpenData API call failed", exc_info=True)
        return None


def _haversine_fallback(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    departure_time: datetime,
) -> TransitResult:
    """Estimate transit time from haversine distance as last resort."""
    dist = haversine_km(origin_lat, origin_lng, dest_lat, dest_lng)
    minutes = max(1, round((dist / HAVERSINE_FALLBACK_SPEED_KMH) * 60))
    arrival = departure_time + timedelta(minutes=minutes)
    return TransitResult(
        duration_minutes=minutes,
        departure_time=departure_time.isoformat(),
        arrival_time=arrival.isoformat(),
        transport_types=["estimated"],
        num_transfers=0,
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def get_transit_eta(
    origin_lat: float,
    origin_lng: float,
    dest_lat: float,
    dest_lng: float,
    departure_time: datetime,
) -> TransitResult | None:
    """
    Get transit ETA with fallback:
      1. transport.opendata.ch  (real public transport timetable)
      2. Haversine estimate     (offline fallback)
    """
    result = _query_opendata_api(origin_lat, origin_lng, dest_lat, dest_lng, departure_time)
    if result:
        return result

    return _haversine_fallback(origin_lat, origin_lng, dest_lat, dest_lng, departure_time)
