"""
Tests for Crawling Agent Sub-1: Apify Google Maps search + opening hours filter.
Run with: pytest tests/test_crawling_search.py -v
"""
import pytest
from datetime import datetime
from unittest.mock import patch, AsyncMock

from app.agents.crawling_search import (
    parse_apify_hours,
    convert_12h_range_to_24h,
    is_open_at,
    transform_apify_result,
    filter_by_opening_hours,
    run,
)
from app.agents.trace import make_trace


# ---------------------------------------------------------------------------
# Fixtures: sample Apify API responses
# ---------------------------------------------------------------------------

APIFY_RESULT_OPEN = {
    "name": "Café Zurich",
    "address": "Bahnhofstrasse 10, 8001 Zürich",
    "latitude": 47.3769,
    "longitude": 8.5417,
    "rating": 4.5,
    "reviewCount": 230,
    "priceRange": "$$",
    "website": "https://cafezurich.ch",
    "placeId": "ChIJ_abc123",
    "url": "https://www.google.com/maps?cid=12345",
    "categories": ["Cafe", "Coffee shop"],
    "openingHours": [
        {"day": "Monday", "hours": "7 AM-6 PM"},
        {"day": "Tuesday", "hours": "7 AM-6 PM"},
        {"day": "Wednesday", "hours": "7 AM-6 PM"},
        {"day": "Thursday", "hours": "7 AM-8 PM"},
        {"day": "Friday", "hours": "7 AM-8 PM"},
        {"day": "Saturday", "hours": "8 AM-5 PM"},
        {"day": "Sunday", "hours": "Closed"},
    ],
}

APIFY_RESULT_CLOSED_SUNDAYS = {
    "name": "Bäckerei Müller",
    "address": "Langstrasse 55, 8004 Zürich",
    "latitude": 47.3780,
    "longitude": 8.5300,
    "rating": 4.2,
    "reviewCount": 85,
    "priceRange": "$",
    "website": None,
    "placeId": "ChIJ_def456",
    "url": "https://www.google.com/maps?cid=67890",
    "categories": ["Bakery"],
    "openingHours": [
        {"day": "Monday", "hours": "6:30 AM-7 PM"},
        {"day": "Tuesday", "hours": "6:30 AM-7 PM"},
        {"day": "Wednesday", "hours": "6:30 AM-7 PM"},
        {"day": "Thursday", "hours": "6:30 AM-7 PM"},
        {"day": "Friday", "hours": "6:30 AM-7 PM"},
        {"day": "Saturday", "hours": "7 AM-4 PM"},
        {"day": "Sunday", "hours": "Closed"},
    ],
}

APIFY_RESULT_LATE_NIGHT = {
    "name": "Bar Rossi",
    "address": "Niederdorfstrasse 20, 8001 Zürich",
    "latitude": 47.3740,
    "longitude": 8.5450,
    "rating": 4.0,
    "reviewCount": 150,
    "priceRange": "$$$",
    "website": "https://barrossi.ch",
    "placeId": "ChIJ_ghi789",
    "url": "https://www.google.com/maps?cid=11111",
    "categories": ["Bar", "Restaurant"],
    "openingHours": [
        {"day": "Monday", "hours": "5 PM-12 AM"},
        {"day": "Tuesday", "hours": "5 PM-12 AM"},
        {"day": "Wednesday", "hours": "5 PM-12 AM"},
        {"day": "Thursday", "hours": "5 PM-1 AM"},
        {"day": "Friday", "hours": "5 PM-2 AM"},
        {"day": "Saturday", "hours": "3 PM-2 AM"},
        {"day": "Sunday", "hours": "Closed"},
    ],
}

APIFY_RESULT_NO_HOURS = {
    "name": "Mystery Shop",
    "address": "Unknown 1, 8000 Zürich",
    "latitude": 47.3800,
    "longitude": 8.5400,
    "rating": 3.5,
    "reviewCount": 10,
    "priceRange": None,
    "website": None,
    "placeId": "ChIJ_xyz999",
    "url": "https://www.google.com/maps?cid=99999",
    "categories": ["Store"],
    "openingHours": None,
}

