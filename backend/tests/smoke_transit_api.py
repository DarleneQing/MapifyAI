"""
Smoke test: transport.opendata.ch API with real data.

Tests the three API calls used by swiss_transit.py:
  1. /v1/locations  — find nearest station by coordinates
  2. /v1/connections — find connections between two stations
  3. Full get_transit_eta() flow through our client

Run: python tests/smoke_transit_api.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx

BASE = "https://transport.opendata.ch/v1"
TIMEOUT = 15

# Zurich HB area
ORIGIN_LAT, ORIGIN_LNG = 47.3769, 8.5417
# Zurich Stadelhofen area (~1.5 km away)
DEST_LAT, DEST_LNG = 47.3662, 8.5484


def _first_with_id(stations):
    """Filter to first station with a non-null id (addresses have id=None)."""
    for s in stations:
        if s.get("id"):
            return s
    return None


def test_locations_origin():
    print("=" * 60)
    print("TEST 1: /v1/locations - Find station near Zurich HB")
    print(f"  Coords: lat={ORIGIN_LAT}, lng={ORIGIN_LNG}")
    print("=" * 60)
    resp = httpx.get(
        f"{BASE}/locations",
        params={"x": ORIGIN_LAT, "y": ORIGIN_LNG},
        timeout=TIMEOUT,
    )
    print(f"  HTTP Status: {resp.status_code}")
    data = resp.json()
    stations = data.get("stations", [])
    print(f"  Total results: {len(stations)}")
    for s in stations[:5]:
        dist = s.get("distance")
        sid = s.get("id") or "(no id)"
        print(f"    - {sid}: {s['name']} (distance={dist}m)")

    best = _first_with_id(stations)
    assert resp.status_code == 200
    assert best is not None, "No station with valid id found"
    print(f"  >> Selected: {best['id']} — {best['name']}")
    print()
    return best


def test_locations_dest():
    print("=" * 60)
    print("TEST 2: /v1/locations - Find station near Stadelhofen")
    print(f"  Coords: lat={DEST_LAT}, lng={DEST_LNG}")
    print("=" * 60)
    resp = httpx.get(
        f"{BASE}/locations",
        params={"x": DEST_LAT, "y": DEST_LNG},
        timeout=TIMEOUT,
    )
    print(f"  HTTP Status: {resp.status_code}")
    data = resp.json()
    stations = data.get("stations", [])
    print(f"  Total results: {len(stations)}")
    for s in stations[:5]:
        dist = s.get("distance")
        sid = s.get("id") or "(no id)"
        print(f"    - {sid}: {s['name']} (distance={dist}m)")

    best = _first_with_id(stations)
    assert resp.status_code == 200
    assert best is not None, "No station with valid id found"
    print(f"  >> Selected: {best['id']} — {best['name']}")
    print()
    return best


def test_connections(origin_id, origin_name, dest_id, dest_name):
    print("=" * 60)
    print(f"TEST 3: /v1/connections - {origin_name} -> {dest_name}")
    print(f"  IDs: {origin_id} -> {dest_id}")
    print("=" * 60)
    resp = httpx.get(
        f"{BASE}/connections",
        params={
            "from": origin_id,
            "to": dest_id,
            "date": "2026-03-10",
            "time": "14:00",
            "limit": 2,
        },
        timeout=TIMEOUT,
    )
    print(f"  HTTP Status: {resp.status_code}")
    data = resp.json()
    conns = data.get("connections", [])
    print(f"  Connections returned: {len(conns)}")

    for i, c in enumerate(conns[:2]):
        dep = (c.get("from") or {}).get("departure", "?")
        arr = (c.get("to") or {}).get("arrival", "?")
        dur = c.get("duration", "?")
        prods = c.get("products", [])
        sections = c.get("sections", [])
        categories = []
        for sec in sections:
            j = sec.get("journey")
            if j:
                categories.append(j.get("category", "?"))
            elif sec.get("walk"):
                categories.append("walk")

        print(f"  Connection {i + 1}:")
        print(f"    Departure:    {dep}")
        print(f"    Arrival:      {arr}")
        print(f"    Duration:     {dur}")
        print(f"    Products:     {prods}")
        print(f"    Sections:     {len(sections)} ({', '.join(categories)})")
    print()

    assert resp.status_code == 200
    assert len(conns) > 0, "No connections found"
    return conns[0]


def test_full_client():
    print("=" * 60)
    print("TEST 4: Full get_transit_eta() via swiss_transit.py")
    print(f"  Origin:  ({ORIGIN_LAT}, {ORIGIN_LNG})  [near Zurich HB]")
    print(f"  Dest:    ({DEST_LAT}, {DEST_LNG})  [near Stadelhofen]")
    print("=" * 60)
    from datetime import datetime
    from app.services.swiss_transit import get_transit_eta

    result = get_transit_eta(
        ORIGIN_LAT, ORIGIN_LNG,
        DEST_LAT, DEST_LNG,
        datetime(2026, 3, 10, 14, 0),
    )
    print(f"  Result:           {result}")
    print(f"  Duration:         {result.duration_minutes} min")
    print(f"  Departure:        {result.departure_time}")
    print(f"  Arrival:          {result.arrival_time}")
    print(f"  Transport types:  {result.transport_types}")
    print(f"  Transfers:        {result.num_transfers}")
    print()

    assert result is not None
    assert result.duration_minutes > 0
    assert result.transport_types != ["estimated"], "Fell back to haversine — API may be down"


def main():
    print()
    print("Smoke testing transport.opendata.ch API")
    print("=" * 60)
    print()

    origin = test_locations_origin()
    dest = test_locations_dest()
    conn = test_connections(origin["id"], origin["name"], dest["id"], dest["name"])
    test_full_client()

    print("=" * 60)
    print("ALL SMOKE TESTS PASSED")
    print("=" * 60)


if __name__ == "__main__":
    main()
