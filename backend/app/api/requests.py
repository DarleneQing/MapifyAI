"""
POST /api/requests  — create a new request and trigger the agent pipeline
GET  /api/requests/{id}         — fetch request details
GET  /api/requests/{id}/offers  — fetch ranked offers for a request
GET  /api/requests/{id}/trace   — fetch agent trace (US-13)

Backend-2: implement the DB persistence + realtime broadcast
Backend-1: wire in run_pipeline() from agents/graph.py
"""
from fastapi import APIRouter, HTTPException

from app.models.schemas import CreateRequestPayload, RankedOffersResponse

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.post("/", response_model=RankedOffersResponse)
async def create_request(payload: CreateRequestPayload):
    """
    TODO (Backend-1):
      1. Call run_pipeline(payload.raw_input, payload.location.model_dump(), ...)
      2. Persist structured_request to Supabase `requests` table (Backend-2)
      3. Persist ranked_offers to Supabase `offers` table (Backend-2)
      4. Broadcast new offers via Supabase Realtime (Backend-2)
      5. Return RankedOffersResponse
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{request_id}")
async def get_request(request_id: str):
    """
    TODO (Backend-2): fetch request row from Supabase by id.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{request_id}/offers")
async def get_offers(request_id: str):
    """
    TODO (Backend-2): fetch offers from Supabase, ordered by score desc.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{request_id}/trace")
async def get_trace(request_id: str):
    """
    TODO (Backend-2): fetch agent trace JSON stored alongside the request.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
