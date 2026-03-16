"""
Profile service for managing user preferences.

InMemoryProfileService: MVP in-memory store.
SupabaseProfileService: persists to the `user_preferences` table.
"""
from app.models.schemas import UserPreferences


class InMemoryProfileService:
    """In-memory store for user preferences (MVP fallback)."""

    def __init__(self):
        self._preferences: dict[str, UserPreferences] = {}

    def get_or_create_user_preferences(self, user_id: str) -> UserPreferences:
        if user_id not in self._preferences:
            self._preferences[user_id] = UserPreferences()
        return self._preferences[user_id]

    def update_user_preferences(
        self, user_id: str, prefs: UserPreferences
    ) -> UserPreferences:
        self._preferences[user_id] = prefs
        return prefs


class SupabaseProfileService:
    """Persists user preferences to the Supabase `user_preferences` table."""

    def __init__(self):
        from app.models.db import get_db
        self._db = get_db()

    def get_or_create_user_preferences(self, user_id: str) -> UserPreferences:
        result = (
            self._db.table("user_preferences")
            .select("weight_price, weight_distance, weight_rating")
            .eq("user_id", user_id)
            .execute()
        )
        if result.data:
            row = result.data[0]
            return UserPreferences(
                weight_price=row["weight_price"],
                weight_distance=row["weight_distance"],
                weight_rating=row["weight_rating"],
            )
        defaults = UserPreferences()
        self._db.table("user_preferences").insert(
            {
                "user_id": user_id,
                "weight_price": defaults.weight_price,
                "weight_distance": defaults.weight_distance,
                "weight_rating": defaults.weight_rating,
            }
        ).execute()
        return defaults

    def update_user_preferences(
        self, user_id: str, prefs: UserPreferences
    ) -> UserPreferences:
        self._db.table("user_preferences").upsert(
            {
                "user_id": user_id,
                "weight_price": prefs.weight_price,
                "weight_distance": prefs.weight_distance,
                "weight_rating": prefs.weight_rating,
            }
        ).execute()
        return prefs
