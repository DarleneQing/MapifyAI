import os
from dotenv import load_dotenv

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
APIFY_API_TOKEN = os.getenv("APIFY_API_TOKEN", "")
FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY", "")

DEFAULT_RADIUS_KM = 5.0
DEFAULT_MODEL = "gpt-4o-mini"
