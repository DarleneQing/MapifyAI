"""
GET  /api/users/me              — current user profile + preferences
PUT  /api/users/me/preferences  — save preference weights (US-08)

Backend-2 owns this file.

TODO:
  1. Auth: use Supabase Auth (JWT from client header)
  2. Persist UserPreferences in `users` table
  3. Return preferences so frontend can populate the weight sliders
"""
from fastapi import APIRouter, HTTPException

from app.models.schemas import UserPreferences

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me")
async def get_me():
    """
    TODO (Backend-2): extract user from JWT, return profile + preferences.
    """
    raise HTTPException(status_code=501, detail="Not implemented")


@router.put("/me/preferences")
async def update_preferences(prefs: UserPreferences):
    """
    TODO (Backend-2): upsert preferences row in Supabase for current user.
    """
    raise HTTPException(status_code=501, detail="Not implemented")
