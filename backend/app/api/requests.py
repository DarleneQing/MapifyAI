"""
POST /api/requests              — create a new request and trigger the agent pipeline
GET  /api/requests/{id}         — fetch request details
GET  /api/requests/{id}/offers  — fetch ranked offers for a request
GET  /api/requests/{id}/trace   — fetch agent trace (US-13)

Controller layer: delegates to service layer as defined in
`doc/controller-service-contract.md`.
"""
from typing import Any

from fastapi import APIRouter, HTTPException

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

    # V2: SSE streaming not implemented yet, keep contract but signal clearly.
    if stream:
        raise HTTPException(
            status_code=501, detail="Streaming mode not implemented yet"
        )

    if orchestrator_service is None:
        raise HTTPException(
            status_code=500, detail="orchestrator_service not configured"
        )

    request_id = getattr(structured_request, "id", None) or structured_request["id"]
    ranked_response = orchestrator_service.run_recommendation_pipeline(request_id)
    return ranked_response


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
