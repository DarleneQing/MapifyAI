"""
Review Summarizer service — generates pros/cons for providers using OpenAI.

When real Google reviews are available (scraped via Apify), uses them directly.
Otherwise falls back to LLM-generated summaries from structured provider data.
"""
import json

from app.config import OPENAI_API_KEY, DEFAULT_MODEL


def summarise_providers(providers: list[dict]) -> list[dict]:
    """
    Call OpenAI once with all providers and return a list of summaries:
      [{"place_id": ..., "advantages": [...], "disadvantages": [...]}, ...]

    Uses real scraped reviews if present in provider["reviews"],
    otherwise generates plausible summaries from rating/price/name.
    """
    if not providers or not OPENAI_API_KEY:
        return _empty_summaries(providers)

    from openai import OpenAI
    client = OpenAI(api_key=OPENAI_API_KEY)

    places = []
    for p in providers:
        entry = {
            "place_id": p.get("id", ""),
            "name": p.get("name", ""),
            "rating": p.get("rating"),
            "review_count": p.get("review_count", 0),
            "price_range": p.get("price_range", ""),
            "distance_km": p.get("distance_km"),
            "category": p.get("category", ""),
        }
        # Include real review texts when available (from Apify scraper)
        raw_reviews = p.get("reviews") or []
        if raw_reviews:
            entry["review_texts"] = [
                r.get("text", "") for r in raw_reviews[:10] if r.get("text")
            ]
        places.append(entry)

    has_real_reviews = any("review_texts" in p for p in places)
    if has_real_reviews:
        instruction = (
            "Summarise the actual customer reviews into advantages and disadvantages."
        )
    else:
        instruction = (
            "Based on the rating, price, and typical characteristics of such "
            "establishments, write plausible advantages and disadvantages."
        )

    prompt = f"""You are a review analyst for local services in Zurich.

{instruction}

Places:
{json.dumps(places, indent=2, ensure_ascii=False)}

Return a JSON object:
{{
  "summaries": [
    {{
      "place_id": "<id>",
      "advantages": ["<advantage 1>", "<advantage 2>"],
      "disadvantages": ["<disadvantage 1>"]
    }}
  ]
}}"""

    try:
        response = client.chat.completions.create(
            model=DEFAULT_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
        )
        result = json.loads(response.choices[0].message.content)
        return result.get("summaries", _empty_summaries(providers))
    except Exception:
        return _empty_summaries(providers)


def _empty_summaries(providers: list[dict]) -> list[dict]:
    return [
        {"place_id": p.get("id", ""), "advantages": [], "disadvantages": []}
        for p in providers
    ]
