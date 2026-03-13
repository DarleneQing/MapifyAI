"""
Integration-style tests for review_analysis.apify_client.

The Apify HTTP calls are fully mocked via unittest.mock so this test
suite works offline and without a real APIFY_API_TOKEN.
"""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services.review_analysis.apify_client import (
    _build_google_maps_reviews_actor_input,
    load_reviews_from_dataset,
    map_apify_item_to_review,
    run_google_maps_reviews_scraper,
)
from app.services.review_analysis.schemas import ReviewItem

# ---------------------------------------------------------------------------
# Fixtures / shared raw data
# ---------------------------------------------------------------------------

VALID_RAW_ITEM = {
    "reviewId": "abc123",
    "text": "Great haircut, very friendly staff!",
    "stars": 5,
    "publishedAtDate": "2025-11-01T10:00:00Z",
    "reviewerName": "Alice",
    "reviewImageUrls": [],
    "responseFromOwnerText": "Thank you!",
}

MINIMAL_RAW_ITEM = {
    "reviewId": "min1",
    "stars": 3,
    "publishedAtDate": "2025-06-15T08:30:00+00:00",
}

MISSING_STARS_ITEM = {
    "reviewId": "no_stars",
    "text": "Nice place",
    "publishedAtDate": "2025-01-01T00:00:00Z",
}

MISSING_DATE_ITEM = {
    "reviewId": "no_date",
    "stars": 4,
    "text": "Good service",
}

INVALID_STARS_ITEM = {
    "reviewId": "bad_stars",
    "stars": 99,
    "publishedAtDate": "2025-01-01T00:00:00Z",
}

EMPTY_TEXT_ITEM = {
    "reviewId": "blank_text",
    "stars": 4,
    "text": "",
    "publishedAtDate": "2025-03-20T12:00:00Z",
}

# ---------------------------------------------------------------------------
# map_apify_item_to_review — unit-level
# ---------------------------------------------------------------------------

class TestMapApifyItemToReview:
    def test_maps_full_item(self):
        result = map_apify_item_to_review(VALID_RAW_ITEM, provider_id="salon-1")
        assert isinstance(result, ReviewItem)
        assert result.id == "abc123"
        assert result.provider_id == "salon-1"
        assert result.stars == 5.0
        assert result.text == "Great haircut, very friendly staff!"
        assert result.date == datetime(2025, 11, 1, 10, 0, 0, tzinfo=timezone.utc)

    def test_maps_minimal_item_no_text(self):
        result = map_apify_item_to_review(MINIMAL_RAW_ITEM)
        assert result is not None
        assert result.id == "min1"
        assert result.text is None
        assert result.stars == 3.0

    def test_returns_none_when_stars_missing(self):
        assert map_apify_item_to_review(MISSING_STARS_ITEM) is None

    def test_returns_none_when_date_missing(self):
        assert map_apify_item_to_review(MISSING_DATE_ITEM) is None

    def test_returns_none_when_stars_out_of_range(self):
        assert map_apify_item_to_review(INVALID_STARS_ITEM) is None

    def test_empty_string_text_normalised_to_none(self):
        result = map_apify_item_to_review(EMPTY_TEXT_ITEM)
        assert result is not None
        assert result.text is None

    def test_no_review_id_maps_to_none_id(self):
        raw = {
            "stars": 4,
            "text": "Good",
            "publishedAtDate": "2025-01-01T00:00:00Z",
        }
        result = map_apify_item_to_review(raw)
        assert result is not None
        assert result.id is None

    def test_date_without_timezone_assumed_utc(self):
        raw = {
            "reviewId": "tz_test",
            "stars": 4,
            "publishedAtDate": "2025-05-10T14:30:00",  # no tz info
        }
        result = map_apify_item_to_review(raw)
        assert result is not None
        assert result.date.tzinfo is not None


# ---------------------------------------------------------------------------
# load_reviews_from_dataset — integration (mocked ApifyClient)
# ---------------------------------------------------------------------------

def _make_mock_client(items: list[dict]) -> MagicMock:
    """Return a MagicMock ApifyClient whose dataset().list_items() returns items."""
    mock_response = MagicMock()
    mock_response.items = items

    mock_dataset = MagicMock()
    mock_dataset.list_items.return_value = mock_response

    mock_client = MagicMock()
    mock_client.dataset.return_value = mock_dataset
    return mock_client