COMPASS_RESULT = {
    "title": "Kim's Island",
    "address": "175 Main St, Staten Island",
    "location": {"lat": 47.3770, "lng": 8.5392},
    "totalScore": 4.5,
    "reviewsCount": 91,
    "price": "$10–20",
    "website": "http://kimsislandsi.com/",
    "placeId": "ChIJJQz5EZzKw4kR",
    "categories": ["Chinese restaurant", "Delivery Restaurant"],
    "categoryName": "Chinese restaurant",
    "openingHours": [
        {"day": "Monday", "hours": "Closed"},
        {"day": "Tuesday", "hours": "11 AM to 9:30 PM"},
        {"day": "Wednesday", "hours": "11 AM to 9:30 PM"},
        {"day": "Thursday", "hours": "11 AM to 12 AM"},
        {"day": "Friday", "hours": "11 AM to 10:30 PM"},
        {"day": "Saturday", "hours": "11 AM to 10:30 PM"},
        {"day": "Sunday", "hours": "12 to 9:30 PM"},
    ],
}


# ---------------------------------------------------------------------------
# Tests: convert_12h_range_to_24h
# ---------------------------------------------------------------------------

class TestConvert12hRangeTo24h:
    def test_simple_am_pm(self):
        assert convert_12h_range_to_24h("9 AM-5 PM") == "09:00-17:00"

    def test_with_minutes(self):
        assert convert_12h_range_to_24h("7:30 AM-6:30 PM") == "07:30-18:30"

    def test_noon(self):
        assert convert_12h_range_to_24h("11 AM-12 PM") == "11:00-12:00"

    def test_midnight(self):
        assert convert_12h_range_to_24h("5 PM-12 AM") == "17:00-00:00"

    def test_early_morning(self):
        assert convert_12h_range_to_24h("6 AM-2 PM") == "06:00-14:00"

    def test_late_night_past_midnight(self):
        assert convert_12h_range_to_24h("5 PM-2 AM") == "17:00-02:00"

    def test_twelve_thirty_pm(self):
        assert convert_12h_range_to_24h("12:30 PM-10 PM") == "12:30-22:00"

    def test_twelve_am(self):
        assert convert_12h_range_to_24h("12 AM-8 AM") == "00:00-08:00"

    def test_to_separator(self):
        assert convert_12h_range_to_24h("11 AM to 9:30 PM") == "11:00-21:30"

    def test_to_separator_midnight(self):
        assert convert_12h_range_to_24h("5 PM to 12 AM") == "17:00-00:00"

    def test_split_shift(self):
        # Bare "12" = noon in Google Maps; widest window from first open to last close
        assert convert_12h_range_to_24h("12 to 9:30 AM, 11 AM to 10:30 PM") == "12:00-22:30"

    def test_bare_number_noon(self):
        assert convert_12h_range_to_24h("12 to 5 PM") == "12:00-17:00"

    def test_narrow_no_break_space(self):
        assert convert_12h_range_to_24h("8:30\u202fAM to 12\u202fPM") == "08:30-12:00"

    def test_split_shift_with_narrow_space(self):
        assert convert_12h_range_to_24h("8:30\u202fAM to 12\u202fPM, 2 to 6\u202fPM") == "08:30-18:00"


# ---------------------------------------------------------------------------
# Tests: parse_apify_hours
# ---------------------------------------------------------------------------

class TestParseApifyHours:
    def test_full_week(self):
        hours = parse_apify_hours(APIFY_RESULT_OPEN["openingHours"])
        assert hours["mon"] == "07:00-18:00"
        assert hours["thu"] == "07:00-20:00"
        assert hours["sat"] == "08:00-17:00"
        assert hours["sun"] is None

    def test_closed_day_returns_none(self):
        hours = parse_apify_hours(APIFY_RESULT_CLOSED_SUNDAYS["openingHours"])
        assert hours["sun"] is None

    def test_none_input_returns_all_none(self):
        hours = parse_apify_hours(None)
        assert all(v is None for v in hours.values())

    def test_empty_list_returns_all_none(self):
        hours = parse_apify_hours([])
        assert all(v is None for v in hours.values())

    def test_late_night_hours(self):
        hours = parse_apify_hours(APIFY_RESULT_LATE_NIGHT["openingHours"])
        assert hours["mon"] == "17:00-00:00"
        assert hours["fri"] == "17:00-02:00"
        assert hours["sat"] == "15:00-02:00"


