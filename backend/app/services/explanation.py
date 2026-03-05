"""
Explanation service — Backend-3 owns this file. (US-05, US-08)

Generates top-3 human-readable reasons for each ranked offer,
strictly derived from score_breakdown (no hallucination).

Example output:
  ["Closest option at 0.8 km", "Highest rating (4.9)", "Cheapest at CHF 35"]

TODO:
  1. Implement reason_for_price()    — e.g. "Cheapest option at CHF 35"
  2. Implement reason_for_distance() — e.g. "Only 0.8 km away (~4 min)"
  3. Implement reason_for_rating()   — e.g. "Top-rated with 4.9 ★"
  4. Implement reason_for_weight()   — e.g. "Matches your priority: price"  (US-08)
  5. Implement explain_offer()       — pick top-3 reasons by score contribution
"""
from app.models.schemas import UserPreferences


def explain_offer(
    offer: dict,
    provider: dict,
    score_breakdown: dict,
    prefs: UserPreferences | None = None,
) -> list[str]:
    """
    TODO (Backend-3):
      - Look at score_breakdown to find the top contributing dimensions
      - Generate a plain-English sentence for each
      - If prefs are provided, add a line like "Matches your priority: price"
      - Return exactly 3 reasons (pad with generic ones if needed)

    Must NOT invent facts — every reason must reference a real field value.
    """
    raise NotImplementedError


def attach_explanations(ranked_offers: list[dict], prefs: UserPreferences | None = None) -> list[dict]:
    """
    TODO (Backend-3):
      Iterate ranked_offers, call explain_offer() for each,
      attach result as offer["reasons"] = [...].
      Return the updated list.
    """
    raise NotImplementedError
