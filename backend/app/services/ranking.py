"""
Ranking service — Backend-3 owns this file. (US-04, US-08)

Scores each feasible provider/offer and returns a sorted list.

Terminology in this module:
- provider: a place/service entity from retrieval stage (commute_time, distance, rating, price_range...).
- offer: optional future extension that may carry an effective price override.
"""
import re

from app.models.schemas import UserPreferences
from app.ranking_config import (
    PRICE_MISSING_SCORE,
    TRAVEL_MODE,
    DEFAULT_TRAVEL_FALLBACK,
    RATING_MIN,
    RATING_MAX,
)


DEFAULT_PREFS = UserPreferences()
DEFAULT_RATING = 3.0


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _coerce_float(value: object, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _price_signal(provider: dict) -> float | None:
    """Return parsed price float, or None when no price signal exists. No fabricated fallback."""
    value = provider.get("price")
    if value is not None:
        try:
            return float(value)
        except (TypeError, ValueError):
            pass

    raw = provider.get("price_range")
    if raw:
        nums = re.findall(r"\d+(?:\.\d+)?", str(raw))
        if len(nums) >= 2:
            return (float(nums[0]) + float(nums[1])) / 2.0
        if len(nums) == 1:
            return float(nums[0])
    return None


def _effective_price(provider: dict, offer: dict | None = None) -> float | None:
    """Hook: offer price overrides provider base price when present (future extension point)."""
    if offer:
        v = offer.get("price")
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                pass
    return _price_signal(provider)


def _safe_travel(provider: dict) -> float:
    """Return primary travel signal. Prefers commute_time_minutes, falls back to distance_km."""
    if TRAVEL_MODE == "commute_time":
        ct = provider.get("commute_time_minutes")
        if ct is not None:
            return _coerce_float(ct, DEFAULT_TRAVEL_FALLBACK)
    return _coerce_float(provider.get("distance_km", DEFAULT_TRAVEL_FALLBACK), DEFAULT_TRAVEL_FALLBACK)


def _safe_rating(provider: dict, offer: dict) -> float:
    raw = provider.get("rating", offer.get("rating", DEFAULT_RATING))
    return _coerce_float(raw, DEFAULT_RATING)


def _normalised_weights(prefs: UserPreferences) -> tuple[float, float, float]:
    """Extract and normalize weights. If total <= 0, fallback to equal weights."""
    # Keep ranking aligned with explanation semantics under invalid negative inputs.
    wp = max(0.0, float(getattr(prefs, "weight_price", 0.0)))
    wd = max(0.0, float(getattr(prefs, "weight_travel", 0.0)))
    wr = max(0.0, float(getattr(prefs, "weight_rating", 0.0)))
    total = wp + wd + wr
    if total <= 0:
        return (1.0 / 3.0, 1.0 / 3.0, 1.0 / 3.0)
    return (wp / total, wd / total, wr / total)


def normalise(value: float, min_val: float, max_val: float, invert: bool = False) -> float:
    """
    Normalise value to [0,1].
    - When max_val == min_val, return 1.0 to avoid divide-by-zero.
    - If invert=True, lower raw values receive higher score.
    - Final output is clamped to [0,1].
    """
    if max_val == min_val:
        return 1.0

    norm = (float(value) - float(min_val)) / (float(max_val) - float(min_val))
    norm = _clamp01(norm)
    if invert:
        norm = 1.0 - norm
    return _clamp01(norm)


def score_offer(
    offer: dict,
    provider: dict,
    prefs: UserPreferences,
    min_price: float,
    max_price: float,
    min_dist: float,
    max_dist: float,
) -> tuple[float, dict]:
    """Compute total score and per-dimension score breakdown."""
    price = _effective_price(provider, offer)
    travel_val = _safe_travel(provider)
    rating = _safe_rating(provider, offer)

    price_score = PRICE_MISSING_SCORE if price is None else normalise(price, min_price, max_price, invert=True)
    travel_score = normalise(travel_val, min_dist, max_dist, invert=True)
    rating_score = normalise(rating, RATING_MIN, RATING_MAX, invert=False)

    w_price, w_dist, w_rating = _normalised_weights(prefs)
    total_score = (
        w_price * price_score
        + w_dist * travel_score
        + w_rating * rating_score
    )

    breakdown = {
        "price_score": round(price_score, 4),
        "travel_score": round(travel_score, 4),
        "rating_score": round(rating_score, 4),
    }
    return round(total_score, 4), breakdown


def rank_offers(providers: list[dict], prefs: UserPreferences | None = None) -> list[dict]:
    """
    Rank provider dicts by weighted score.
    Adds score, score_breakdown, and price on each returned row.
    price may be None when no price signal exists; no fabricated fallback is applied.
    """
    if not providers:
        return []

    active_prefs = prefs or DEFAULT_PREFS

    price_signals = [_price_signal(p) for p in providers]
    known_prices = [v for v in price_signals if v is not None]
    min_price = min(known_prices) if known_prices else 0.0
    max_price = max(known_prices) if known_prices else 0.0

    travels = [_safe_travel(p) for p in providers]
    min_travel, max_travel = min(travels), max(travels)

    ranked: list[dict] = []
    for provider in providers:
        row = dict(provider)
        row["price"] = _price_signal(provider)  # may be None; no fabricated value

        score, breakdown = score_offer(
            offer={},
            provider=provider,
            prefs=active_prefs,
            min_price=min_price,
            max_price=max_price,
            min_dist=min_travel,
            max_dist=max_travel,
        )
        row["score"] = score
        row["score_breakdown"] = breakdown
        ranked.append(row)

    ranked.sort(key=lambda item: item.get("score", 0.0), reverse=True)
    return ranked
