"""Minimal smoke test for real graph import/runtime wiring.

Purpose:
- Catch import-time or graph-construction regressions when real langgraph is
  available.
- Stay lightweight: no pipeline execution, no external API calls.
"""

from __future__ import annotations

import importlib

import pytest


def test_graph_module_import_and_initial_state_shape_with_real_langgraph():
    pytest.importorskip("langgraph")

    graph_module = importlib.import_module("app.agents.graph")

    assert hasattr(graph_module, "pipeline")
    assert graph_module.pipeline is not None

    state = graph_module._build_initial_state(
        raw_input="smoke",
        location={"lat": 47.3769, "lng": 8.5417},
        preferences=None,
        review_mode="advanced",
    )

    assert isinstance(state, dict)
    assert state["review_mode"] == "advanced"
    assert "review_summaries" in state
    assert isinstance(state["review_summaries"], list)