# ---------------------------------------------------------------------------
# Tests: is_open_at
# ---------------------------------------------------------------------------

class TestIsOpenAt:
    def test_open_during_business_hours(self):
        hours = {"mon": "07:00-18:00", "tue": "07:00-18:00"}
        dt = datetime(2026, 3, 9, 14, 0)  # Monday 2pm
        assert is_open_at(hours, dt) is True

    def test_closed_before_opening(self):
        hours = {"mon": "09:00-18:00"}
        dt = datetime(2026, 3, 9, 8, 0)  # Monday 8am
        assert is_open_at(hours, dt) is False

    def test_closed_after_closing(self):
        hours = {"mon": "09:00-18:00"}
        dt = datetime(2026, 3, 9, 19, 0)  # Monday 7pm
        assert is_open_at(hours, dt) is False

    def test_closed_day_none(self):
        hours = {"sun": None}
        dt = datetime(2026, 3, 15, 12, 0)  # Sunday noon
        assert is_open_at(hours, dt) is False

    def test_missing_day_key(self):
        hours = {"mon": "09:00-18:00"}
        dt = datetime(2026, 3, 10, 12, 0)  # Tuesday noon, no tue key
        assert is_open_at(hours, dt) is False

    def test_exactly_at_opening(self):
        hours = {"mon": "09:00-18:00"}
        dt = datetime(2026, 3, 9, 9, 0)  # Monday 9am exactly
        assert is_open_at(hours, dt) is True

    def test_exactly_at_closing(self):
        hours = {"mon": "09:00-18:00"}
        dt = datetime(2026, 3, 9, 18, 0)  # Monday 6pm exactly = closed
        assert is_open_at(hours, dt) is False

    def test_late_night_before_midnight(self):
        hours = {"mon": "17:00-02:00"}
        dt = datetime(2026, 3, 9, 23, 0)  # Monday 11pm
        assert is_open_at(hours, dt) is True

    def test_late_night_after_midnight(self):
        hours = {"mon": "17:00-02:00"}
        dt = datetime(2026, 3, 9, 1, 30)  # Monday 1:30am (still Mon's hours)
        # Note: this is tricky -- 1:30am Monday is actually the tail of
        # Sunday's late-night shift. The caller should handle this edge case
        # by checking previous day. For simplicity, if close < open it wraps.
        # At 1:30am on Monday, we check Monday's hours: open 17:00-02:00.
        # 1:30 is < 2:00 and close wraps around, so should be True.
        assert is_open_at(hours, dt) is True


# ---------------------------------------------------------------------------
# Tests: transform_apify_result
# ---------------------------------------------------------------------------

