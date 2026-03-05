"""
GET  /api/providers        — list providers (optional category/location filter)
GET  /api/providers/{id}   — provider detail page (US-07)

Backend-2 owns this file.

TODO:
  1. Fetch from Supabase `providers` table
  2. Include reviews summary if Backend-3 has generated it
"""
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("/")
async def list_providers(category: str | None = None, lat: float | None = None, lng: float | None = None, radius_km: float = 5.0):
    """
    TODO (Backend-2): query providers table with optional filters.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/{provider_id}")
async def get_provider(provider_id: str):
    """
    TODO (Backend-2): fetch single provider row + its reviews summary (from Backend-3).
    Return fields: name, address, rating, opening_hours, price_range,
                   website_url, google_maps_url, pros, cons.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
