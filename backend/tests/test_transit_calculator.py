"""
Tests for Crawling Agent Sub-2: Transit Calculator (Swiss public transport ETA).

Covers:
  - Swiss transit client: parsing, API calls, haversine fallback
  - Transit calculator agent: enrichment, filtering, reachability labelling

Run with: pytest tests/test_transit_calculator.py -v
"""
import pytest
from datetime import datetime
from unittest.mock import patch, MagicMock
import httpx

from app.services.swiss_transit import (
    TransitResult,
    parse_opendata_connection,
    find_nearest_station,
    get_transit_eta,
    _parse_duration_string,
    _extract_transport_types,
    HAVERSINE_FALLBACK_SPEED_KMH,
)
from app.agents.transit_calculator import (
    run,
    determine_reachability,
    get_closing_minutes,
    CLOSING_SOON_THRESHOLD_MINUTES,
)
from app.agents.trace import make_trace


# ---------------------------------------------------------------------------
# Fixtures: mock API responses (transport.opendata.ch)
# ---------------------------------------------------------------------------

OPENDATA_LOCATIONS_RESPONSE = {
    "stations": [
        {
            "id": None,
            "name": "Bahnhofplatz 1, Zürich",
            "score": None,
            "coordinate": {"type": "WGS84", "x": 47.378000, "y": 8.540100},
            "distance": 32.3,
        },
        {
            "id": "8587349",
            "name": "Zürich, Bahnhofquai/HB",
            "score": None,
            "coordinate": {"type": "WGS84", "x": 47.377847, "y": 8.540503},
            "distance": 73.0,
        },
        {
            "id": "8503000",
            "name": "Zürich HB",
            "score": None,
            "coordinate": {"type": "WGS84", "x": 47.378177, "y": 8.540192},
            "distance": 139.0,
        },
    ]
}

OPENDATA_LOCATIONS_EMPTY = {"stations": []}

OPENDATA_LOCATIONS_ALL_NULL_IDS = {
    "stations": [
        {"id": None, "name": "Some address", "distance": 10},
        {"id": None, "name": "Another address", "distance": 20},
    ]
}

OPENDATA_CONNECTION_RESPONSE = {
    "connections": [
        {
            "from": {
                "station": {
                    "id": "8503000",
                    "name": "Zürich HB",
                    "coordinate": {"type": "WGS84", "x": 47.378177, "y": 8.540192},
                },
                "departure": "2026-03-09T14:05:00+01:00",
                "departureTimestamp": 1741525500,
                "platform": "7",
            },
            "to": {
                "station": {
                    "id": "8503006",
                    "name": "Zürich Stadelhofen",
                    "coordinate": {"type": "WGS84", "x": 47.366204, "y": 8.548440},
                },
                "arrival": "2026-03-09T14:32:00+01:00",
                "arrivalTimestamp": 1741527120,
                "platform": "2",
            },
            "duration": "00d00:27:00",
            "products": ["S9", "Bus 31"],
            "sections": [
                {
                    "journey": {
                        "name": "S9 18965",
                        "category": "S",
                        "number": "18965",
                        "operator": "SBB",
                        "to": "Uster",
                    },
                    "departure": {
                        "station": {"id": "8503000", "name": "Zürich HB"},
                        "departure": "2026-03-09T14:05:00+01:00",
                    },
                    "arrival": {
                        "station": {"id": "8503006", "name": "Zürich Stadelhofen"},
                        "arrival": "2026-03-09T14:20:00+01:00",
                    },
                },
                {
                    "walk": "PT5M",
                    "departure": {
                        "station": {"id": "8503006", "name": "Zürich Stadelhofen"},
                        "departure": "2026-03-09T14:22:00+01:00",
                    },
                    "arrival": {
                        "station": {"id": "8591382", "name": "Zürich, Kreuzplatz"},
                        "arrival": "2026-03-09T14:27:00+01:00",
                    },
                },
                {
                    "journey": {
                        "name": "Bus 31",
                        "category": "Bus",
                        "number": "31",
                        "operator": "VBZ",
                        "to": "Schlieren, Zentrum/Bahnhof",
                    },
                    "departure": {
                        "station": {"id": "8591382", "name": "Zürich, Kreuzplatz"},
                        "departure": "2026-03-09T14:28:00+01:00",
                    },
                    "arrival": {
                        "station": {"id": "8591399", "name": "Zürich, Hegibachplatz"},
                        "arrival": "2026-03-09T14:32:00+01:00",
                    },
                },
            ],
        },
        {
            "from": {
                "station": {"id": "8503000", "name": "Zürich HB"},
                "departure": "2026-03-09T14:15:00+01:00",
            },
            "to": {
                "station": {"id": "8503006", "name": "Zürich Stadelhofen"},
                "arrival": "2026-03-09T14:50:00+01:00",
            },
            "duration": "00d00:35:00",
            "sections": [
                {
                    "journey": {
                        "name": "Tram 11",
                        "category": "Tram",
                        "number": "11",
                    },
                },
            ],
        },
    ]
}

