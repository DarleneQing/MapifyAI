"""
Explanation service — Backend-3 owns this file. (US-05, US-08)

Generates concise reasons for each ranked offer, derived from existing fields.
No fabricated facts are introduced.
"""
from typing import Optional

from app.models.schemas import UserPreferences


def _fmt_money(value: float) -> str:
    if float(value).is_integer():
        return str(int(value))
    return f"{value:.1f}"


def _format_time_label(value: object) -> str:
    """Format numeric/string time labels into a readable phrase."""
    if value is None:
        return ""

    if isinstance(value, (int, float)):
        minutes = int(round(float(value)))
        return f"Estimated travel time around {minutes} min"

    text = str(value).strip()
    if not text:
        return ""

    try:
        minutes = int(round(float(text)))
        return f"Estimated travel time around {minutes} min"
    except (TypeError, ValueError):
        return text


def _normalised_weights(prefs: UserPreferences | None) -> dict[str, float]:
    if prefs is None:
        return {"price": 1.0 / 3.0, "distance": 1.0 / 3.0, "rating": 1.0 / 3.0}

    wp = max(0.0, float(getattr(prefs, "weight_price", 0.0)))
    wd = max(0.0, float(getattr(prefs, "weight_travel", 0.0)))
    wr = max(0.0, float(getattr(prefs, "weight_rating", 0.0)))
    total = wp + wd + wr
    if total <= 0:
        return {"price": 1.0 / 3.0, "distance": 1.0 / 3.0, "rating": 1.0 / 3.0}
    return {"price": wp / total, "distance": wd / total, "rating": wr / total}


def reason_for_price(offer: dict, provider: dict) -> Optional[str]:
    """Return a factual price reason or None when no price signal exists."""
    price = offer.get("price", provider.get("price"))
    if price is not None:
        try:
            return f"Price: CHF {_fmt_money(float(price))}"
        except (TypeError, ValueError):
            pass

    price_range = provider.get("price_range", offer.get("price_range"))
    if price_range:
        return f"Price range: {price_range}"
    return None


def reason_for_distance(offer: dict, provider: dict) -> Optional[str]:
    """Return a factual distance/time reason or None when missing."""
    distance = provider.get("distance_km", offer.get("distance_km"))
    if distance is not None:
        try:
            dist = float(distance)
            eta = offer.get("eta_minutes", provider.get("eta_minutes"))
            if eta is not None:
                try:
                    return f"Distance: {dist:.1f} km (~{int(float(eta))} min)"
                except (TypeError, ValueError):
                    pass
            return f"Distance: {dist:.1f} km"
        except (TypeError, ValueError):
            pass

    time_label = provider.get("time_label", offer.get("time_label"))
    if time_label is not None:
        label = _format_time_label(time_label)
        return label or None
    return None


def reason_for_rating(offer: dict, provider: dict) -> Optional[str]:
    """Return a factual rating reason or None when missing."""
    rating = provider.get("rating", offer.get("rating"))
    if rating is not None:
        try:
            return f"Rating: {float(rating):.1f}/5"
        except (TypeError, ValueError):
            pass
    return None


def _priority_dimension(prefs: UserPreferences | None) -> Optional[str]:
    if prefs is None:
        return None
    weights = _normalised_weights(prefs)
    order = ("price", "distance", "rating")
    return max(order, key=lambda dim: (weights[dim], -order.index(dim)))


def _dimension_contributions(score_breakdown: dict, prefs: UserPreferences | None) -> dict[str, float]:
    """
    Compute per-dimension contribution used for explanation ranking.
    - With prefs: contribution = normalised_weight * dimension_score
    - Without prefs: contribution = dimension_score
    """
    weights = _normalised_weights(prefs)
    price = float(score_breakdown.get("price_score", 0.0))
    distance = float(score_breakdown.get("travel_score", 0.0))
    rating = float(score_breakdown.get("rating_score", 0.0))

    if prefs is None:
        return {"price": price, "distance": distance, "rating": rating}

    return {
        "price": price * weights["price"],
        "distance": distance * weights["distance"],
        "rating": rating * weights["rating"],
    }


def _priority_reason(
    prefs: UserPreferences | None,
    contributions: dict[str, float],
    available_dims: set[str],
) -> Optional[str]:
    """Add preference reason only when user priority is also this offer's strongest strong dimension."""
    priority_dim = _priority_dimension(prefs)
    if not priority_dim or priority_dim not in available_dims:
        return None

    strongest_dim = max(
        (d for d in ("price", "distance", "rating") if d in available_dims),
        key=lambda d: contributions[d],
    )
    strongest_value = contributions[strongest_dim]
    if strongest_dim != priority_dim:
        return None
    if strongest_value < 0.2:
        return None
    return f"Matches your priority: {priority_dim}"


def _unavailable_reason(dim: str) -> str:
    labels = {
        "price": "Price details are currently unavailable",
        "distance": "Distance details are currently unavailable",
        "rating": "Rating details are currently unavailable",
    }
    return labels[dim]


def explain_offer(
    offer: dict,
    provider: dict,
    score_breakdown: dict,
    prefs: UserPreferences | None = None,
) -> list[str]:
    """
    Build deterministic reasons for one offer.

    Ordering is based on contribution:
    - with prefs: weight * score
    - without prefs: score

    Missing dimensions may be represented as explicit "unavailable" reasons
    to keep output user-friendly.
    """
    reason_by_dim: dict[str, Optional[str]] = {
        "price": reason_for_price(offer, provider),
        "distance": reason_for_distance(offer, provider),
        "rating": reason_for_rating(offer, provider),
    }
    contributions = _dimension_contributions(score_breakdown, prefs)
    dim_order = ("price", "distance", "rating")

    available_dims = {dim for dim, reason in reason_by_dim.items() if reason is not None}
    ranked_available = sorted(
        available_dims,
        key=lambda dim: (-contributions[dim], dim_order.index(dim)),
    )
    reasons: list[str] = [reason_by_dim[dim] for dim in ranked_available if reason_by_dim[dim] is not None]

    priority_reason = _priority_reason(prefs, contributions, available_dims)
    if priority_reason and priority_reason not in reasons:
        if len(reasons) >= 3:
            reasons = reasons[:2] + [priority_reason]
        else:
            reasons.append(priority_reason)

    # Fill to 3 with factual unavailable lines (deterministic order by contribution).
    if len(reasons) < 3:
        missing_dims = [dim for dim in dim_order if reason_by_dim[dim] is None]
        missing_dims = sorted(missing_dims, key=lambda dim: (-contributions[dim], dim_order.index(dim)))
        for dim in missing_dims:
            if len(reasons) >= 3:
                break
            reasons.append(_unavailable_reason(dim))

    return reasons[:3]


def attach_explanations(ranked_offers: list[dict], prefs: UserPreferences | None = None) -> list[dict]:
    """Attach explanation reasons to each ranked offer and return a new list."""
    enriched: list[dict] = []
    for offer in ranked_offers:
        row = dict(offer)
        breakdown = row.get("score_breakdown") or {}
        row["reasons"] = explain_offer(
            offer=row,
            provider=row,
            score_breakdown=breakdown,
            prefs=prefs,
        )
        enriched.append(row)
    return enriched
