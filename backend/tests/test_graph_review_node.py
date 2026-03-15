"""Focused unit tests for graph._review_node review-mode integration.

These tests lock down only the thin graph integration layer.
The review router is always mocked, so no external APIs or full pipeline
execution are involved.
"""

from __future__ import annotations

import sys
import types
from unittest.mock import patch


class _FakeCompiledGraph:
    def invoke(self, initial_state):
        return initial_state

    def stream(self, initial_state):
        yield {"noop": initial_state}


class _FakeStateGraph:
    def __init__(self, _state_type):
        self._state_type = _state_type

    def add_node(self, *_args, **_kwargs):
        return None

    def set_entry_point(self, *_args, **_kwargs):
        return None

    def add_edge(self, *_args, **_kwargs):
        return None

    def add_conditional_edges(self, *_args, **_kwargs):
        return None

    def compile(self):
        return _FakeCompiledGraph()


fake_langgraph = types.ModuleType("langgraph")
fake_langgraph_graph = types.ModuleType("langgraph.graph")
fake_langgraph_graph.StateGraph = _FakeStateGraph
fake_langgraph_graph.END = "END"
fake_langgraph.graph = fake_langgraph_graph

sys.modules.setdefault("langgraph", fake_langgraph)
sys.modules.setdefault("langgraph.graph", fake_langgraph_graph)

from app.agents.graph import _review_node


def _state(review_mode: str | None = None) -> dict:
    state = {
        "candidate_providers": [
            {"id": "provider-1", "name": "Provider 1"},
        ],
    }
    if review_mode is not None:
        state["review_mode"] = review_mode
    return state


def test_review_node_defaults_to_simple_mode_when_review_mode_missing():
    state = _state()
    expected = [{"place_id": "provider-1", "advantages": [], "disadvantages": []}]

    with patch("app.agents.graph.REVIEW_MODE", ""), patch(
        "app.services.review_router.route_review_summaries",
        return_value=expected,
    ) as mock_router:
        result = _review_node(state)

    mock_router.assert_called_once_with(state["candidate_providers"], review_mode="simple")
    assert result == {"review_summaries": expected}


def test_review_node_state_override_beats_config_default():
    state = _state(review_mode="advanced")
    expected = [{"place_id": "provider-1", "advantages": ["Clean"], "disadvantages": []}]

    with patch("app.agents.graph.REVIEW_MODE", "simple"), patch(
        "app.services.review_router.route_review_summaries",
        return_value=expected,
    ) as mock_router:
        result = _review_node(state)

    mock_router.assert_called_once_with(state["candidate_providers"], review_mode="advanced")
    assert result == {"review_summaries": expected}


def test_review_node_uses_config_default_when_state_mode_missing():
    state = _state()
    expected = [{"place_id": "provider-1", "advantages": ["Fast"], "disadvantages": []}]

    with patch("app.agents.graph.REVIEW_MODE", "advanced"), patch(
        "app.services.review_router.route_review_summaries",
        return_value=expected,
    ) as mock_router:
        result = _review_node(state)

    mock_router.assert_called_once_with(state["candidate_providers"], review_mode="advanced")
    assert result == {"review_summaries": expected}


def test_review_node_always_returns_review_summaries_wrapper_dict():
    state = _state(review_mode="fallback")
    expected = [
        {
            "place_id": "provider-1",
            "advantages": ["Near station"],
            "disadvantages": ["Busy at peak times"],
        }
    ]

    with patch(
        "app.services.review_router.route_review_summaries",
        return_value=expected,
    ):
        result = _review_node(state)

    assert result == {"review_summaries": expected}
    assert set(result.keys()) == {"review_summaries"}