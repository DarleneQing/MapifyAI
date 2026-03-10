from typing import Any

from fastapi import APIRouter, HTTPException

from app.models.schemas import DeviceLocationPayload, DeviceLocation
from app.services.location_service import LocationService


router = APIRouter(prefix="/api/location", tags=["location"])

# Service dependency (can be overridden in wiring/tests if needed)
location_service: LocationService | None = LocationService()


@router.put("/current", response_model=DeviceLocation)
async def put_current_location(
    payload: DeviceLocationPayload, device_id: str | None = None
) -> DeviceLocation:
    if not device_id:
        raise HTTPException(
            status_code=400, detail="device_id query parameter is required"
        )

    if location_service is None:
        raise HTTPException(status_code=500, detail="location_service not configured")

    return location_service.save_device_location(device_id, payload)


@router.get("/current", response_model=DeviceLocation)
async def get_current_location(device_id: str | None = None) -> DeviceLocation:
    if not device_id:
        raise HTTPException(
            status_code=400, detail="device_id query parameter is required"
        )

    if location_service is None:
        raise HTTPException(status_code=500, detail="location_service not configured")

    location = location_service.get_device_location(device_id)
    if location is None:
        raise HTTPException(
            status_code=404, detail="Location not found for this device_id"
        )

    return location

