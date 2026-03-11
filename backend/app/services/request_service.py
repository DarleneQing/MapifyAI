"""
Request service — creates and validates StructuredRequest records.

This service is used by the requests controller and offers controller.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.config import DEFAULT_RADIUS_KM
from app.models.schemas import CreateRequestPayload, StructuredRequest


class RequestService:
    def __init__(self, marketplace: Any):
        self._marketplace = marketplace

    def create_request(self, payload: CreateRequestPayload, user_id: str | None) -> dict:
        """
        Create and persist a new request record.

        Returns a dict so controller code can access ["id"] consistently.
        """
        request_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)

        constraints: dict[str, Any] = {}
        if user_id:
            constraints["user_id"] = user_id

        structured = StructuredRequest(
            id=request_id,
            raw_input=payload.get_raw_input(),
            category="general",
            requested_time=now,
            location=payload.location,
            radius_km=DEFAULT_RADIUS_KM,
            constraints=constraints,
            status="open",
            created_at=now,
        )

        record = structured.model_dump()
        # Preserve preferences for the orchestrator (not part of StructuredRequest schema)
        record["preferences"] = payload.preferences.model_dump() if payload.preferences else None

        if self._marketplace is not None and hasattr(self._marketplace, "persist_request"):
            self._marketplace.persist_request(record)

        return record

    def ensure_request_exists(self, request_id: str) -> None:
        if self._marketplace is None or not hasattr(self._marketplace, "get_request"):
            raise ValueError("marketplace not configured")

        existing = self._marketplace.get_request(request_id)
        if not existing:
            raise ValueError("request not found")

