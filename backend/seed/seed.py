"""
Seed script — loads zurich_providers.json into Supabase.
Backend-2/3 runs this once to populate the providers table.

Usage:
  cd backend
  python -m seed.seed
"""
import json
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")  # use service role for seeding

DATA_FILE = Path(__file__).parent / "zurich_providers.json"


def main():
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env")

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    providers = json.loads(DATA_FILE.read_text())

    result = db.table("providers").upsert(providers).execute()
    print(f"Seeded {len(result.data)} providers.")


if __name__ == "__main__":
    main()