class TestTransformApifyResult:
    def test_basic_transformation(self):
        result = transform_apify_result(
            APIFY_RESULT_OPEN, user_lat=47.3769, user_lng=8.5417
        )
        assert result["name"] == "Café Zurich"
        assert result["address"] == "Bahnhofstrasse 10, 8001 Zürich"
        assert result["location"]["lat"] == 47.3769
        assert result["location"]["lng"] == 8.5417
        assert result["rating"] == 4.5
        assert result["review_count"] == 230
        assert result["google_maps_url"] == "https://www.google.com/maps?cid=12345"
        assert result["website_url"] == "https://cafezurich.ch"
        assert "opening_hours" in result
        assert "distance_km" in result
        assert isinstance(result["category"], str)

    def test_distance_computed(self):
        result = transform_apify_result(
            APIFY_RESULT_CLOSED_SUNDAYS, user_lat=47.3769, user_lng=8.5417
        )
        assert result["distance_km"] >= 0
        assert isinstance(result["distance_km"], float)

    def test_no_opening_hours(self):
        result = transform_apify_result(
            APIFY_RESULT_NO_HOURS, user_lat=47.3769, user_lng=8.5417
        )
        assert all(
            v is None for v in result["opening_hours"].values()
        )

    def test_missing_fields_use_defaults(self):
        minimal = {
            "name": "Minimal",
            "latitude": 47.38,
            "longitude": 8.54,
        }
        result = transform_apify_result(minimal, user_lat=47.38, user_lng=8.54)
        assert result["name"] == "Minimal"
        assert result["rating"] == 0.0
        assert result["review_count"] == 0
        assert result["address"] == ""
        assert result["price_range"] == ""

    def test_category_from_categories_list(self):
        result = transform_apify_result(
            APIFY_RESULT_OPEN, user_lat=47.3769, user_lng=8.5417
        )
        assert result["category"] == "Cafe"

    def test_generates_id(self):
        result = transform_apify_result(
            APIFY_RESULT_OPEN, user_lat=47.3769, user_lng=8.5417
        )
        assert "id" in result
        assert isinstance(result["id"], str)
        assert len(result["id"]) > 0

    def test_compass_format_uses_title(self):
        result = transform_apify_result(
            COMPASS_RESULT, user_lat=47.3769, user_lng=8.5417
        )
        assert result["name"] == "Kim's Island"

    def test_compass_format_uses_location_dict(self):
        result = transform_apify_result(
            COMPASS_RESULT, user_lat=47.3769, user_lng=8.5417
        )
        assert result["location"]["lat"] == 47.3770
        assert result["location"]["lng"] == 8.5392

    def test_compass_format_uses_totalScore(self):
        result = transform_apify_result(
            COMPASS_RESULT, user_lat=47.3769, user_lng=8.5417
        )
        assert result["rating"] == 4.5
        assert result["review_count"] == 91

    def test_compass_format_opening_hours_parsed(self):
        result = transform_apify_result(
            COMPASS_RESULT, user_lat=47.3769, user_lng=8.5417
        )
        assert result["opening_hours"]["mon"] is None
        assert result["opening_hours"]["tue"] == "11:00-21:30"
        assert result["opening_hours"]["thu"] == "11:00-00:00"


# ---------------------------------------------------------------------------
# Tests: filter_by_opening_hours
# ---------------------------------------------------------------------------

class TestFilterByOpeningHours:
    def _make_provider(self, opening_hours: dict, name: str = "Test") -> dict:
        return {
            "id": "test-id",
            "name": name,
            "category": "cafe",
            "location": {"lat": 47.37, "lng": 8.54},
            "address": "Test St 1",
            "rating": 4.0,
            "review_count": 100,
            "price_range": "$$",
            "opening_hours": opening_hours,
            "distance_km": 1.0,
        }

    def test_keeps_open_stores(self):
        providers = [
            self._make_provider({"mon": "07:00-18:00"}, "Open Shop"),
        ]
        dt = datetime(2026, 3, 9, 14, 0)  # Monday 2pm
        result = filter_by_opening_hours(providers, dt)
        assert len(result) == 1
        assert result[0]["name"] == "Open Shop"

    def test_removes_closed_stores(self):
        providers = [
            self._make_provider({"mon": "07:00-12:00"}, "Morning Only"),
        ]
        dt = datetime(2026, 3, 9, 14, 0)  # Monday 2pm
        result = filter_by_opening_hours(providers, dt)
        assert len(result) == 0

    def test_mixed_open_and_closed(self):
        providers = [
            self._make_provider({"mon": "07:00-18:00"}, "Open"),
            self._make_provider({"mon": "07:00-12:00"}, "Closed"),
            self._make_provider({"mon": "10:00-22:00"}, "Also Open"),
        ]
        dt = datetime(2026, 3, 9, 14, 0)  # Monday 2pm
        result = filter_by_opening_hours(providers, dt)
        assert len(result) == 2
        names = {p["name"] for p in result}
        assert names == {"Open", "Also Open"}

    def test_no_hours_info_excluded(self):
        providers = [
            self._make_provider(
                {"mon": None, "tue": None, "wed": None}, "No Hours"
            ),
        ]
        dt = datetime(2026, 3, 9, 14, 0)  # Monday 2pm
        result = filter_by_opening_hours(providers, dt)
        assert len(result) == 0

    def test_empty_list_returns_empty(self):
        result = filter_by_opening_hours([], datetime(2026, 3, 9, 14, 0))
        assert result == []


