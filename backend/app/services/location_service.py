from datetime import datetime, timezone

from app.models.schemas import DeviceLocationPayload, DeviceLocation


class LocationService:
    """
    In-memory device-scoped location store for anonymous MVP.

    Stores the latest known location per device_id.
    """

    def __init__(self) -> None:
        self._store: dict[str, DeviceLocation] = {}

    def save_device_location(
        self, device_id: str, payload: DeviceLocationPayload
    ) -> DeviceLocation:
        updated_at = datetime.now(timezone.utc)
        location = DeviceLocation(
            device_id=device_id,
            lat=payload.lat,
            lng=payload.lng,
            accuracy_m=payload.accuracy_m,
            updated_at=updated_at,
        )
        self._store[device_id] = location
        return location

    def get_device_location(self, device_id: str) -> DeviceLocation | None:
        return self._store.get(device_id)

