"""
Integration-style test for local exported Apify JSON ingestion.
"""

from __future__ import annotations

from pathlib import Path

from app.services.review_analysis import (
    ReviewAnalysisRequest,
    analyze_reviews,
    load_reviews_from_exported_json,
)


def test_local_exported_json_review_analysis_flow():
    json_file = (
        Path(__file__).resolve().parents[1]
        / "seed"
        / "dataset_Google-Maps-Reviews-Scraper_2026-03-10_18-07-20-965.json"
    )

    reviews = load_reviews_from_exported_json(str(json_file))
    assert len(reviews) > 0

    result = analyze_reviews(
        ReviewAnalysisRequest(
            reviews=reviews,
            top_k_positive=30,
            top_k_negative=30,
            skip_empty_text_for_summarization=True,
        )
    )

    assert 1.0 <= result.stats.avg_rating_recent <= 5.0
    assert set(result.stats.rating_distribution.keys()) == {1, 2, 3, 4, 5}
    assert len(result.positive_reviews) <= 30
    assert len(result.negative_reviews) <= 30
    assert all(r.text is not None and r.text.strip() for r in result.text_reviews)
