"""
GET  /api/users/me              — current user profile + preferences
PUT  /api/users/me/preferences  — save preference weights (US-08)

Controller layer: delegates to auth_service and profile_service as defined in
`doc/controller-service-contract.md`.
"""
from typing import Any

from fastapi import APIRouter, HTTPException

from app.models.schemas import UserPreferences

router = APIRouter(prefix="/api/users", tags=["users"])

# Service dependencies (injected/mocked in tests or wired in at startup)
auth_service: Any | None = None
profile_service: Any | None = None


@router.get("/me")
async def get_me():
    """
    Return current user profile plus preferences.
    """
    if auth_service is None:
        raise HTTPException(
            status_code=500, detail="auth_service not configured"
        )
    if profile_service is None:
        raise HTTPException(
            status_code=500, detail="profile_service not configured"
        )

    user_id = auth_service.get_current_user_id()
    if not user_id:
        raise HTTPException(status_code=401, detail="User authentication required")

    preferences = profile_service.get_or_create_user_preferences(user_id)
    return {"id": user_id, "preferences": preferences}


@router.put("/me/preferences")
async def update_preferences(prefs: UserPreferences):
    """
    Update current user's preference weights.
    """
    if auth_service is None:
        raise HTTPException(
            status_code=500, detail="auth_service not configured"
        )
    if profile_service is None:
        raise HTTPException(
            status_code=500, detail="profile_service not configured"
        )

    user_id = auth_service.get_current_user_id()
    if not user_id:
        raise HTTPException(status_code=401, detail="User authentication required")

    updated = profile_service.update_user_preferences(user_id, prefs)
    return updated
