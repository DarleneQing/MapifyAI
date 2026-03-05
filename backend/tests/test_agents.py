"""
Basic smoke tests for the agent pipeline (Backend-1).
Run with: pytest tests/test_agents.py
"""
import pytest
from unittest.mock import patch
from app.agents.graph import run_pipeline
from app.services.geo import haversine_km, eta_minutes


def test_haversine_same_point():
    assert haversine_km(47.376, 8.541, 47.376, 8.541) == 0.0


def test_haversine_known_distance():
    # Zurich HB to Zurich Oerlikon ≈ 3.8 km
    dist = haversine_km(47.3779, 8.5403, 47.4113, 8.5489)
    assert 3.0 < dist < 4.5


def test_eta_minutes():
    assert eta_minutes(distance_km=5.0, speed_kmh=20.0) == 15
    assert eta_minutes(distance_km=0.0) == 1  # minimum 1 min


# TODO (Backend-1): add integration test for run_pipeline() once agents are implemented
# def test_pipeline_smoke():
#     state = run_pipeline("I need a haircut near Zürich HB in 2 hours", {"lat": 47.378, "lng": 8.540})
#     assert state["structured_request"]["category"] == "haircut"
#     assert isinstance(state["ranked_offers"], list)
