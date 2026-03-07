"""
Trace service — returns AgentTrace for a request.

In-memory implementation for dev/test. Production would read from DB or logs.
"""
from app.models.schemas import AgentTrace


_traces: dict[str, dict] = {}


def get_trace(request_id: str) -> dict:
    """Return AgentTrace for request_id. Returns empty trace if not found."""
    return _traces.get(request_id, AgentTrace(request_id=request_id, steps=[]).model_dump())


def store_trace(request_id: str, trace: dict) -> None:
    """Store trace for request_id. Used by orchestrator/pipeline."""
    _traces[request_id] = trace


class TraceService:
    """Service object for dependency injection."""

    def get_trace(self, request_id: str) -> dict:
        return get_trace(request_id)

    def store_trace(self, request_id: str, trace: dict) -> None:
        store_trace(request_id, trace)
