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

        structured_request = state.get("structured_request") or request
        if isinstance(structured_request, dict):
            structured_request["id"] = request_id

        results = state.get("final_results") or []
        trace = state.get("trace") or AgentTrace(request_id=request_id, steps=[]).model_dump()
        if isinstance(trace, dict):
            trace["request_id"] = request_id

        response = {
            "request": structured_request,
            "results": results,
        }

        if self._trace_service is not None and hasattr(self._trace_service, "store_trace"):
            self._trace_service.store_trace(request_id, trace)

        return response

