"""
POST /api/offers        — provider submits a bid (US-02)
PATCH /api/offers/{id}  — provider updates their bid

Controller layer: delegates to auth_service, request_service and offer_service
as defined in `doc/controller-service-contract.md`.
"""
from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.schemas import SubmitOfferPayload

router = APIRouter(prefix="/api/offers", tags=["offers"])

# Service dependencies (injected/mocked in tests or wired in at startup)
auth_service: Any | None = None
request_service: Any | None = None
offer_service: Any | None = None


class SubmitOfferBody(BaseModel):
    """
    Lightweight input model aligned with current client payload and tests.
    Mapped to SubmitOfferPayload before calling offer_service.
    """

    request_id: str
    price: float
    eta_minutes: int
    message: str | None = None


@router.post("/")
async def submit_offer(payload: SubmitOfferBody):
    """
    Provider submits an offer for a request.
    """
    if auth_service is None:
        raise HTTPException(
            status_code=500, detail="auth_service not configured"
        )

    provider_id = auth_service.get_current_provider_id()
    if not provider_id:
        raise HTTPException(status_code=401, detail="Provider authentication required")

    if request_service is None:
        raise HTTPException(
            status_code=500, detail="request_service not configured"
        )
    if offer_service is None:
        raise HTTPException(
            status_code=500, detail="offer_service not configured"
        )

    # Ensure the target request exists before accepting the offer.
    request_service.ensure_request_exists(payload.request_id)

    submit_payload = SubmitOfferPayload(
        request_id=payload.request_id,
        provider_id=provider_id,
        price=payload.price,
        eta_minutes=payload.eta_minutes,
        slot_time=datetime.utcnow(),
        notes=payload.message,
    )

    offer = offer_service.submit_offer(submit_payload)
    return offer


@router.patch("/{offer_id}")
async def update_offer(offer_id: str, payload: dict):
    """
    Placeholder for future offer update capability.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
