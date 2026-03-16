"""
GET  /api/places/{place_id}          — place detail + summary
GET  /api/places/{place_id}/reviews  — raw reviews (paginated)

Controller layer: delegates to place_service as defined in
`doc/controller-service-contract.md`.
"""
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/places", tags=["places"])

# Service dependency (injected/mocked in tests or wired in at startup)
place_service: Any | None = None


@router.get("/{place_id}")
async def get_place_detail(place_id: str, request_id: str | None = None):
    """
    Return aggregated place detail plus the originating request_id (if any).
    
    Response follows PlaceDetailResponse contract:
    {
      "request_id": str | null,
      "detail": {
        "place": PlaceBasic,
        "review_summary": ReviewSummary,
        "rating_distribution": dict,
        "questions_and_answers": list | null,
        "customer_updates": list | null,
        "recommendation_reasons": list
      }
    }
    """
    if place_service is None:
        raise HTTPException(status_code=500, detail="place_service not configured")

    raw = place_service.get_place_detail(place_id, request_id)
    
    # Transform to PlaceDetailResponse contract structure
    place_basic = {
        "place_id": raw.get("id", place_id),
        "name": raw.get("name", ""),
        "address": raw.get("address", ""),
        "phone": None,  # Not captured by Apify currently
        "website": raw.get("website_url"),
        "location": raw.get("location", {}),
        "rating": raw.get("rating", 0.0),
        "rating_count": raw.get("review_count", 0),
        "price_level": _price_range_to_level(raw.get("price_range", "")),
        "status": _compute_status(raw.get("opening_hours", {})),
        "opening_hours": _format_opening_hours(raw.get("opening_hours", {})),
        "social_profiles": raw.get("social_profiles"),
        "popular_times": raw.get("popular_times"),
        "images": raw.get("images", []),
        "detailed_characteristics": None,  # Could extract from Apify amenities
    }
    
    review_summary = raw.get("review_summary", {})
    if not review_summary:
        review_summary = {"advantages": [], "disadvantages": [], "star_reasons": {}}
    # Prefer pipeline LLM summary (final summary after ranking/scoring) for WHY WE RECOMMEND THIS
    summary_text = (review_summary.get("summary") or "").strip()
    if summary_text:
        recommendation_reasons = [summary_text]
    elif raw.get("one_sentence_recommendation"):
        recommendation_reasons = [raw.get("one_sentence_recommendation", "")]
    else:
        recommendation_reasons = []

    return {
        "request_id": request_id,
        "detail": {
            "place": place_basic,
            "review_summary": review_summary,
            "rating_distribution": raw.get("review_distribution") or {},
            "questions_and_answers": None,  # Could add from Apify Q&A
            "customer_updates": None,
            "recommendation_reasons": recommendation_reasons,
        },
    }


def _price_range_to_level(price_range: str | None) -> str:
    """Convert price_range string to price_level enum."""
    if not price_range:
        return "medium"
    # Count $ symbols or check keywords
    if price_range.count("$") >= 3 or "expensive" in price_range.lower():
        return "high"
    if price_range.count("$") <= 1 or "cheap" in price_range.lower():
        return "low"
    return "medium"


def _compute_status(opening_hours: dict | None) -> str:
    """Compute current open/closed status from opening_hours."""
    from datetime import datetime
    if not opening_hours:
        return "open_now"  # Default assumption
    
    now = datetime.now()
    day_key = now.strftime("%a").lower()
    hours_str = opening_hours.get(day_key)
    
    if not hours_str:
        return "closed"
    
    try:
        open_str, close_str = hours_str.split("-")
        oh, om = map(int, open_str.split(":"))
        ch, cm = map(int, close_str.split(":"))
        
        current_minutes = now.hour * 60 + now.minute
        open_minutes = oh * 60 + om
        close_minutes = ch * 60 + cm
        
        # Handle overnight hours
        if close_minutes <= open_minutes:
            close_minutes += 24 * 60
        
        if current_minutes < open_minutes:
            return "closed"
        if current_minutes >= close_minutes:
            return "closed"
        if close_minutes - current_minutes <= 30:
            return "closing_soon"
        return "open_now"
    except (ValueError, IndexError):
        return "open_now"


def _format_opening_hours(opening_hours: dict | None) -> dict | None:
    """Format opening hours for today."""
    from datetime import datetime
    if not opening_hours:
        return None
    
    now = datetime.now()
    day_key = now.strftime("%a").lower()
    hours_str = opening_hours.get(day_key)
    
    if not hours_str:
        return {"today_open": "Closed", "today_close": "Closed", "is_open_now": False}
    
    try:
        open_str, close_str = hours_str.split("-")
        is_open = _compute_status(opening_hours) != "closed"
        return {
            "today_open": open_str,
            "today_close": close_str,
            "is_open_now": is_open,
        }
    except (ValueError, IndexError):
        return None


@router.get("/{place_id}/reviews")
async def list_place_reviews(
    place_id: str,
    page: int = 1,
    page_size: int = 20,
    sort: str = "relevance",
):
    """
    Return raw reviews for a place, as a paginated response.
    """
    if place_service is None:
        raise HTTPException(status_code=500, detail="place_service not configured")

    paged = place_service.list_reviews(place_id, page, page_size, sort)
    return paged

