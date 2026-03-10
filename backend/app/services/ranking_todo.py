"""
Ranking service — Backend-3 owns this file. (US-04, US-08)

Scores each feasible provider/offer and returns a sorted list.

Score formula (weighted sum, all inputs normalised to [0, 1]):
  score = w_price    * price_score
        + w_distance * distance_score
        + w_rating   * rating_score

Where:
  price_score    = 1 - (price - min_price) / (max_price - min_price)  (cheaper = higher)
  distance_score = 1 - (dist  - min_dist)  / (max_dist  - min_dist)   (closer  = higher)
  rating_score   = (rating - 1) / 4                                    (1–5 scale → 0–1)

TODO:
  1. Implement normalise() helper
  2. Implement score_offer() that returns score + breakdown dict
  3. Implement rank_offers() that sorts by score desc
  4. Accept UserPreferences weights so ranking is personalised (US-08)
"""
from app.models.schemas import Offer, UserPreferences


def normalise(value: float, min_val: float, max_val: float, invert: bool = False) -> float:
    """
    TODO (Backend-3): normalise value to [0,1].
    If invert=True, lower value → higher score (used for price and distance).
    """
    raise NotImplementedError


def score_offer(
    offer: dict,
    provider: dict,
    prefs: UserPreferences,
    min_price: float,
    max_price: float,
    min_dist: float,
    max_dist: float,
) -> tuple[float, dict]:
    """
    TODO (Backend-3):
      Compute (total_score, breakdown) where breakdown = {
        "price_score": ..., "distance_score": ..., "rating_score": ...
      }
    """
    raise NotImplementedError


def rank_offers(
    providers: list[dict],
    prefs: UserPreferences | None = None,
) -> list[dict]:
    """
    TODO (Backend-3):
      1. Build offer dicts from feasible providers (price from offer or provider price_range midpoint)
      2. Compute score for each using score_offer()
      3. Attach score + score_breakdown to each dict
      4. Return sorted list (highest score first)
    """
    raise NotImplementedError
