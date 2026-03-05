"""
POST /api/offers  — provider submits a bid (US-02)
PATCH /api/offers/{id} — provider updates their bid

Backend-2 owns this file.

TODO:
  1. Validate that the provider exists and owns the offer (auth check)
  2. Insert offer into Supabase `offers` table
  3. Trigger Realtime broadcast so user sees the new offer live (US-12)
  4. Optionally re-run ranking for the request after a new offer comes in
"""
from fastapi import APIRouter, HTTPException

from app.models.schemas import SubmitOfferPayload

router = APIRouter(prefix="/api/offers", tags=["offers"])


@router.post("/")
async def submit_offer(payload: SubmitOfferPayload):
    """
    TODO (Backend-2):
      1. Check provider auth token
      2. Insert into `offers` table
      3. Broadcast via Supabase Realtime channel f"request:{payload.request_id}"
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.patch("/{offer_id}")
async def update_offer(offer_id: str, payload: dict):
    """
    TODO (Backend-2): allow provider to update price/eta before user accepts.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
