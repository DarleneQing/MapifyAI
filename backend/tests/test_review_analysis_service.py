"""Unit tests for review_analysis.service (Step 4 pipeline entry point)."""

from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import patch

from app.services.review_analysis.schemas import (
    ReviewAnalysisResult,
    ReviewItem,
    ReviewStats,
    ReviewSummary,
)
from app.services.review_analysis.service import analyze_and_summarize_reviews


def _make_review(stars: float, text: str, id: str) -> ReviewItem:
    return ReviewItem(
        id=id,
        stars=stars,
        text=text,
        date=datetime(2025, 6, 1, tzinfo=timezone.utc),
    )


def _analysis_result() -> ReviewAnalysisResult:
    positive = [_make_review(5.0, "excellent food", "p1")]
    negative = [_make_review(2.0, "slow service", "n1")]
    all_reviews = positive + negative
    return ReviewAnalysisResult(
        positive_reviews=positive,
        negative_reviews=negative,
        all_reviews_with_rating=all_reviews,
        text_reviews=all_reviews,
        stats=ReviewStats(
            avg_rating_recent=3.5,
            rating_distribution={1: 0, 2: 1, 3: 0, 4: 0, 5: 1},
            empty_text_review_count=0,
        ),
    )


def _summary() -> ReviewSummary:
    return ReviewSummary(
        strengths=["great taste"],
        weaknesses=["long wait"],
        positive_aspects=["taste"],
        negative_aspects=["waiting_time"],
        summary="Great flavor but waiting time can be long.",
        confidence=0.82,
    )


class TestAnalyzeAndSummarizeReviews:
    def test_dataset_mode_returns_lightweight_orchestrator_payload(self):
        with patch(
            "app.services.review_analysis.service.load_reviews_from_dataset",
            return_value=[_make_review(5.0, "excellent", "r1")],
        ), patch(
            "app.services.review_analysis.service.analyze_reviews",
            return_value=_analysis_result(),
        ), patch(
            "app.services.review_analysis.service.summarize_reviews",
            return_value=_summary(),
        ):
            result = analyze_and_summarize_reviews(dataset_id="dataset-123")

        payload = result["orchestrator_payload"]
        assert set(payload.keys()) == {
            "strengths",
            "weaknesses",
            "positive_aspects",
            "negative_aspects",
            "summary",
            "confidence",
            "avg_rating_recent",
            "rating_distribution",
            "text_review_count",
            "empty_text_review_count",
            "selected_positive_review_count",
            "selected_negative_review_count",
        }
        assert "selected_reviews" not in payload
        assert result["dataset_id"] == "dataset-123"
        assert result["debug"]["mode"] == "dataset_id"

    def test_place_url_mode_runs_actor_then_dataset_loading(self):
        with patch(
            "app.services.review_analysis.service.run_google_maps_reviews_scraper",
            return_value="dataset-from-actor",
        ) as mock_run_actor, patch(
            "app.services.review_analysis.service.load_reviews_from_dataset",
            return_value=[_make_review(4.0, "good", "r1")],
        ) as mock_load_dataset, patch(
            "app.services.review_analysis.service.analyze_reviews",
            return_value=_analysis_result(),
        ), patch(
            "app.services.review_analysis.service.summarize_reviews",
            return_value=_summary(),
        ):
            result = analyze_and_summarize_reviews(
                place_url="https://maps.google.com/?cid=123"
            )

        mock_run_actor.assert_called_once()
        mock_load_dataset.assert_called_once_with("dataset-from-actor")
        assert result["dataset_id"] == "dataset-from-actor"
        assert result["debug"]["mode"] == "place_url"
        assert "actor_runtime_seconds" in result["debug"]
        assert "filtering_seconds" in result["debug"]
        assert "summarization_seconds" in result["debug"]
        assert "total_runtime_seconds" in result["debug"]

    def test_debug_can_include_selected_reviews(self):
        with patch(
            "app.services.review_analysis.service.load_reviews_from_dataset",
            return_value=[_make_review(5.0, "excellent", "r1")],
        ), patch(
            "app.services.review_analysis.service.analyze_reviews",
            return_value=_analysis_result(),
        ), patch(
            "app.services.review_analysis.service.summarize_reviews",
            return_value=_summary(),
        ):
            result = analyze_and_summarize_reviews(
                dataset_id="dataset-123",
                debug_include_selected_reviews=True,
            )

        assert "selected_reviews" in result["debug"]
        assert set(result["debug"]["selected_reviews"].keys()) == {"positive", "negative"}
