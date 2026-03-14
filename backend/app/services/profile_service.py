"""
Profile service for managing user preferences.

Stores preferences in memory for MVP; can be extended to use Supabase.
"""
from typing import Any

from app.models.schemas import UserPreferences


class InMemoryProfileService:
    """
    In-memory store for user preferences (MVP).
    In production, this would persist to Supabase.
    """

    def __init__(self):
        self._preferences: dict[str, UserPreferences] = {}

    def get_or_create_user_preferences(self, user_id: str) -> dict[str, Any]:
        """Get user preferences or create defaults."""
        if user_id not in self._preferences:
            self._preferences[user_id] = UserPreferences()
        prefs = self._preferences[user_id]
        return {
            "weight_price": prefs.weight_price,
            "weight_distance": prefs.weight_distance,
            "weight_rating": prefs.weight_rating,
        }

    def update_user_preferences(
        self, user_id: str, prefs: UserPreferences
    ) -> dict[str, Any]:
        """Update user preferences."""
        self._preferences[user_id] = prefs
        return {
            "weight_price": prefs.weight_price,
            "weight_distance": prefs.weight_distance,
            "weight_rating": prefs.weight_rating,
        }
