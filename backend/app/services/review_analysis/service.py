"""
High-level end-to-end review_analysis pipeline service.

Flow:
place_url -> Apify actor -> dataset items -> filtering -> LLM summary
or
existing dataset_id -> dataset items -> filtering -> LLM summary
"""

from __future__ import annotations

import time
from typing import Any, Optional

from .apify_client import (
    load_reviews_from_dataset,
    run_google_maps_reviews_scraper,
)
from .filtering import analyze_reviews
from .schemas import ReviewAnalysisRequest
from .summarizer import (
    build_orchestrator_summary_payload,
    summarize_reviews,
)


def analyze_and_summarize_reviews(
    dataset_id: Optional[str] = None,
    place_url: Optional[str] = None,
    top_k_positive: int = 30,
    top_k_negative: int = 30,
    skip_empty_text_for_summarization: bool = True,
    max_reviews: int = 100,
    reviews_start_date: str = "1 year",
    language: str = "en",
    personal_data: bool = False,
    debug_include_selected_reviews: bool = False,
) -> dict[str, Any]:
    """Run review analysis and summarization in dataset_id or place_url mode."""
    if bool(dataset_id) == bool(place_url):
        raise ValueError("Provide exactly one of dataset_id or place_url")

    total_started_at = time.perf_counter()
    actor_runtime_seconds = 0.0

    resolved_dataset_id = dataset_id
    if place_url:
        actor_started_at = time.perf_counter()
        resolved_dataset_id = run_google_maps_reviews_scraper(
            place_url=place_url,
            max_reviews=max_reviews,
            reviews_start_date=reviews_start_date,
            language=language,
            personal_data=personal_data,
        )
        actor_runtime_seconds = time.perf_counter() - actor_started_at

    reviews = load_reviews_from_dataset(resolved_dataset_id)

    filtering_started_at = time.perf_counter()
    analysis = analyze_reviews(
        ReviewAnalysisRequest(
            reviews=reviews,
            top_k_positive=top_k_positive,
            top_k_negative=top_k_negative,
            skip_empty_text_for_summarization=skip_empty_text_for_summarization,
        )
    )
    filtering_seconds = time.perf_counter() - filtering_started_at

    summarization_started_at = time.perf_counter()
    summary_result = summarize_reviews(
        positive_reviews=analysis.positive_reviews,
        negative_reviews=analysis.negative_reviews,
    )
    summarization_seconds = time.perf_counter() - summarization_started_at
    total_runtime_seconds = time.perf_counter() - total_started_at

    orchestrator_payload = build_orchestrator_summary_payload(summary_result)
    orchestrator_payload.update(
        {
            "avg_rating_recent": analysis.stats.avg_rating_recent,
            "rating_distribution": analysis.stats.rating_distribution,
            "text_review_count": len(analysis.text_reviews),
            "empty_text_review_count": analysis.stats.empty_text_review_count,
            "selected_positive_review_count": len(analysis.positive_reviews),
            "selected_negative_review_count": len(analysis.negative_reviews),
        }
    )

    result: dict[str, Any] = {
        "dataset_id": resolved_dataset_id,
        "orchestrator_payload": orchestrator_payload,
        "summary_result": summary_result.model_dump(mode="json"),
        "review_stats": analysis.stats.model_dump(mode="json"),
        "debug": {
            "mode": "place_url" if place_url else "dataset_id",
            "input_place_url": place_url,
            "actor_runtime_seconds": round(actor_runtime_seconds, 6),
            "filtering_seconds": round(filtering_seconds, 6),
            "summarization_seconds": round(summarization_seconds, 6),
            "total_runtime_seconds": round(total_runtime_seconds, 6),
            "mapped_review_count": len(reviews),
            "deduplicated_review_count": len(analysis.all_reviews_with_rating),
            "text_review_count": len(analysis.text_reviews),
        },
    }

    if debug_include_selected_reviews:
        result["debug"]["selected_reviews"] = {
            "positive": [r.model_dump(mode="json") for r in analysis.positive_reviews],
            "negative": [r.model_dump(mode="json") for r in analysis.negative_reviews],
        }

    return result