# ---------------------------------------------------------------------------
# Tests: run (agent entry point)
# ---------------------------------------------------------------------------

class TestCrawlingSearchAgentRun:
    def _make_state(
        self, requested_time: str = "2026-03-09T14:00:00"
    ) -> dict:
        return {
            "raw_input": "I want a coffee near Zurich HB",
            "location": {"lat": 47.3769, "lng": 8.5417},
            "preferences": {},
            "structured_request": {
                "id": "req-001",
                "raw_input": "I want a coffee near Zurich HB",
                "category": "cafe",
                "requested_time": requested_time,
                "location": {"lat": 47.3769, "lng": 8.5417},
                "radius_km": 3.0,
                "constraints": {},
                "status": "open",
            },
            "candidate_providers": [],
            "retry_count": 0,
            "feasible_providers": [],
            "ranked_offers": [],
            "trace": make_trace("req-001"),
            "error": None,
        }

    @patch("app.agents.crawling_search.search_places")
    def test_populates_candidate_providers(self, mock_search):
        mock_search.return_value = [APIFY_RESULT_OPEN, APIFY_RESULT_CLOSED_SUNDAYS]
        state = self._make_state("2026-03-09T14:00:00")  # Monday 2pm
        result = run(state)
        assert len(result["candidate_providers"]) == 2

    @patch("app.agents.crawling_search.search_places")
    def test_filters_closed_on_sunday(self, mock_search):
        mock_search.return_value = [APIFY_RESULT_OPEN, APIFY_RESULT_CLOSED_SUNDAYS]
        state = self._make_state("2026-03-15T14:00:00")  # Sunday 2pm
        result = run(state)
        assert len(result["candidate_providers"]) == 0

    @patch("app.agents.crawling_search.search_places")
    def test_records_trace_step(self, mock_search):
        mock_search.return_value = [APIFY_RESULT_OPEN]
        state = self._make_state("2026-03-09T14:00:00")
        result = run(state)
        steps = result["trace"]["steps"]
        assert any(s["agent"] == "crawling_search" for s in steps)

    @patch("app.agents.crawling_search.search_places")
    def test_calls_apify_with_correct_params(self, mock_search):
        mock_search.return_value = []
        state = self._make_state()
        run(state)
        mock_search.assert_called_once_with(
            term="cafe",
            lat=47.3769,
            lng=8.5417,
            radius_km=3.0,
        )

    @patch("app.agents.crawling_search.search_places")
    def test_handles_empty_apify_response(self, mock_search):
        mock_search.return_value = []
        state = self._make_state()
        result = run(state)
        assert result["candidate_providers"] == []

    @patch("app.agents.crawling_search.search_places")
    def test_widens_radius_on_retry(self, mock_search):
        mock_search.return_value = []
        state = self._make_state()
        state["retry_count"] = 2
        run(state)
        call_args = mock_search.call_args
        assert call_args.kwargs["radius_km"] > 3.0

    @patch("app.agents.crawling_search.search_places")
    def test_sorts_candidates_by_distance(self, mock_search):
        far_result = {**APIFY_RESULT_OPEN, "latitude": 47.40, "longitude": 8.55}
        near_result = {**APIFY_RESULT_CLOSED_SUNDAYS}  # closer coords
        mock_search.return_value = [far_result, near_result]
        state = self._make_state("2026-03-09T14:00:00")  # Monday
        result = run(state)
        if len(result["candidate_providers"]) >= 2:
            assert (
                result["candidate_providers"][0]["distance_km"]
                <= result["candidate_providers"][1]["distance_km"]
            )
