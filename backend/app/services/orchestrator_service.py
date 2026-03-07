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

        offers = state.get("ranked_offers") or []
        # Ensure offers are associated to the request so marketplace.get_offers(request_id) works.
        if isinstance(offers, list):
            for o in offers:
                if isinstance(o, dict) and "request_id" not in o:
                    o["request_id"] = request_id
        trace = state.get("trace") or AgentTrace(request_id=request_id, steps=[]).model_dump()
        if isinstance(trace, dict):
            trace["request_id"] = request_id

        response = {
            "request": structured_request,
            "offers": offers,
            "trace": trace,
        }

        if hasattr(self._marketplace, "persist_offers"):
            try:
                self._marketplace.persist_offers(offers)
            except Exception:
                # Marketplace implementation may require Offer models; ignore for now.
                pass

        if self._trace_service is not None and hasattr(self._trace_service, "store_trace"):
            self._trace_service.store_trace(request_id, trace)

        return response

