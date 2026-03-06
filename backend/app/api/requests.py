"""
POST /api/requests  — create a new request and trigger the agent pipeline
GET  /api/requests/{id}         — fetch request details
GET  /api/requests/{id}/offers  — fetch ranked offers for a request
GET  /api/requests/{id}/trace   — fetch agent trace (US-13)

Backend-2: implement the DB persistence + realtime broadcast
Backend-1: wire in run_pipeline() from agents/graph.py
"""
from fastapi import APIRouter, HTTPException

from app.models.schemas import CreateRequestPayload
from app.agents.graph import run_pipeline

router = APIRouter(prefix="/api/requests", tags=["requests"])


@router.post("/")
async def create_request(payload: CreateRequestPayload):
    """
    Triggers the full agent pipeline and returns ranked offers + trace.
    No DB persistence yet — stateless for now.
    """
    try:
        state = run_pipeline(
            raw_input=payload.raw_input,
            location=payload.location.model_dump(),
            preferences=payload.preferences.model_dump() if payload.preferences else None,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "request": state["structured_request"],
        "offers": state["ranked_offers"],
        "trace": state["trace"],
    }


@router.get("/{request_id}")
async def get_request(request_id: str):
    # TODO (Backend-2): fetch from Supabase
    raise HTTPException(status_code=501, detail="Not implemented — Backend-2 pending")


@router.get("/{request_id}/offers")
async def get_offers(request_id: str):
    # TODO (Backend-2): fetch from Supabase
    raise HTTPException(status_code=501, detail="Not implemented — Backend-2 pending")


@router.get("/{request_id}/trace")
async def get_trace(request_id: str):
    # TODO (Backend-2): fetch from Supabase
    raise HTTPException(status_code=501, detail="Not implemented — Backend-2 pending")
