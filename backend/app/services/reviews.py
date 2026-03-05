"""
Review Summarizer service — Backend-3 owns this file. (US-10, Stretch)

Uses OpenAI to summarise mock reviews into pros / cons / price range / recommended services.

Expected output per provider:
  {
    "pros":  ["Fast service", "Friendly staff"],
    "cons":  ["Hard to find parking", "A bit pricey"],
    "price_range": "CHF 40–70",
    "recommended_services": ["Classic haircut", "Beard trim"]
  }

TODO:
  1. Build a prompt that includes the raw review texts
  2. Call OpenAI API and parse structured JSON response
  3. Cache result in Supabase `provider_summaries` table so it's not re-generated every time
  4. If no real reviews, fall back to mock data from seed/zurich_providers.json
"""
# from openai import OpenAI
# from app.config import OPENAI_API_KEY, DEFAULT_MODEL
# from app.models.db import get_db


def summarise_reviews(provider_id: str, reviews: list[dict]) -> dict:
    """
    TODO (Backend-3):
      prompt = build_prompt(reviews)
      client = OpenAI(api_key=OPENAI_API_KEY)
      response = client.chat.completions.create(model=DEFAULT_MODEL, ...)
      return json.loads(response.choices[0].message.content)
    """
    # Mock fallback for demo
    return {
        "pros": ["TODO: implement review summariser"],
        "cons": [],
        "price_range": "CHF ??–??",
        "recommended_services": [],
    }


def get_or_generate_summary(provider_id: str, reviews: list[dict]) -> dict:
    """
    TODO (Backend-3):
      1. Check Supabase `provider_summaries` for cached result
      2. If not cached, call summarise_reviews() and store result
      3. Return summary dict
    """
    return summarise_reviews(provider_id, reviews)
