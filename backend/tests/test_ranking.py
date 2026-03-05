"""
Unit tests for ranking + explanation (Backend-3).
Run with: pytest tests/test_ranking.py
"""
import pytest
from app.models.schemas import UserPreferences

# TODO (Backend-3): uncomment and implement once ranking.py is done
# from app.services.ranking import rank_offers, normalise
# from app.services.explanation import explain_offer


# def test_normalise_basic():
#     assert normalise(5.0, 0.0, 10.0) == 0.5
#     assert normalise(0.0, 0.0, 10.0, invert=True) == 1.0
#     assert normalise(10.0, 0.0, 10.0, invert=True) == 0.0


# def test_rank_prefers_cheaper():
#     prefs = UserPreferences(weight_price=1.0, weight_distance=0.0, weight_rating=0.0)
#     providers = [
#         {"id": "a", "price": 80, "distance_km": 1.0, "rating": 4.5},
#         {"id": "b", "price": 30, "distance_km": 1.0, "rating": 4.5},
#     ]
#     ranked = rank_offers(providers, prefs)
#     assert ranked[0]["id"] == "b"


# def test_explain_returns_three_reasons():
#     reasons = explain_offer(
#         offer={"price": 30, "eta_minutes": 5},
#         provider={"name": "Test", "rating": 4.9, "distance_km": 0.5},
#         score_breakdown={"price_score": 0.9, "distance_score": 0.8, "rating_score": 0.95},
#     )
#     assert len(reasons) == 3
