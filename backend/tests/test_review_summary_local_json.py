"""
Integration-style test for review_analysis.summarizer using the local
exported Apify JSON fixture.

Skipped automatically when FEATHERLESS_API_KEY is not set in the environment,
so the CI suite remains green offline.

Run explicitly with a key:
    FEATHERLESS_API_KEY=<key> pytest tests/test_review_summary_local_json.py -v -s
"""

from __future__ import annotations

from pathlib import Path

import pytest

from app.config import FEATHERLESS_API_KEY
from app.services.review_analysis import (
    ReviewAnalysisRequest,
    ReviewSummary,
    analyze_reviews,
    load_reviews_from_exported_json,
    summarize_reviews,
)

pytestmark = pytest.mark.skipif(
    not FEATHERLESS_API_KEY,
    reason="FEATHERLESS_API_KEY not set — skipping live summarizer integration test",
)

_JSON_FIXTURE = (
    Path(__file__).resolve().parents[1]
    / "seed"
    / "dataset_Google-Maps-Reviews-Scraper_2026-03-10_18-07-20-965.json"
)


@pytest.fixture(scope="module")
def analysis_result():
    reviews = load_reviews_from_exported_json(str(_JSON_FIXTURE))
    return analyze_reviews(
        ReviewAnalysisRequest(
            reviews=reviews,
            top_k_positive=30,
            top_k_negative=30,
            skip_empty_text_for_summarization=True,
        )
    )


def test_summarizer_local_json_live(analysis_result):
    result = summarize_reviews(
        positive_reviews=analysis_result.positive_reviews,
        negative_reviews=analysis_result.negative_reviews,
        provider_label="Fixture business",
    )

    assert isinstance(result, ReviewSummary)
    assert isinstance(result.summary, str)
    assert result.summary.strip()
    assert 0.0 <= result.confidence <= 1.0
    assert isinstance(result.strengths, list)
    assert isinstance(result.weaknesses, list)
    assert isinstance(result.positive_aspects, list)
    assert isinstance(result.negative_aspects, list)
