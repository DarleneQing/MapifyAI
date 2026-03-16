"""
TDD tests for wiring requests controller to services.

RED: Write failing test first.
GREEN: Implement wire_requests_controller and call at startup.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.api.requests as requests_api
from app.wiring import wire_requests_controller


client = TestClient(app)


class InMemoryMarketplace:
    """
    Test double for marketplace service.
    Implements get_request and get_offers for wiring verification.
    """

    def __init__(self):
        self._requests: dict[str, dict] = {}
        self._offers: dict[str, list[dict]] = {}

    def store_request(self, request_id: str, request: dict) -> None:
        self._requests[request_id] = request

    def store_offers(self, request_id: str, offers: list[dict]) -> None:
        self._offers[request_id] = offers

    def get_request(self, request_id: str) -> dict | None:
        return self._requests.get(request_id)

    def get_offers(self, request_id: str) -> list[dict]:
        return self._offers.get(request_id, [])


def test_wire_requests_controller_connects_marketplace_to_get_request():
    """
    When wire_requests_controller is called with marketplace,
    GET /api/requests/{id} returns data from that marketplace.
    """
    in_mem = InMemoryMarketplace()
    in_mem.store_request(
        "req-wired",
        {"id": "req-wired", "raw_input": "haircut near HB", "status": "open"},
    )
    in_mem.store_offers("req-wired", [{"id": "offer-1", "request_id": "req-wired"}])

    prev_marketplace = requests_api.marketplace
    try:
        wire_requests_controller(marketplace=in_mem)

        response = client.get("/api/requests/req-wired")

        assert response.status_code == 200
        body = response.json()
        assert body["request"]["id"] == "req-wired"
        assert body["request"]["raw_input"] == "haircut near HB"
        assert len(body["offers"]) == 1
        assert body["offers"][0]["id"] == "offer-1"
    finally:
        requests_api.marketplace = prev_marketplace


def test_wire_requests_controller_connects_marketplace_to_get_offers():
    """
    When wire_requests_controller is called with marketplace,
    GET /api/requests/{id}/offers returns offers from that marketplace.
    """
    in_mem = InMemoryMarketplace()
    in_mem.store_offers(
        "req-offers",
        [
            {"id": "o1", "request_id": "req-offers", "price": 30},
            {"id": "o2", "request_id": "req-offers", "price": 45},
        ],
    )

    prev_marketplace = requests_api.marketplace
    try:
        wire_requests_controller(marketplace=in_mem)

        response = client.get("/api/requests/req-offers/offers")

        assert response.status_code == 200
        body = response.json()
        assert body["request_id"] == "req-offers"
        assert len(body["offers"]) == 2
        assert body["offers"][0]["id"] == "o1"
    finally:
        requests_api.marketplace = prev_marketplace


def test_create_request_works_with_real_services(monkeypatch):
    """
    End-to-end controller test using real request_service + orchestrator_service.
    The pipeline runner is stubbed to avoid external OpenAI calls.
    """
    from app.services.marketplace_memory import InMemoryMarketplace
    from app.services.request_service import RequestService
    from app.services.orchestrator_service import OrchestratorService
    from app.services.trace import TraceService

    marketplace = InMemoryMarketplace()
    trace_service = TraceService()
    request_service = RequestService(marketplace)

    def fake_pipeline_runner(raw_input: str, location: dict, preferences: dict | None):
        return {
            "structured_request": {
                "id": "pending",
                "raw_input": raw_input,
                "location": location,
                "status": "open",
            },
            "ranked_offers": [{"id": "offer-1", "score": 0.9}],
            "final_results": [
                {"place_id": "offer-1", "name": "Fake Place", "recommendation_score": 0.9},
            ],
            "trace": {"request_id": "pending", "steps": [{"agent": "fake"}]},
        }

    orchestrator_service = OrchestratorService(
        marketplace=marketplace,
        trace_service=trace_service,
        pipeline_runner=fake_pipeline_runner,
    )

    wire_requests_controller(
        marketplace=marketplace,
        trace_service=trace_service,
        request_service=request_service,
        orchestrator_service=orchestrator_service,
    )

    payload = {
        "raw_input": "Need a haircut near Zurich HB in 2 hours",
        "location": {"lat": 47.378, "lng": 8.54},
        "preferences": {"weight_price": 0.6, "weight_distance": 0.2, "weight_rating": 0.2},
    }

    resp = client.post("/api/requests?stream=false", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert set(body.keys()) == {"request", "results"}
    assert isinstance(body["results"], list)
    assert len(body["results"]) == 1
    assert body["results"][0]["place_id"] == "offer-1"

    created_id = body["request"]["id"]
    assert marketplace.get_request(created_id) is not None
    assert trace_service.get_trace(created_id)["request_id"] == created_id

    offers_resp = client.get(f"/api/requests/{created_id}/offers")
    assert offers_resp.status_code == 200
    offers_body = offers_resp.json()
    assert offers_body["request_id"] == created_id
    assert isinstance(offers_body["offers"], list)


def test_app_starts_with_requests_controller_wired():
    """
    Default wiring (InMemoryMarketplace + TraceService) allows GET /api/requests
    to return 200 instead of 500 "marketplace service not configured".
    """
    from app.services.marketplace_memory import InMemoryMarketplace
    from app.services.trace import TraceService

    wire_requests_controller(
        marketplace=InMemoryMarketplace(),
        trace_service=TraceService(),
    )

    response = client.get("/api/requests/any-id")

    assert response.status_code == 200
    body = response.json()
    assert "request" in body
    assert "offers" in body


def test_wire_requests_controller_connects_trace_service():
    """
    When wire_requests_controller is called with trace_service,
    GET /api/requests/{id}/trace returns trace from that service.
    """
    class DummyTraceService:
        def get_trace(self, request_id: str):
            return {"request_id": request_id, "steps": [{"agent": "test"}]}

    prev_trace = requests_api.trace_service
    try:
        wire_requests_controller(trace_service=DummyTraceService())

        response = client.get("/api/requests/req-trace/trace")

        assert response.status_code == 200
        body = response.json()
        assert body["request_id"] == "req-trace"
        assert len(body["steps"]) == 1
        assert body["steps"][0]["agent"] == "test"
    finally:
        requests_api.trace_service = prev_trace
