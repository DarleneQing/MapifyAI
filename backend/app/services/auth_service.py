"""
Simple anonymous auth service for MVP.

Provides device-based user identification without actual authentication.
"""


class AnonymousAuthService:
    """
    Returns a fixed anonymous user ID for MVP.
    In production, this would integrate with Supabase Auth or similar.
    """

    def __init__(self, default_user_id: str = "anonymous"):
        self._default_user_id = default_user_id

    def get_current_user_id(self) -> str:
        """Return anonymous user ID for MVP."""
        return self._default_user_id
