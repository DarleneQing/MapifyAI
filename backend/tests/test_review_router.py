"""Focused unit tests for review_router.

These tests verify only routing and normalization behavior.
All external calls are mocked so the suite stays fast and offline.
"""

from __future__ import annotations

from unittest.mock import patch

from app.services.review_router import route_review_summaries


def _provider(
    provider_id: str = "place-1",
    google_maps_url: str = "https://maps.google.com/?cid=123",
) -> dict:
    return {
        "id": provider_id,
        "name": f"Provider {provider_id}",
        "google_maps_url": google_maps_url,
    }


def test_simple_mode_uses_existing_simple_path_and_returns_normalized_contract():
    providers = [_provider("p-1")]

    with patch(
        "app.services.review_router.summarise_providers",
        return_value=[
            {
                "place_id": "p-1",
                "advantages": ["Friendly staff"],
                "disadvantages": ["Long wait"],
            }
        ],
    ) as mock_simple:
        result = route_review_summaries(providers, review_mode="simple")

    mock_simple.assert_called_once_with(providers)
    assert result == [
        {
            "place_id": "p-1",
            "advantages": ["Friendly staff"],
            "disadvantages": ["Long wait"],
            "summary": "",
        }
    ]


def test_advanced_mode_returns_normalized_contract():
    providers = [_provider("p-advanced", "https://maps.google.com/?cid=456")]

    with patch(
        "app.services.review_router.analyze_and_summarize_reviews",
        return_value={
            "orchestrator_payload": {
                "strengths": ["Clean environment", "Professional service"],
                "weaknesses": ["Small space"],
            }
        },
    ) as mock_advanced:
        result = route_review_summaries(providers, review_mode="advanced")

    mock_advanced.assert_called_once_with(place_url="https://maps.google.com/?cid=456")
    assert result == [
        {
            "place_id": "p-advanced",
            "advantages": ["Clean environment", "Professional service"],
            "disadvantages": ["Small space"],
            "summary": "",
        }
    ]


def test_fallback_mode_survives_advanced_failure_and_returns_valid_summary():
    provider = _provider("p-fallback", "https://maps.google.com/?cid=789")

    with patch(
        "app.services.review_router.analyze_and_summarize_reviews",
        side_effect=RuntimeError("advanced failed"),
    ) as mock_advanced, patch(
        "app.services.review_router.summarise_providers",
        return_value=[
            {
                "place_id": "p-fallback",
                "advantages": ["Good value"],
                "disadvantages": [],
            }
        ],
    ) as mock_simple:
        result = route_review_summaries([provider], review_mode="fallback")

    mock_advanced.assert_called_once_with(place_url="https://maps.google.com/?cid=789")
    mock_simple.assert_called_once_with([provider])
    assert result == [
        {
            "place_id": "p-fallback",
            "advantages": ["Good value"],
            "disadvantages": [],
            "summary": "",
        }
    ]


def test_advanced_mode_includes_rating_distribution_with_string_keys():
    """Rating distribution from advanced pipeline is normalized with string keys '1'-'5'."""
    providers = [_provider("p-dist", "https://maps.google.com/?cid=999")]

    with patch(
        "app.services.review_router.analyze_and_summarize_reviews",
        return_value={
            "orchestrator_payload": {
                "strengths": [],
                "weaknesses": [],
                "rating_distribution": {1: 2, 2: 0, 3: 1, 4: 5, 5: 10},
            }
        },
    ):
        result = route_review_summaries(providers, review_mode="advanced")

    assert len(result) == 1
    assert result[0]["place_id"] == "p-dist"
    assert result[0]["rating_distribution"] == {
        "1": 2, "2": 0, "3": 1, "4": 5, "5": 10,
    }


def test_place_id_still_matches_provider_id_expected_by_orchestrator():
    provider = _provider("provider-join")

    with patch(
        "app.services.review_router.summarise_providers",
        return_value=[
            {
                "advantages": ["Near station"],
                "disadvantages": ["Busy at peak times"],
            }
        ],
    ):
        summaries = route_review_summaries([provider], review_mode="simple")

    review_map = {item["place_id"]: item for item in summaries}

    assert summaries[0]["place_id"] == provider["id"]
    assert review_map[provider["id"]]["advantages"] == ["Near station"]
    assert review_map[provider["id"]]["disadvantages"] == ["Busy at peak times"]