OPENDATA_CONNECTION_EMPTY = {"connections": []}


# ---------------------------------------------------------------------------
# Helpers: provider factory
# ---------------------------------------------------------------------------

def _make_provider(
    name: str = "Test Shop",
    lat: float = 47.3660,
    lng: float = 8.5484,
    opening_hours: dict | None = None,
    distance_km: float = 2.5,
) -> dict:
    if opening_hours is None:
        opening_hours = {
            "mon": "09:00-18:00",
            "tue": "09:00-18:00",
            "wed": "09:00-18:00",
            "thu": "09:00-20:00",
            "fri": "09:00-20:00",
            "sat": "10:00-16:00",
            "sun": None,
        }
    return {
        "id": f"place-{name.lower().replace(' ', '-')}",
        "name": name,
        "category": "cafe",
        "location": {"lat": lat, "lng": lng},
        "address": f"{name} Street 1, 8001 Zürich",
        "rating": 4.3,
        "review_count": 120,
        "price_range": "$$",
        "opening_hours": opening_hours,
        "website_url": None,
        "google_maps_url": None,
        "distance_km": distance_km,
    }


def _make_state(
    providers: list[dict] | None = None,
    requested_time: str = "2026-03-09T14:00:00",
    user_lat: float = 47.3769,
    user_lng: float = 8.5417,
    time_window_end: str | None = None,
) -> dict:
    constraints = {}
    if time_window_end:
        constraints["time_window_end"] = time_window_end
    return {
        "raw_input": "Find me a coffee shop near Zurich HB",
        "location": {"lat": user_lat, "lng": user_lng},
        "preferences": {},
        "structured_request": {
            "id": "req-transit-001",
            "raw_input": "Find me a coffee shop near Zurich HB",
            "category": "cafe",
            "requested_time": requested_time,
            "location": {"lat": user_lat, "lng": user_lng},
            "radius_km": 5.0,
            "constraints": constraints,
            "status": "open",
        },
        "candidate_providers": providers or [],
        "retry_count": 0,
        "feasible_providers": [],
        "ranked_offers": [],
        "trace": make_trace("req-transit-001"),
        "error": None,
    }


# ===========================================================================
# PART 1: Swiss Transit Client Tests (transport.opendata.ch)
# ===========================================================================


class TestParseDurationString:
    """Parse transport.opendata.ch duration format '00d00:27:00'."""

    def test_standard_duration(self):
        assert _parse_duration_string("00d00:27:00") == 27

    def test_over_one_hour(self):
        assert _parse_duration_string("00d01:15:00") == 75

    def test_multi_day(self):
        assert _parse_duration_string("01d02:30:00") == (24 * 60) + 150

    def test_zero_duration(self):
        assert _parse_duration_string("00d00:00:00") == 0

    def test_invalid_format_returns_none(self):
        assert _parse_duration_string("invalid") is None

    def test_none_input_returns_none(self):
        assert _parse_duration_string(None) is None


