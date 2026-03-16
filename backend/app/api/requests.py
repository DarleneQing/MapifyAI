"""
POST /api/requests              — create a new request and trigger the agent pipeline
GET  /api/requests/{id}         — fetch request details
GET  /api/requests/{id}/offers  — fetch ranked offers for a request
GET  /api/requests/{id}/trace   — fetch agent trace (US-13)

Controller layer: delegates to service layer as defined in
`doc/controller-service-contract.md`.

SSE streaming (?stream=true):
  Returns text/event-stream. Each line is:
    data: {"type": "progress", "agent": "...", "message": "..."}\n\n
  Final line:
    data: {"type": "result", "request": {...}, "results": [...]}\n\n
"""
import asyncio
import json
import threading
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.models.schemas import CreateRequestPayload

router = APIRouter(prefix="/api/requests", tags=["requests"])

# Service dependencies (injected/mocked in tests or wired in at startup)
auth_service: Any | None = None
request_service: Any | None = None
orchestrator_service: Any | None = None
marketplace: Any | None = None
trace_service: Any | None = None


@router.post("/")
async def create_request(payload: CreateRequestPayload, stream: bool = False):
    """
    Create a StructuredRequest and trigger the recommendation pipeline.

    - Non-stream mode (default): returns RankedOffersResponse-like JSON.
    - Stream mode: reserved for future SSE implementation.
    """
    user_id: str | None = None
    if auth_service is not None:
        # Best-effort: anonymous user if auth is not configured.
        user_id = auth_service.get_current_user_id()

    if request_service is None:
        raise HTTPException(status_code=500, detail="request_service not configured")

    structured_request = request_service.create_request(payload, user_id)

    if orchestrator_service is None:
        raise HTTPException(
            status_code=500, detail="orchestrator_service not configured"
        )

    request_id = getattr(structured_request, "id", None) or structured_request["id"]

    if stream:
        return _sse_response(orchestrator_service, request_id)

    ranked_response = orchestrator_service.run_recommendation_pipeline(request_id)
    return ranked_response


def _sse_response(orchestrator_service: Any, request_id: str) -> StreamingResponse:
    """Build an SSE StreamingResponse that streams agent progress then final results."""
    from app.agents.graph import stream_pipeline
    from app.models.schemas import AgentTrace

    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        loop = asyncio.get_event_loop()

        def run_pipeline_thread():
            try:
                marketplace = orchestrator_service._marketplace
                request = marketplace.get_request(request_id)
                if not request:
                    loop.call_soon_threadsafe(
                        queue.put_nowait,
                        {"type": "error", "message": "Request not found"},
                    )
                    loop.call_soon_threadsafe(queue.put_nowait, None)
                    return

                preferences = request.get("preferences") or None
                final_state = None

                def push_start(evt):
                    loop.call_soon_threadsafe(queue.put_nowait, evt)

                for event in stream_pipeline(
                    request["raw_input"],
                    request["location"],
                    preferences,
                    on_node_start=push_start,
                ):
                    if event["type"] == "result":
                        final_state = event["state"]
                    else:
                        loop.call_soon_threadsafe(queue.put_nowait, event)

                # Cache places with pipeline review summaries (simple/advanced/fallback)
                if orchestrator_service.place_service is not None and final_state:
                    candidates = final_state.get("candidate_providers") or []
                    review_summaries = final_state.get("review_summaries") or []
                    if candidates:
                        orchestrator_service.place_service.cache_places(
                            candidates, review_summaries=review_summaries
                        )

                # Build the final result event
                if final_state:
                    structured_request = final_state.get("structured_request") or request
                    if isinstance(structured_request, dict):
                        structured_request["id"] = request_id
                    results = final_state.get("final_results") or []
                    trace = final_state.get("trace") or AgentTrace(
                        request_id=request_id, steps=[]
                    ).model_dump()
                    if isinstance(trace, dict):
                        trace["request_id"] = request_id
                    if orchestrator_service._trace_service is not None:
                        orchestrator_service._trace_service.store_trace(request_id, trace)
                    loop.call_soon_threadsafe(
                        queue.put_nowait,
                        {"type": "result", "request": structured_request, "results": results},
                    )
                else:
                    loop.call_soon_threadsafe(
                        queue.put_nowait,
                        {"type": "error", "message": "Pipeline returned no state"},
                    )
            except Exception as exc:
                loop.call_soon_threadsafe(
                    queue.put_nowait, {"type": "error", "message": str(exc)}
                )
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)  # sentinel

        threading.Thread(target=run_pipeline_thread, daemon=True).start()

        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/{request_id}")
async def get_request(request_id: str):
    """
    Aggregate a StructuredRequest with its current offers.
    """
    if marketplace is None:
        raise HTTPException(status_code=500, detail="marketplace service not configured")

    request = marketplace.get_request(request_id)
    offers = marketplace.get_offers(request_id)
    return {"request": request, "offers": offers}


@router.get("/{request_id}/offers")
async def get_offers(request_id: str):
    """
    Return offers for a given request, as a simple wrapper around marketplace.
    """
    if marketplace is None:
        raise HTTPException(status_code=500, detail="marketplace service not configured")

    offers = marketplace.get_offers(request_id)
    return {"request_id": request_id, "offers": offers}


@router.get("/{request_id}/trace")
async def get_trace(request_id: str):
    """
    Return AgentTrace for a request.
    """
    if trace_service is None:
        raise HTTPException(
            status_code=500, detail="trace_service not configured"
        )

    trace = trace_service.get_trace(request_id)
    return trace
