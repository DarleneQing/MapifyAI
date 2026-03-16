"""
Orchestrator service — runs the recommendation pipeline for a request.

The controller calls run_recommendation_pipeline(request_id) and expects a
RankedOffersResponse-like JSON dict.
"""
from __future__ import annotations

from typing import Any, Callable

from app.agents.graph import run_pipeline
from app.models.schemas import AgentTrace


class OrchestratorService:
    def __init__(
        self,
        *,
        marketplace: Any,
        trace_service: Any = None,
        pipeline_runner: Callable[[str, dict, dict | None], dict] = run_pipeline,
    ):
        self._marketplace = marketplace
        self._trace_service = trace_service
        self._pipeline_runner = pipeline_runner
        self.place_service: Any = None  # Injected by main.py at startup

    def run_recommendation_pipeline(self, request_id: str) -> dict:
        if self._marketplace is None or not hasattr(self._marketplace, "get_request"):
            raise ValueError("marketplace not configured")

        request = self._marketplace.get_request(request_id)
        if not request:
            raise ValueError("request not found")

        preferences = request.get("preferences") or None
        state = self._pipeline_runner(
            request["raw_input"],
            request["location"],
            preferences,
        )

        # Cache places with pipeline review summaries for /api/places detail
        candidate_providers = state.get("candidate_providers") or []
        review_summaries = state.get("review_summaries") or []
        if self.place_service is not None and candidate_providers:
            self.place_service.cache_places(
                candidate_providers, review_summaries=review_summaries
            )

        structured_request = state.get("structured_request") or request
        if isinstance(structured_request, dict):
            structured_request["id"] = request_id

        results = state.get("final_results") or []
        agent_reply = str(state.get("agent_reply") or "").strip()
        trace = state.get("trace") or AgentTrace(request_id=request_id, steps=[]).model_dump()
        if isinstance(trace, dict):
            trace["request_id"] = request_id

        response = {
            "request": structured_request,
            "results": results,
            "agent_reply": agent_reply,
        }

        if self._trace_service is not None and hasattr(self._trace_service, "store_trace"):
            self._trace_service.store_trace(request_id, trace)

        return response