class TestLoadReviewsFromDataset:
    DATASET_ID = "fake-dataset-id-001"

    def test_returns_mapped_reviews(self):
        raw_items = [VALID_RAW_ITEM, MINIMAL_RAW_ITEM]
        mock_client = _make_mock_client(raw_items)

        with patch(
            "app.services.review_analysis.apify_client.ApifyClient",
            return_value=mock_client,
        ):
            reviews = load_reviews_from_dataset(self.DATASET_ID, provider_id="p1")

        assert len(reviews) == 2
        assert all(isinstance(r, ReviewItem) for r in reviews)
        assert reviews[0].id == "abc123"
        assert reviews[0].provider_id == "p1"

    def test_skips_items_with_invalid_fields(self):
        raw_items = [VALID_RAW_ITEM, MISSING_STARS_ITEM, MISSING_DATE_ITEM]
        mock_client = _make_mock_client(raw_items)

        with patch(
            "app.services.review_analysis.apify_client.ApifyClient",
            return_value=mock_client,
        ):
            reviews = load_reviews_from_dataset(self.DATASET_ID)

        assert len(reviews) == 1
        assert reviews[0].id == "abc123"

    def test_passes_limit_to_apify(self):
        mock_client = _make_mock_client([VALID_RAW_ITEM])

        with patch(
            "app.services.review_analysis.apify_client.ApifyClient",
            return_value=mock_client,
        ):
            load_reviews_from_dataset(self.DATASET_ID, limit=10)

        mock_client.dataset.assert_called_once_with(self.DATASET_ID)
        mock_client.dataset().list_items.assert_called_once_with(limit=10)

    def test_no_limit_does_not_pass_limit_kwarg(self):
        mock_client = _make_mock_client([VALID_RAW_ITEM])

        with patch(
            "app.services.review_analysis.apify_client.ApifyClient",
            return_value=mock_client,
        ):
            load_reviews_from_dataset(self.DATASET_ID)

        mock_client.dataset().list_items.assert_called_once_with()

    def test_empty_dataset_returns_empty_list(self):
        mock_client = _make_mock_client([])

        with patch(
            "app.services.review_analysis.apify_client.ApifyClient",
            return_value=mock_client,
        ):
            reviews = load_reviews_from_dataset(self.DATASET_ID)

        assert reviews == []

    def test_apify_error_propagates(self):
        mock_client = MagicMock()
        mock_client.dataset.return_value.list_items.side_effect = RuntimeError("network error")

        with patch(
            "app.services.review_analysis.apify_client.ApifyClient",
            return_value=mock_client,
        ):
            with pytest.raises(RuntimeError, match="network error"):
                load_reviews_from_dataset(self.DATASET_ID)


class TestRunGoogleMapsReviewsScraper:
    def test_build_actor_input(self):
        payload = _build_google_maps_reviews_actor_input(
            place_url="https://maps.google.com/?cid=123",
            max_reviews=50,
            reviews_start_date="6 months",
            language="de",
            personal_data=True,
        )
        assert payload == {
            "startUrls": [{"url": "https://maps.google.com/?cid=123"}],
            "maxReviews": 50,
            "reviewsStartDate": "6 months",
            "language": "de",
            "personalData": True,
        }

    def test_returns_dataset_id_when_actor_succeeds(self):
        mock_client = MagicMock()
        mock_client.actor.return_value.call.return_value = {
            "defaultDatasetId": "dataset-xyz"
        }

        with patch(
            "app.services.review_analysis.apify_client.APIFY_API_TOKEN",
            "test-token",
        ), patch(
            "app.services.review_analysis.apify_client.ApifyClient",
            return_value=mock_client,
        ):
            dataset_id = run_google_maps_reviews_scraper(
                place_url="https://maps.google.com/?cid=123"
            )

        assert dataset_id == "dataset-xyz"
        mock_client.actor.assert_called_once()
        called_kwargs = mock_client.actor().call.call_args.kwargs
        assert "run_input" in called_kwargs
        assert called_kwargs["run_input"]["startUrls"][0]["url"] == "https://maps.google.com/?cid=123"

    def test_raises_when_actor_returns_no_dataset(self):
        mock_client = MagicMock()
        mock_client.actor.return_value.call.return_value = {}

        with patch(
            "app.services.review_analysis.apify_client.APIFY_API_TOKEN",
            "test-token",
        ), patch(
            "app.services.review_analysis.apify_client.ApifyClient",
            return_value=mock_client,
        ):
            with pytest.raises(RuntimeError, match="no output dataset ID"):
                run_google_maps_reviews_scraper(
                    place_url="https://maps.google.com/?cid=123"
                )
