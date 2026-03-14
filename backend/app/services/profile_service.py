"""
Profile service for managing user preferences.

Stores preferences in memory for MVP; can be extended to use Supabase.
"""
from app.models.schemas import UserPreferences


class InMemoryProfileService:
    """
    In-memory store for user preferences (MVP).
    In production, this would persist to Supabase.
    """

    def __init__(self):
        self._preferences: dict[str, UserPreferences] = {}

    def get_or_create_user_preferences(self, user_id: str) -> UserPreferences:
        """Get user preferences or create defaults."""
        if user_id not in self._preferences:
            self._preferences[user_id] = UserPreferences()
        return self._preferences[user_id]

    def update_user_preferences(
        self, user_id: str, prefs: UserPreferences
    ) -> UserPreferences:
        """Update user preferences."""
        self._preferences[user_id] = prefs
        return prefs