class TestExtractTransportTypes:
    """Extract transport modes from opendata.ch connection sections."""

    def test_extracts_train_and_bus(self):
        sections = OPENDATA_CONNECTION_RESPONSE["connections"][0]["sections"]
        types = _extract_transport_types(sections)
        assert "train" in types
        assert "bus" in types

    def test_skips_walking_sections(self):
        sections = OPENDATA_CONNECTION_RESPONSE["connections"][0]["sections"]
        types = _extract_transport_types(sections)
        assert "walk" not in types

    def test_extracts_tram(self):
        sections = [
            {"journey": {"category": "Tram", "name": "Tram 11"}},
        ]
        types = _extract_transport_types(sections)
        assert "tram" in types

    def test_empty_sections_returns_empty(self):
        types = _extract_transport_types([])
        assert types == []

    def test_none_sections_returns_empty(self):
        types = _extract_transport_types(None)
        assert types == []


class TestParseOpendataConnection:
    """Parse a single connection from transport.opendata.ch response."""

    def test_extracts_duration_minutes(self):
        conn = OPENDATA_CONNECTION_RESPONSE["connections"][0]
        result = parse_opendata_connection(conn)
        assert result is not None
        assert result.duration_minutes == 27

    def test_extracts_departure_time(self):
        conn = OPENDATA_CONNECTION_RESPONSE["connections"][0]
        result = parse_opendata_connection(conn)
        assert "14:05" in result.departure_time

    def test_extracts_arrival_time(self):
        conn = OPENDATA_CONNECTION_RESPONSE["connections"][0]
        result = parse_opendata_connection(conn)
        assert "14:32" in result.arrival_time

    def test_extracts_transport_types(self):
        conn = OPENDATA_CONNECTION_RESPONSE["connections"][0]
        result = parse_opendata_connection(conn)
        assert "train" in result.transport_types
        assert "bus" in result.transport_types

    def test_counts_transfers(self):
        conn = OPENDATA_CONNECTION_RESPONSE["connections"][0]
        result = parse_opendata_connection(conn)
        assert result.num_transfers == 1  # 2 PT legs = 1 transfer

    def test_returns_none_for_missing_times(self):
        conn = {"from": {}, "to": {}, "duration": "00d00:10:00", "sections": []}
        result = parse_opendata_connection(conn)
        assert result is None


