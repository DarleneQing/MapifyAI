from supabase import create_client, Client
from app.config import SUPABASE_URL, SUPABASE_KEY, SUPABASE_SERVICE_ROLE_KEY

_client: Client | None = None


def get_db() -> Client:
    global _client
    if _client is None:
        if not SUPABASE_URL:
            raise RuntimeError("SUPABASE_URL must be set in .env")
        key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY
        if not key:
            raise RuntimeError("Set SUPABASE_KEY or SUPABASE_SERVICE_ROLE_KEY in .env")
        _client = create_client(SUPABASE_URL, key)
    return _client
