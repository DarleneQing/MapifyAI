"""
GET  /api/providers        — list providers (optional category/location filter)
GET  /api/providers/{id}   — provider detail page (US-07)

Controller layer: delegates to provider_service as defined in
`doc/controller-service-contract.md`.
"""
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/api/providers", tags=["providers"])

# Service dependency (injected/mocked in tests or wired in at startup)
provider_service: Any | None = None


@router.get("/")
async def list_providers(
    category: str | None = None,
    lat: float | None = None,
    lng: float | None = None,
    radius_km: float = 5.0,
):
    """
    List providers with optional category and geo filters.
    """
    if provider_service is None:
        raise HTTPException(
            status_code=500, detail="provider_service not configured"
        )

    providers = provider_service.list_providers(category, lat, lng, radius_km)
    return providers


@router.get("/{provider_id}")
async def get_provider(provider_id: str):
    """
    Fetch provider detail, including any aggregated review summary.
    """
    if provider_service is None:
        raise HTTPException(
            status_code=500, detail="provider_service not configured"
        )

    provider = provider_service.get_provider(provider_id)
    return provider
