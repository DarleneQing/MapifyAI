"""
In-memory marketplace implementation for dev/test when DB is not configured.

Use when SUPABASE_URL is empty. Implements get_request and get_offers.
"""
from app.models.schemas import StructuredRequest, Offer


class InMemoryMarketplace:
    """
    In-memory marketplace for request/offer storage.
    Implements the marketplace interface used by the requests controller.
    """

    def __init__(self):
        self._requests: dict[str, dict] = {}
        self._offers: dict[str, list[dict]] = {}

    def persist_request(self, request: StructuredRequest | dict) -> str:
        """Store request. Returns request id."""
        data = request.model_dump() if hasattr(request, "model_dump") else request
        if isinstance(data.get("requested_time"), str):
            pass  # already serialized
        else:
            from datetime import datetime
            dt = data.get("requested_time")
            if hasattr(dt, "isoformat"):
                data["requested_time"] = dt.isoformat()
        request_id = getattr(request, "id", None) or data["id"]
        self._requests[request_id] = data
        return request_id

    def persist_offers(self, offers: list[Offer] | list[dict]) -> None:
        """Store offers by request_id."""
        for o in offers:
            rid = getattr(o, "request_id", None) or o.get("request_id")
            if not rid:
                # If we don't have a request_id (e.g., ranked provider dict),
                # store under a special bucket.
                rid = "__unknown__"
            if rid not in self._offers:
                self._offers[rid] = []
            data = o.model_dump() if hasattr(o, "model_dump") else o
            self._offers[rid].append(data)

    def get_request(self, request_id: str) -> dict | None:
        """Fetch request by id."""
        return self._requests.get(request_id)

    def get_offers(self, request_id: str) -> list[dict]:
        """Fetch offers for request, ordered by score desc."""
        offers = self._offers.get(request_id, [])
        return sorted(offers, key=lambda x: x.get("score", 0), reverse=True)

    def close_request(self, request_id: str) -> None:
        """Mark request as closed."""
        if request_id in self._requests:
            self._requests[request_id]["status"] = "closed"