class TestFindNearestStation:
    """Find nearest public transport station using transport.opendata.ch."""

    @patch("app.services.swiss_transit.httpx.get")
    def test_skips_null_ids_returns_first_valid_station(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = OPENDATA_LOCATIONS_RESPONSE
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        station = find_nearest_station(47.3769, 8.5417)
        assert station is not None
        assert station["id"] == "8587349"
        assert station["name"] == "Zürich, Bahnhofquai/HB"

    @patch("app.services.swiss_transit.httpx.get")
    def test_returns_none_when_no_stations_found(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = OPENDATA_LOCATIONS_EMPTY
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        station = find_nearest_station(0.0, 0.0)
        assert station is None

    @patch("app.services.swiss_transit.httpx.get")
    def test_returns_none_when_all_ids_are_null(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = OPENDATA_LOCATIONS_ALL_NULL_IDS
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        station = find_nearest_station(47.3769, 8.5417)
        assert station is None

    @patch("app.services.swiss_transit.httpx.get")
    def test_returns_none_on_api_error(self, mock_get):
        mock_get.side_effect = httpx.HTTPError("connection failed")

        station = find_nearest_station(47.3769, 8.5417)
        assert station is None

    @patch("app.services.swiss_transit.httpx.get")
    def test_calls_opendata_with_coordinates(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = OPENDATA_LOCATIONS_RESPONSE
        mock_resp.raise_for_status = MagicMock()
        mock_get.return_value = mock_resp

        find_nearest_station(47.3769, 8.5417)
        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args
        params = call_kwargs.kwargs.get("params") or call_kwargs[1].get("params")
        assert params["x"] == 47.3769
        assert params["y"] == 8.5417


class TestGetTransitEta:
    """Integration: get transit ETA through opendata + haversine fallback."""

    @patch("app.services.swiss_transit._query_opendata_api")
    def test_uses_opendata_api_when_available(self, mock_opendata):
        expected = TransitResult(
            duration_minutes=27,
            departure_time="2026-03-09T14:05:00+01:00",
            arrival_time="2026-03-09T14:32:00+01:00",
            transport_types=["train", "bus"],
            num_transfers=1,
        )
        mock_opendata.return_value = expected

        result = get_transit_eta(47.3769, 8.5417, 47.3660, 8.5484,
                                 datetime(2026, 3, 9, 14, 0))
        assert result == expected

    @patch("app.services.swiss_transit._query_opendata_api")
    def test_falls_back_to_haversine_when_api_fails(self, mock_opendata):
        mock_opendata.return_value = None

        result = get_transit_eta(47.3769, 8.5417, 47.3660, 8.5484,
                                 datetime(2026, 3, 9, 14, 0))
        assert result is not None
        assert result.duration_minutes > 0
        assert result.transport_types == ["estimated"]
        assert result.num_transfers == 0

    @patch("app.services.swiss_transit._query_opendata_api")
    def test_haversine_fallback_uses_distance(self, mock_opendata):
        mock_opendata.return_value = None

        result = get_transit_eta(47.3769, 8.5417, 47.4769, 8.5417,
                                 datetime(2026, 3, 9, 14, 0))
        assert result.duration_minutes > 0

    @patch("app.services.swiss_transit._query_opendata_api")
    def test_haversine_fallback_departure_matches_input(self, mock_opendata):
        mock_opendata.return_value = None
        dt = datetime(2026, 3, 9, 14, 0)

        result = get_transit_eta(47.3769, 8.5417, 47.3660, 8.5484, dt)
        assert dt.isoformat() in result.departure_time


# ===========================================================================
# PART 2: Transit Calculator Agent Tests
# ===========================================================================


class TestDetermineReachability:
    """Classify provider reachability given transit info and store hours."""

    def test_reachable_well_before_closing(self):
        transit = TransitResult(
            duration_minutes=15,
            departure_time="2026-03-09T14:05:00",
            arrival_time="2026-03-09T14:20:00",
            transport_types=["train"],
            num_transfers=0,
        )
        closing_minutes = 18 * 60  # 18:00 = 1080 min
        status = determine_reachability(transit, closing_minutes)
        assert status == "reachable"

    def test_closing_soon_within_threshold(self):
        transit = TransitResult(
            duration_minutes=15,
            departure_time="2026-03-09T17:30:00",
            arrival_time="2026-03-09T17:45:00",
            transport_types=["bus"],
            num_transfers=0,
        )
        closing_minutes = 18 * 60  # 18:00 = 1080 min
        status = determine_reachability(transit, closing_minutes)
        assert status == "closing_soon"

    def test_unreachable_arrives_after_closing(self):
        transit = TransitResult(
            duration_minutes=45,
            departure_time="2026-03-09T17:30:00",
            arrival_time="2026-03-09T18:15:00",
            transport_types=["train", "bus"],
            num_transfers=1,
        )
        closing_minutes = 18 * 60  # 18:00
        status = determine_reachability(transit, closing_minutes)
        assert status == "unreachable"

    def test_none_closing_minutes_defaults_to_reachable(self):
        transit = TransitResult(
            duration_minutes=10,
            departure_time="2026-03-09T14:00:00",
            arrival_time="2026-03-09T14:10:00",
            transport_types=["tram"],
            num_transfers=0,
        )
        status = determine_reachability(transit, closing_minutes=None)
        assert status == "reachable"


class TestGetClosingMinutes:
    """Extract closing time in minutes from midnight from opening_hours."""

    def test_standard_closing(self):
        hours = {"mon": "09:00-18:00"}
        dt = datetime(2026, 3, 9, 14, 0)  # Monday
        assert get_closing_minutes(hours, dt) == 18 * 60

    def test_late_night_closing(self):
        hours = {"fri": "17:00-02:00"}
        dt = datetime(2026, 3, 13, 20, 0)  # Friday
        closing = get_closing_minutes(hours, dt)
        assert closing == 26 * 60

    def test_closed_day_returns_none(self):
        hours = {"sun": None}
        dt = datetime(2026, 3, 15, 12, 0)  # Sunday
        assert get_closing_minutes(hours, dt) is None

    def test_missing_day_returns_none(self):
        hours = {"mon": "09:00-18:00"}
        dt = datetime(2026, 3, 10, 12, 0)  # Tuesday, no key
        assert get_closing_minutes(hours, dt) is None


class TestTransitCalculatorRun:
    """Agent entry point: enrich providers with transit info, filter by reachability."""

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_enriches_providers_with_transit_info(self, mock_eta):
        mock_eta.return_value = TransitResult(
            duration_minutes=20,
            departure_time="2026-03-09T14:05:00",
            arrival_time="2026-03-09T14:25:00",
            transport_types=["train"],
            num_transfers=0,
        )
        provider = _make_provider("Open Cafe")
        state = _make_state([provider], "2026-03-09T14:00:00")
        result = run(state)

        enriched = result["candidate_providers"]
        assert len(enriched) == 1
        assert "transit_info" in enriched[0]
        assert enriched[0]["transit_info"]["duration_minutes"] == 20
        assert enriched[0]["transit_info"]["transport_types"] == ["train"]

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_filters_unreachable_providers(self, mock_eta):
        mock_eta.return_value = TransitResult(
            duration_minutes=90,
            departure_time="2026-03-09T17:00:00",
            arrival_time="2026-03-09T18:30:00",
            transport_types=["train", "bus"],
            num_transfers=2,
        )
        provider = _make_provider(
            "Far Away Shop",
            opening_hours={"mon": "09:00-18:00"},
        )
        state = _make_state([provider], "2026-03-09T17:00:00")
        result = run(state)

        assert len(result["candidate_providers"]) == 0

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_labels_reachable_status(self, mock_eta):
        mock_eta.return_value = TransitResult(
            duration_minutes=15,
            departure_time="2026-03-09T14:05:00",
            arrival_time="2026-03-09T14:20:00",
            transport_types=["tram"],
            num_transfers=0,
        )
        provider = _make_provider("Nearby Cafe")
        state = _make_state([provider], "2026-03-09T14:00:00")
        result = run(state)

        assert result["candidate_providers"][0]["reachability_status"] == "reachable"

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_labels_closing_soon(self, mock_eta):
        mock_eta.return_value = TransitResult(
            duration_minutes=15,
            departure_time="2026-03-09T17:30:00",
            arrival_time="2026-03-09T17:45:00",
            transport_types=["bus"],
            num_transfers=0,
        )
        provider = _make_provider(
            "Closing Shop",
            opening_hours={"mon": "09:00-18:00"},
        )
        state = _make_state([provider], "2026-03-09T17:30:00")
        result = run(state)

        enriched = result["candidate_providers"]
        assert len(enriched) == 1
        assert enriched[0]["reachability_status"] == "closing_soon"

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_handles_empty_candidate_list(self, mock_eta):
        state = _make_state([], "2026-03-09T14:00:00")
        result = run(state)

        assert result["candidate_providers"] == []
        mock_eta.assert_not_called()

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_handles_all_providers_unreachable(self, mock_eta):
        mock_eta.return_value = TransitResult(
            duration_minutes=120,
            departure_time="2026-03-09T17:00:00",
            arrival_time="2026-03-09T19:00:00",
            transport_types=["train"],
            num_transfers=3,
        )
        providers = [
            _make_provider("Shop A", opening_hours={"mon": "09:00-18:00"}),
            _make_provider("Shop B", opening_hours={"mon": "09:00-17:00"}),
        ]
        state = _make_state(providers, "2026-03-09T17:00:00")
        result = run(state)

        assert len(result["candidate_providers"]) == 0

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_preserves_original_provider_fields(self, mock_eta):
        mock_eta.return_value = TransitResult(
            duration_minutes=10,
            departure_time="2026-03-09T14:05:00",
            arrival_time="2026-03-09T14:15:00",
            transport_types=["tram"],
            num_transfers=0,
        )
        provider = _make_provider("Good Cafe", lat=47.37, lng=8.54)
        state = _make_state([provider], "2026-03-09T14:00:00")
        result = run(state)

        p = result["candidate_providers"][0]
        assert p["name"] == "Good Cafe"
        assert p["rating"] == 4.3
        assert p["location"]["lat"] == 47.37
        assert p["opening_hours"]["mon"] == "09:00-18:00"

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_records_trace_step(self, mock_eta):
        mock_eta.return_value = TransitResult(
            duration_minutes=10,
            departure_time="2026-03-09T14:05:00",
            arrival_time="2026-03-09T14:15:00",
            transport_types=["tram"],
            num_transfers=0,
        )
        state = _make_state([_make_provider()], "2026-03-09T14:00:00")
        result = run(state)

        steps = result["trace"]["steps"]
        assert any(s["agent"] == "transit_calculator" for s in steps)

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_handles_eta_returning_none(self, mock_eta):
        mock_eta.return_value = None
        provider = _make_provider("Offline Cafe")
        state = _make_state([provider], "2026-03-09T14:00:00")
        result = run(state)

        enriched = result["candidate_providers"]
        assert len(enriched) == 1
        assert enriched[0]["transit_info"]["transport_types"] == ["estimated"]

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_mixed_reachable_and_unreachable(self, mock_eta):
        reachable_eta = TransitResult(
            duration_minutes=15,
            departure_time="2026-03-09T14:05:00",
            arrival_time="2026-03-09T14:20:00",
            transport_types=["tram"],
            num_transfers=0,
        )
        unreachable_eta = TransitResult(
            duration_minutes=90,
            departure_time="2026-03-09T14:05:00",
            arrival_time="2026-03-09T15:35:00",
            transport_types=["train", "bus"],
            num_transfers=2,
        )
        mock_eta.side_effect = [reachable_eta, unreachable_eta]

        providers = [
            _make_provider("Close Shop", opening_hours={"mon": "09:00-18:00"}),
            _make_provider(
                "Far Shop",
                opening_hours={"mon": "09:00-15:00"},
                distance_km=20.0,
            ),
        ]
        state = _make_state(providers, "2026-03-09T14:00:00")
        result = run(state)

        assert len(result["candidate_providers"]) == 1
        assert result["candidate_providers"][0]["name"] == "Close Shop"

    @patch("app.agents.transit_calculator.get_transit_eta")
    def test_calls_eta_with_correct_coordinates(self, mock_eta):
        mock_eta.return_value = TransitResult(
            duration_minutes=10,
            departure_time="2026-03-09T14:05:00",
            arrival_time="2026-03-09T14:15:00",
            transport_types=["tram"],
            num_transfers=0,
        )
        provider = _make_provider("Target", lat=47.3660, lng=8.5484)
        state = _make_state(
            [provider], "2026-03-09T14:00:00",
            user_lat=47.3769, user_lng=8.5417,
        )
        run(state)

        mock_eta.assert_called_once()
        args = mock_eta.call_args
        assert args[0][0] == 47.3769   # origin_lat
        assert args[0][1] == 8.5417    # origin_lng
        assert args[0][2] == 47.3660   # dest_lat
        assert args[0][3] == 8.5484    # dest_lng
