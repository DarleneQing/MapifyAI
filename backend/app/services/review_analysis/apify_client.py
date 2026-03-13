"""
Apify ingestion helpers for review_analysis.

Supports two paths:
1) Read an already completed dataset by dataset ID.
2) Trigger Google Maps Reviews Scraper actor online and return dataset ID.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from apify_client import ApifyClient

from app.config import APIFY_API_TOKEN
from app.services.review_analysis.schemas import ReviewItem

logger = logging.getLogger(__name__)

DEFAULT_GOOGLE_MAPS_REVIEWS_ACTOR_ID = "compass/google-maps-reviews-scraper"

# ---------------------------------------------------------------------------
# Field mapping
# ---------------------------------------------------------------------------

# Expected raw fields from compass/crawler-google-places reviews:
#   reviewId            – unique review identifier
#   text                – review body text (may be absent / null)
#   stars               – numeric 1-5 rating (may be absent for text-only)
#   publishedAtDate     – ISO-8601 datetime string
#   reviewerName        – display name of the reviewer
#   reviewImageUrls     – list of image URLs attached to the review
#   responseFromOwnerText – owner reply text (may be absent)


def _parse_date(raw: Any) -> Optional[datetime]:
    """Parse an ISO-8601 string from Apify into an aware datetime.

    Returns None on any parse failure so callers can decide whether to skip.
    """
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except (ValueError, TypeError):
        logger.warning("Could not parse date value: %r", raw)
        return None


def _parse_stars(raw: Any) -> Optional[float]:
    """Convert a raw stars value to float in [1, 5].

    Returns None when the value is missing or outside valid range.
    """
    if raw is None:
        return None
    try:
        value = float(raw)
        if 1.0 <= value <= 5.0:
            return value
        logger.warning("Stars value out of range, skipping: %r", raw)
        return None
    except (TypeError, ValueError):
        logger.warning("Could not parse stars value: %r", raw)
        return None


def map_apify_item_to_review(
    raw: dict[str, Any],
    provider_id: Optional[str] = None,
) -> Optional[ReviewItem]:
    """Map a single raw Apify dataset item to a ReviewItem.

    Returns None if required fields (stars, date) are missing or invalid so
    the caller can easily filter out unusable entries.
    """
    stars = _parse_stars(raw.get("stars"))
    if stars is None:
        logger.debug("Skipping review without valid stars: id=%r", raw.get("reviewId"))
        return None

    date = _parse_date(raw.get("publishedAtDate"))
    if date is None:
        logger.debug("Skipping review without valid date: id=%r", raw.get("reviewId"))
        return None

    return ReviewItem(
        id=str(raw["reviewId"]) if raw.get("reviewId") is not None else None,
        provider_id=provider_id,
        stars=stars,
        text=raw.get("text") or None,       # normalise empty string → None
        date=date,
    )


def _build_google_maps_reviews_actor_input(
    place_url: str,
    max_reviews: int = 100,
    reviews_start_date: str = "1 year",
    language: str = "en",
    personal_data: bool = False,
) -> dict[str, Any]:
    """Build run_input payload for Google Maps Reviews Scraper actor."""
    return {
        "startUrls": [{"url": place_url}],
        "maxReviews": max_reviews,
        "reviewsStartDate": reviews_start_date,
        "language": language,
        "personalData": personal_data,
    }


def run_google_maps_reviews_scraper(
    place_url: str,
    max_reviews: int = 100,
    reviews_start_date: str = "1 year",
    language: str = "en",
    personal_data: bool = False,
    actor_id: Optional[str] = None,
) -> str:
    """Run Apify Google Maps Reviews Scraper and return output dataset ID."""
    if not place_url or not place_url.strip():
        raise ValueError("place_url is required")
    if not APIFY_API_TOKEN:
        raise RuntimeError("APIFY_API_TOKEN is not configured")

    selected_actor_id = (
        actor_id
        or os.getenv("APIFY_GOOGLE_MAPS_REVIEWS_ACTOR_ID")
        or DEFAULT_GOOGLE_MAPS_REVIEWS_ACTOR_ID
    )

    client = ApifyClient(APIFY_API_TOKEN)
    run_input = _build_google_maps_reviews_actor_input(
        place_url=place_url,
        max_reviews=max_reviews,
        reviews_start_date=reviews_start_date,
        language=language,
        personal_data=personal_data,
    )

    try:
        run = client.actor(selected_actor_id).call(run_input=run_input)
    except Exception as exc:
        raise RuntimeError(
            f"Apify actor run failed for {selected_actor_id!r}: {exc}"
        ) from exc

    dataset_id = run.get("defaultDatasetId") if isinstance(run, dict) else None
    if not dataset_id:
        raise RuntimeError(
            f"Apify actor run completed but no output dataset ID was produced for {selected_actor_id!r}"
        )

    logger.info(
        "Apify actor %r finished; dataset_id=%r",
        selected_actor_id,
        dataset_id,
    )
    return str(dataset_id)


# ---------------------------------------------------------------------------
# Dataset loader
# ---------------------------------------------------------------------------

def load_reviews_from_dataset(
    dataset_id: str,
    provider_id: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[ReviewItem]:
    """Fetch all items from an Apify dataset and return mapped ReviewItems.

    Args:
        dataset_id:   The Apify dataset ID to pull from.
        provider_id:  Optional business identifier to attach to every review.
        limit:        If set, fetch at most this many items from the dataset.

    Returns:
        A list of successfully mapped ReviewItems.  Items that are missing
        required fields (stars or date) are silently dropped and a warning is
        logged.
    """
    client = ApifyClient(APIFY_API_TOKEN)

    kwargs: dict[str, Any] = {}
    if limit is not None:
        kwargs["limit"] = limit

    try:
        response = client.dataset(dataset_id).list_items(**kwargs)
        raw_items: list[dict] = response.items
    except Exception as exc:
        logger.error("Failed to fetch Apify dataset %r: %s", dataset_id, exc)
        raise

    reviews: list[ReviewItem] = []
    for raw in raw_items:
        review = map_apify_item_to_review(raw, provider_id=provider_id)
        if review is not None:
            reviews.append(review)

    logger.info(
        "Loaded %d/%d reviews from Apify dataset %r",
        len(reviews),
        len(raw_items),
        dataset_id,
    )
    return reviews


def load_reviews_from_exported_json(
    json_file_path: str,
    provider_id: Optional[str] = None,
    limit: Optional[int] = None,
) -> list[ReviewItem]:
    """Load reviews from a local Apify-exported JSON file.

    The JSON must be an array of raw review objects. Items are mapped via
    ``map_apify_item_to_review`` and invalid entries are skipped.
    """
    path = Path(json_file_path)
    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

    if not isinstance(payload, list):
        raise ValueError(
            f"Expected a JSON array in {json_file_path!r}, got {type(payload).__name__}"
        )

    raw_items: list[dict[str, Any]] = [item for item in payload if isinstance(item, dict)]
    if limit is not None:
        raw_items = raw_items[:limit]

    reviews: list[ReviewItem] = []
    for raw in raw_items:
        review = map_apify_item_to_review(raw, provider_id=provider_id)
        if review is not None:
            reviews.append(review)

    logger.info(
        "Loaded %d raw items and mapped %d reviews from local JSON %r",
        len(raw_items),
        len(reviews),
        json_file_path,
    )
    return reviews
