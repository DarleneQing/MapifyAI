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
    """
    if place_service is None:
        raise HTTPException(status_code=500, detail="place_service not configured")

    detail = place_service.get_place_detail(place_id, request_id)
    return {"place": detail, "request_id": request_id}


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

