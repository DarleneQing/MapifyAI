"""
Unit tests for ranking + explanation (Backend-3).
Run with: pytest tests/test_ranking.py
"""

from app.models.schemas import UserPreferences
from app.services.ranking import normalise, rank_offers
from app.services.explanation import explain_offer, attach_explanations


def test_normalise_basic():
    assert normalise(5.0, 0.0, 10.0) == 0.5
    assert normalise(0.0, 0.0, 10.0, invert=True) == 1.0
    assert normalise(10.0, 0.0, 10.0, invert=True) == 0.0


def test_rank_prefers_cheaper():
    prefs = UserPreferences(weight_price=1.0, weight_distance=0.0, weight_rating=0.0)
    providers = [
        {"id": "a", "price": 80, "distance_km": 1.0, "rating": 4.5},
        {"id": "b", "price": 30, "distance_km": 1.0, "rating": 4.5},
    ]
    ranked = rank_offers(providers, prefs)
    assert ranked[0]["id"] == "b"


def test_rank_prefers_closer_when_distance_weight_high():
    prefs = UserPreferences(weight_price=0.0, weight_distance=1.0, weight_rating=0.0)
    providers = [
        {"id": "far", "price": 30, "distance_km": 5.0, "rating": 4.5},
        {"id": "near", "price": 30, "distance_km": 1.0, "rating": 4.5},
    ]
    ranked = rank_offers(providers, prefs)
    assert ranked[0]["id"] == "near"


def test_rank_attaches_score_fields():
    providers = [
        {"id": "x", "price": 40, "distance_km": 1.2, "rating": 4.2},
        {"id": "y", "price": 50, "distance_km": 0.8, "rating": 4.8},
    ]
    ranked = rank_offers(providers)
    assert "score" in ranked[0]
    assert "score_breakdown" in ranked[0]
    assert set(ranked[0]["score_breakdown"].keys()) == {
        "price_score",
        "distance_score",
        "rating_score",
    }


def test_rank_uses_price_range_midpoint_when_price_missing():
    providers = [
        {"id": "a", "price_range": "CHF 80-100", "distance_km": 1.0, "rating": 4.5},
        {"id": "b", "price_range": "CHF 20–40", "distance_km": 1.0, "rating": 4.5},
    ]
    prefs = UserPreferences(weight_price=1.0, weight_distance=0.0, weight_rating=0.0)
    ranked = rank_offers(providers, prefs)
    assert ranked[0]["id"] == "b"
    assert ranked[0]["price"] == 30.0


def test_explain_offer_returns_three_and_includes_weight_reason():
    offer = {"price": 35, "distance_km": 0.8, "rating": 4.9}
    breakdown = {"price_score": 0.9, "distance_score": 0.7, "rating_score": 0.8}
    prefs = UserPreferences(weight_price=1.0, weight_distance=0.0, weight_rating=0.0)

    reasons = explain_offer(offer, offer, breakdown, prefs)
    assert len(reasons) == 3
    assert reasons[0].startswith("Price:")
    assert any("Matches your priority: price" in r for r in reasons)


def test_attach_explanations_adds_reasons_field():
    ranked = [
        {
            "id": "x",
            "price": 40,
            "distance_km": 1.2,
            "rating": 4.2,
            "score": 0.75,
            "score_breakdown": {
                "price_score": 0.8,
                "distance_score": 0.5,
                "rating_score": 0.9,
            },
        }
    ]

    enriched = attach_explanations(ranked)
    assert "reasons" in enriched[0]
    assert 1 <= len(enriched[0]["reasons"]) <= 3


def test_explain_offer_returns_unavailable_when_fields_missing():
    offer = {}
    breakdown = {"price_score": 0.7, "distance_score": 0.6, "rating_score": 0.5}
    reasons = explain_offer(offer, offer, breakdown, None)
    assert len(reasons) == 3
    assert "Price details are currently unavailable" in reasons
    assert "Distance details are currently unavailable" in reasons
    assert "Rating details are currently unavailable" in reasons


def test_explain_offer_formats_numeric_time_label():
    offer = {"time_label": 9}
    breakdown = {"distance_score": 1.0, "price_score": 0.0, "rating_score": 0.0}
    reasons = explain_offer(offer, offer, breakdown, None)

    assert any("Estimated travel time around 9 min" in r for r in reasons)


def test_priority_reason_not_added_when_priority_dimension_is_not_strongest():
    offer = {"price": 80, "distance_km": 0.5, "rating": 4.8}
    breakdown = {"price_score": 0.1, "distance_score": 0.9, "rating_score": 0.9}
    prefs = UserPreferences(weight_price=0.5, weight_distance=0.3, weight_rating=0.2)

    reasons = explain_offer(offer, offer, breakdown, prefs)
    assert all("Matches your priority:" not in r for r in reasons)