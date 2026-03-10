"""
Ranking service — Backend-3 owns this file. (US-04, US-08)

Scores each feasible provider/offer and returns a sorted list.

Terminology in this module:
- provider: a place/service entity from retrieval stage (distance, rating, price_range...).
- offer: the row we score and return; currently based on provider dict, and may carry a concrete price.
"""
import re

from app.models.schemas import UserPreferences


DEFAULT_PREFS = UserPreferences()
DEFAULT_PRICE = 50.0
DEFAULT_DISTANCE_KM = 50.0
DEFAULT_RATING = 3.0


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _parse_price_midpoint(price_range: str | None) -> float:
    """
    Parse midpoint from strings like "CHF 30-60" / "CHF 30–60".
    Falls back to DEFAULT_PRICE when parsing fails.
    """
    if not price_range:
        return DEFAULT_PRICE

    nums = re.findall(r"\d+(?:\.\d+)?", price_range)
    if len(nums) >= 2:
        return (float(nums[0]) + float(nums[1])) / 2.0
    if len(nums) == 1:
        return float(nums[0])
    return DEFAULT_PRICE


def _coerce_float(value: object, fallback: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def _safe_price(provider: dict) -> float:
    value = provider.get("price")
    if value is not None:
        return _coerce_float(value, DEFAULT_PRICE)
    return _parse_price_midpoint(provider.get("price_range"))


def _safe_distance(provider: dict) -> float:
    return _coerce_float(provider.get("distance_km", DEFAULT_DISTANCE_KM), DEFAULT_DISTANCE_KM)


def _safe_rating(provider: dict, offer: dict) -> float:
    raw = provider.get("rating", offer.get("rating", DEFAULT_RATING))
    return _coerce_float(raw, DEFAULT_RATING)


def _normalised_weights(prefs: UserPreferences) -> tuple[float, float, float]:
    """Extract and normalize weights. If total <= 0, fallback to equal weights."""
    wp = float(getattr(prefs, "weight_price", 0.0))
    wd = float(getattr(prefs, "weight_distance", 0.0))
    wr = float(getattr(prefs, "weight_rating", 0.0))
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
    price_raw = offer.get("price")
    price = _safe_price(provider) if price_raw is None else _coerce_float(price_raw, DEFAULT_PRICE)

    distance_raw = provider.get("distance_km", offer.get("distance_km", DEFAULT_DISTANCE_KM))
    distance_km = _coerce_float(distance_raw, DEFAULT_DISTANCE_KM)
    rating = _safe_rating(provider, offer)

    price_score = normalise(price, min_price, max_price, invert=True)
    distance_score = normalise(distance_km, min_dist, max_dist, invert=True)
    rating_score = normalise(rating, 1.0, 5.0, invert=False)

    w_price, w_dist, w_rating = _normalised_weights(prefs)
    total_score = (
        w_price * price_score
        + w_dist * distance_score
        + w_rating * rating_score
    )

    breakdown = {
        "price_score": round(price_score, 4),
        "distance_score": round(distance_score, 4),
        "rating_score": round(rating_score, 4),
    }
    return round(total_score, 4), breakdown


def rank_offers(providers: list[dict], prefs: UserPreferences | None = None) -> list[dict]:
    """
    Rank provider dicts by weighted score.
    Adds score, score_breakdown, and price (if missing) on each returned row.
    """
    if not providers:
        return []

    active_prefs = prefs or DEFAULT_PREFS

    prices = [_safe_price(p) for p in providers]
    dists = [_safe_distance(p) for p in providers]
    min_price, max_price = min(prices), max(prices)
    min_dist, max_dist = min(dists), max(dists)

    ranked: list[dict] = []
    for provider in providers:
        row = dict(provider)
        if row.get("price") is None:
            row["price"] = _safe_price(provider)

        score, breakdown = score_offer(
            offer=row,
            provider=provider,
            prefs=active_prefs,
            min_price=min_price,
            max_price=max_price,
            min_dist=min_dist,
            max_dist=max_dist,
        )
        row["score"] = score
        row["score_breakdown"] = breakdown
        ranked.append(row)

    ranked.sort(key=lambda item: item.get("score", 0.0), reverse=True)
    return ranked
