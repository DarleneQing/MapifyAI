"""Focused unit tests for graph._orchestrator_node provider/model override behavior."""

from __future__ import annotations

import json
import sys
import types
from unittest.mock import MagicMock, patch


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

from app.agents.graph import _orchestrator_node


def _state() -> dict:
    return {
        "ranked_offers": [
            {
                "id": "p-1",
                "name": "Provider One",
                "address": "Address 1",
                "rating": 4.7,
                "price_range": "CHF 30-60",
                "distance_km": 1.2,
                "score": 0.89,
            }
        ],
        "review_summaries": [
            {
                "place_id": "p-1",
                "advantages": ["Friendly staff"],
                "disadvantages": ["Busy at peak times"],
            }
        ],
        "structured_request": {
            "raw_input": "Need a nearby haircut",
            "category": "personal_care",
            "constraints": {},
        },
        "trace": {"request_id": "test", "steps": []},
    }


def _mock_client_response(content: str) -> MagicMock:
    message = MagicMock()
    message.content = content

    choice = MagicMock()
    choice.message = message

    response = MagicMock()
    response.choices = [choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = response
    return mock_client


def test_orchestrator_keeps_old_behavior_when_override_unset():
    state = _state()
    payload = {
        "recommendations": [
            {
                "name": "Provider One",
                "one_sentence_recommendation": "Strong rating and close distance for your request.",
            }
        ]
    }
    mock_client = _mock_client_response(json.dumps(payload))

    with patch("openai.OpenAI", return_value=mock_client) as mock_openai, patch(
        "app.agents.graph.OPENAI_API_KEY", "openai-default-key"
    ), patch("app.agents.graph.DEFAULT_MODEL", "gpt-default"), patch(
        "app.agents.graph.ORCHESTRATOR_API_KEY", ""
    ), patch(
        "app.agents.graph.ORCHESTRATOR_MODEL", ""
    ), patch(
        "app.agents.graph.ORCHESTRATOR_BASE_URL", ""
    ):
        result = _orchestrator_node(state)

    mock_openai.assert_called_once_with(api_key="openai-default-key")
    mock_client.chat.completions.create.assert_called_once()
    assert mock_client.chat.completions.create.call_args.kwargs["model"] == "gpt-default"
    assert result["ranked_offers"][0]["one_sentence_recommendation"]


def test_orchestrator_uses_orchestrator_key_and_model_when_set():
    state = _state()
    payload = {
        "recommendations": [
            {
                "name": "Provider One",
                "one_sentence_recommendation": "Reasoning model selected this as best fit.",
            }
        ]
    }
    mock_client = _mock_client_response(json.dumps(payload))

    with patch("openai.OpenAI", return_value=mock_client) as mock_openai, patch(
        "app.agents.graph.OPENAI_API_KEY", "openai-default-key"
    ), patch("app.agents.graph.DEFAULT_MODEL", "gpt-default"), patch(
        "app.agents.graph.ORCHESTRATOR_API_KEY", "orchestrator-key"
    ), patch("app.agents.graph.ORCHESTRATOR_MODEL", "featherless-reasoner"), patch(
        "app.agents.graph.ORCHESTRATOR_BASE_URL", ""
    ):
        _orchestrator_node(state)

    mock_openai.assert_called_once_with(api_key="orchestrator-key")
    assert (
        mock_client.chat.completions.create.call_args.kwargs["model"]
        == "featherless-reasoner"
    )


def test_orchestrator_uses_base_url_when_configured():
    state = _state()
    payload = {
        "recommendations": [
            {
                "name": "Provider One",
                "one_sentence_recommendation": "Configured endpoint returned valid JSON.",
            }
        ]
    }
    mock_client = _mock_client_response(json.dumps(payload))

    with patch("openai.OpenAI", return_value=mock_client) as mock_openai, patch(
        "app.agents.graph.OPENAI_API_KEY", "openai-default-key"
    ), patch("app.agents.graph.DEFAULT_MODEL", "gpt-default"), patch(
        "app.agents.graph.ORCHESTRATOR_API_KEY", "orchestrator-key"
    ), patch("app.agents.graph.ORCHESTRATOR_MODEL", "featherless-reasoner"), patch(
        "app.agents.graph.ORCHESTRATOR_BASE_URL", "https://api.featherless.ai/v1"
    ):
        _orchestrator_node(state)

    mock_openai.assert_called_once_with(
        api_key="orchestrator-key",
        base_url="https://api.featherless.ai/v1",
    )
