import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.api.requests as requests_api
import app.api.offers as offers_api
import app.api.providers as providers_api
import app.api.users as users_api
import app.api.places as places_api


client = TestClient(app)

AGENT_PIPELINE_NODES = [
    "input_agent",
    "crawling_agent_search",
    "crawling_agent_transit",
    "evaluation_agent",
    "review_agent",
    "orchestrator_agent",
    "output_agent_ranking",
    "output_agent_recommendation",
]


def test_create_request_non_stream_uses_services(monkeypatch):
    calls: dict[str, object] = {}

    class DummyAuthService:
        def get_current_user_id(self) -> str | None:
            calls["auth_user_id_called"] = True
            return "user-123"

    class DummyRequestService:
        def create_request(self, payload, user_id: str | None):
            calls["create_request_args"] = (payload, user_id)
            return {
                "id": "req-123",
                "raw_input": payload.raw_input,
                "location": payload.location,
                "preferences": payload.preferences,
            }

    class DummyOrchestratorService:
        def run_recommendation_pipeline(self, request_id: str):
            calls["run_recommendation_pipeline_args"] = request_id
            return {
                "request": {"id": request_id},
                "offers": [
                    {
                        "id": "offer-1",
                        "price": 42,
                        "provider_id": "prov-1",
                        "transit": {
                            "duration_minutes": 12,
                            "transport_types": ["tram"],
                            "departure_time": "17:45",
                            "summary": "12 min by tram (Line 4)",
                            "connections": None,
                        },
                        "one_sentence_recommendation": "Affordable salon with great reviews, just 12 min by tram.",
                    }
                ],
                "trace": {
                    "steps": [
                        {"agent_name": node, "status": "success", "duration_ms": 100}
                        for node in AGENT_PIPELINE_NODES
                    ]
                },
            }

    monkeypatch.setattr(
        requests_api, "auth_service", DummyAuthService(), raising=False
    )
    monkeypatch.setattr(
        requests_api, "request_service", DummyRequestService(), raising=False
    )
    monkeypatch.setattr(
        requests_api,
        "orchestrator_service",
        DummyOrchestratorService(),
        raising=False,
    )

    payload = {
        "raw_input": "Need a haircut near Zurich HB in 2 hours",
        "location": {"lat": 47.378, "lng": 8.54},
        "preferences": {
            "weight_price": 0.6,
            "weight_distance": 0.2,
            "weight_rating": 0.2,
        },
    }

    response = client.post("/api/requests?stream=false", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"request", "offers", "trace"}

    assert calls.get("auth_user_id_called") is True
    created_payload, user_id = calls["create_request_args"]
    assert user_id == "user-123"
    assert created_payload.raw_input == payload["raw_input"]
    assert created_payload.location.lat == payload["location"]["lat"]
    assert created_payload.location.lng == payload["location"]["lng"]

    assert calls["run_recommendation_pipeline_args"] == "req-123"
    assert isinstance(body["offers"], list)
    assert len(body["offers"]) == 1

    offer = body["offers"][0]
    assert "transit" in offer
    assert offer["transit"]["duration_minutes"] == 12
    assert offer["transit"]["transport_types"] == ["tram"]
    assert offer["transit"]["departure_time"] == "17:45"
    assert offer["transit"]["summary"] == "12 min by tram (Line 4)"
    assert offer["one_sentence_recommendation"] == "Affordable salon with great reviews, just 12 min by tram."

    assert "trace" in body
    trace_steps = body["trace"]["steps"]
    assert len(trace_steps) == len(AGENT_PIPELINE_NODES)
    step_names = [s["agent_name"] for s in trace_steps]
    assert step_names == AGENT_PIPELINE_NODES


def test_get_request_aggregates_request_and_offers(monkeypatch):
    calls: dict[str, object] = {}

    class DummyMarketplace:
        def get_request(self, request_id: str):
            calls["get_request_args"] = request_id
            return {"id": request_id, "raw_input": "test", "status": "open"}

        def get_offers(self, request_id: str):
            calls["get_offers_args"] = request_id
            return [{"id": "offer-1", "request_id": request_id}]

    monkeypatch.setattr(
        requests_api, "marketplace", DummyMarketplace(), raising=False
    )

    response = client.get("/api/requests/req-456")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) >= {"request", "offers"}
    assert body["request"]["id"] == "req-456"
    assert len(body["offers"]) == 1

    assert calls["get_request_args"] == "req-456"
    assert calls["get_offers_args"] == "req-456"


def test_get_offers_for_request_uses_marketplace(monkeypatch):
    calls: dict[str, object] = {}

    class DummyMarketplace:
        def get_offers(self, request_id: str):
            calls["get_offers_args"] = request_id
            return [
                {"id": "offer-1", "request_id": request_id},
                {"id": "offer-2", "request_id": request_id},
            ]

    monkeypatch.setattr(
        requests_api, "marketplace", DummyMarketplace(), raising=False
    )

    response = client.get("/api/requests/req-789/offers")

    assert response.status_code == 200
    body = response.json()
    assert body["request_id"] == "req-789"
    assert len(body["offers"]) == 2
    assert calls["get_offers_args"] == "req-789"


def test_get_trace_uses_trace_service(monkeypatch):
    calls: dict[str, object] = {}

    class DummyTraceService:
        def get_trace(self, request_id: str):
            calls["get_trace_args"] = request_id
            return {
                "trace_id": "trace-abc",
                "request_id": request_id,
                "graph": {
                    "nodes": [
                        {"id": node, "type": "agent"}
                        for node in AGENT_PIPELINE_NODES
                    ],
                    "edges": [
                        {"from": "input_agent", "to": "crawling_agent_search"},
                        {"from": "input_agent", "to": "review_agent"},
                        {"from": "crawling_agent_search", "to": "crawling_agent_transit"},
                        {"from": "crawling_agent_transit", "to": "evaluation_agent"},
                        {"from": "evaluation_agent", "to": "orchestrator_agent"},
                        {"from": "review_agent", "to": "orchestrator_agent"},
                        {"from": "orchestrator_agent", "to": "output_agent_ranking"},
                        {"from": "orchestrator_agent", "to": "output_agent_recommendation"},
                    ],
                },
                "steps": [
                    {
                        "agent_name": node,
                        "status": "success",
                        "duration_ms": 100,
                        "input_summary": "...",
                        "output_summary": "...",
                    }
                    for node in AGENT_PIPELINE_NODES
                ],
            }

    monkeypatch.setattr(
        requests_api, "trace_service", DummyTraceService(), raising=False
    )

    response = client.get("/api/requests/req-trace/trace")

    assert response.status_code == 200
    body = response.json()
    assert body["request_id"] == "req-trace"
    assert body["trace_id"] == "trace-abc"
    assert calls["get_trace_args"] == "req-trace"

    node_ids = [n["id"] for n in body["graph"]["nodes"]]
    assert node_ids == AGENT_PIPELINE_NODES

    assert len(body["graph"]["edges"]) == 8
    assert body["graph"]["edges"][0] == {"from": "input_agent", "to": "crawling_agent_search"}
    assert body["graph"]["edges"][1] == {"from": "input_agent", "to": "review_agent"}

    step_names = [s["agent_name"] for s in body["steps"]]
    assert step_names == AGENT_PIPELINE_NODES
    assert all(s["status"] == "success" for s in body["steps"])


def test_list_providers_uses_provider_service(monkeypatch):
    calls: dict[str, object] = {}

    class DummyProviderService:
        def list_providers(
            self,
            category: str | None,
            lat: float | None,
            lng: float | None,
            radius_km: float,
        ):
            calls["list_providers_args"] = (category, lat, lng, radius_km)
            return [
                {"id": "p1", "name": "Provider 1"},
                {"id": "p2", "name": "Provider 2"},
            ]

    monkeypatch.setattr(
        providers_api, "provider_service", DummyProviderService(), raising=False
    )

    response = client.get(
        "/api/providers",
        params={
            "category": "haircut",
            "lat": 47.378,
            "lng": 8.54,
            "radius_km": 3.0,
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 2
    assert calls["list_providers_args"] == ("haircut", 47.378, 8.54, 3.0)


def test_get_provider_uses_provider_service(monkeypatch):
    calls: dict[str, object] = {}

    class DummyProviderService:
        def get_provider(self, provider_id: str):
            calls["get_provider_args"] = provider_id
            return {"id": provider_id, "name": "Provider 1"}

    monkeypatch.setattr(
        providers_api, "provider_service", DummyProviderService(), raising=False
    )

    response = client.get("/api/providers/prov-1")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "prov-1"
    assert calls["get_provider_args"] == "prov-1"


def test_submit_offer_uses_services(monkeypatch):
    calls: dict[str, object] = {}

    class DummyAuthService:
        def get_current_provider_id(self) -> str:
            calls["auth_provider_id_called"] = True
            return "prov-1"

    class DummyRequestService:
        def ensure_request_exists(self, request_id: str) -> None:
            calls["ensure_request_exists_args"] = request_id

    class DummyOfferService:
        def submit_offer(self, payload):
            calls["submit_offer_args"] = payload
            return {
                "id": "offer-1",
                "request_id": payload.request_id,
                "provider_id": "prov-1",
                "price": payload.price,
            }

    monkeypatch.setattr(
        offers_api, "auth_service", DummyAuthService(), raising=False
    )
    monkeypatch.setattr(
        offers_api, "request_service", DummyRequestService(), raising=False
    )
    monkeypatch.setattr(
        offers_api, "offer_service", DummyOfferService(), raising=False
    )

    payload = {
        "request_id": "req-123",
        "price": 50.0,
        "eta_minutes": 10,
        "message": "Can take you in 10 minutes",
    }

    response = client.post("/api/offers", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "offer-1"
    assert body["request_id"] == "req-123"
    assert body["provider_id"] == "prov-1"
    assert calls.get("auth_provider_id_called") is True
    assert calls["ensure_request_exists_args"] == "req-123"


def test_get_me_uses_profile_service(monkeypatch):
    calls: dict[str, object] = {}

    class DummyAuthService:
        def get_current_user_id(self) -> str:
            calls["auth_user_id_called"] = True
            return "user-123"

    class DummyProfileService:
        def get_or_create_user_preferences(self, user_id: str):
            calls["get_or_create_user_preferences_args"] = user_id
            return {
                "weight_price": 0.5,
                "weight_distance": 0.25,
                "weight_rating": 0.25,
            }

    monkeypatch.setattr(
        users_api, "auth_service", DummyAuthService(), raising=False
    )
    monkeypatch.setattr(
        users_api, "profile_service", DummyProfileService(), raising=False
    )

    response = client.get("/api/users/me")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == "user-123"
    assert "preferences" in body
    assert calls.get("auth_user_id_called") is True
    assert calls["get_or_create_user_preferences_args"] == "user-123"


def test_update_preferences_uses_profile_service(monkeypatch):
    calls: dict[str, object] = {}

    class DummyAuthService:
        def get_current_user_id(self) -> str:
            calls["auth_user_id_called"] = True
            return "user-123"

    class DummyProfileService:
        def update_user_preferences(self, user_id: str, prefs):
            calls["update_user_preferences_args"] = (user_id, prefs)
            return prefs

    monkeypatch.setattr(
        users_api, "auth_service", DummyAuthService(), raising=False
    )
    monkeypatch.setattr(
        users_api, "profile_service", DummyProfileService(), raising=False
    )

    prefs_payload = {
        "weight_price": 0.3,
        "weight_distance": 0.4,
        "weight_rating": 0.3,
    }

    response = client.put("/api/users/me/preferences", json=prefs_payload)

    assert response.status_code == 200
    body = response.json()
    assert body["weight_price"] == pytest.approx(0.3)
    assert body["weight_distance"] == pytest.approx(0.4)
    assert body["weight_rating"] == pytest.approx(0.3)
    assert calls.get("auth_user_id_called") is True
    user_id, prefs_obj = calls["update_user_preferences_args"]
    assert user_id == "user-123"
    assert prefs_obj.weight_price == pytest.approx(0.3)
    assert prefs_obj.weight_distance == pytest.approx(0.4)
    assert prefs_obj.weight_rating == pytest.approx(0.3)


def test_get_place_detail_uses_place_service(monkeypatch):
    calls: dict[str, object] = {}

    class DummyPlaceService:
        def get_place_detail(self, place_id: str, request_id: str | None):
            calls["get_place_detail_args"] = (place_id, request_id)
            return {
                "id": place_id,
                "name": "Test Place",
                "review_summary": {
                    "advantages": [
                        "Professional staff",
                        "Clean environment",
                    ],
                    "disadvantages": [
                        "Long wait during peak hours",
                    ],
                    "star_reasons": {
                        "five_star": ["Great value"],
                        "one_star": ["Occasional rude staff"],
                    },
                },
                "transit": {
                    "duration_minutes": 15,
                    "transport_types": ["bus"],
                    "departure_time": "18:00",
                    "summary": "15 min by bus (Line 33)",
                    "connections": None,
                },
                "one_sentence_recommendation": "Clean, professional salon reachable in 15 min by bus.",
            }

    monkeypatch.setattr(
        places_api, "place_service", DummyPlaceService(), raising=False
    )

    response = client.get("/api/places/place-123", params={"request_id": "req-999"})

    assert response.status_code == 200
    body = response.json()
    assert body["place"]["id"] == "place-123"
    assert body["request_id"] == "req-999"
    assert calls["get_place_detail_args"] == ("place-123", "req-999")

    detail = body["place"]
    assert "review_summary" in detail
    review = detail["review_summary"]
    assert "advantages" in review
    assert "disadvantages" in review
    assert "positive_highlights" not in review
    assert "negative_highlights" not in review
    assert len(review["advantages"]) == 2
    assert len(review["disadvantages"]) == 1

    assert "transit" in detail
    assert detail["transit"]["duration_minutes"] == 15
    assert detail["transit"]["transport_types"] == ["bus"]
    assert detail["one_sentence_recommendation"] is not None


def test_list_place_reviews_uses_place_service(monkeypatch):
    calls: dict[str, object] = {}

    class DummyPlaceService:
        def list_reviews(self, place_id: str, page: int, page_size: int, sort: str):
            calls["list_reviews_args"] = (place_id, page, page_size, sort)
            return {
                "page": page,
                "page_size": page_size,
                "total": 1,
                "items": [{"id": "rev-1", "place_id": place_id}],
            }

    monkeypatch.setattr(
        places_api, "place_service", DummyPlaceService(), raising=False
    )

    response = client.get(
        "/api/places/place-123/reviews",
        params={"page": 2, "page_size": 10, "sort": "recent"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["page"] == 2
    assert body["page_size"] == 10
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert calls["list_reviews_args"] == ("place-123", 2, 10, "recent")


def test_create_request_pipeline_returns_mixed_transit_connections(monkeypatch):
    """Verify that multi-leg SBB transit with connections passes through correctly."""

    class DummyAuthService:
        def get_current_user_id(self) -> str | None:
            return None

    class DummyRequestService:
        def create_request(self, payload, user_id):
            return {"id": "req-transit"}

    class DummyOrchestratorService:
        def run_recommendation_pipeline(self, request_id: str):
            return {
                "request": {"id": request_id},
                "offers": [
                    {
                        "id": "offer-mixed",
                        "price": 55,
                        "provider_id": "prov-2",
                        "transit": {
                            "duration_minutes": 22,
                            "transport_types": ["tram", "bus"],
                            "departure_time": "17:45",
                            "summary": "22 min — Tram 4 → Bus 33",
                            "connections": [
                                {
                                    "transport_type": "tram",
                                    "line": "4",
                                    "departure_time": "17:45",
                                    "arrival_time": "17:58",
                                    "duration_minutes": 13,
                                    "from_stop": "Zürich HB",
                                    "to_stop": "Stauffacher",
                                },
                                {
                                    "transport_type": "bus",
                                    "line": "33",
                                    "departure_time": "18:01",
                                    "arrival_time": "18:07",
                                    "duration_minutes": 6,
                                    "from_stop": "Stauffacher",
                                    "to_stop": "Schmiede Wiedikon",
                                },
                            ],
                        },
                        "one_sentence_recommendation": "Great value, reachable in 22 min via tram and bus.",
                    }
                ],
                "trace": None,
            }

    monkeypatch.setattr(
        requests_api, "auth_service", DummyAuthService(), raising=False
    )
    monkeypatch.setattr(
        requests_api, "request_service", DummyRequestService(), raising=False
    )
    monkeypatch.setattr(
        requests_api, "orchestrator_service", DummyOrchestratorService(), raising=False
    )

    payload = {
        "raw_input": "Find a barber near Wiedikon",
        "location": {"lat": 47.372, "lng": 8.525},
    }

    response = client.post("/api/requests?stream=false", json=payload)

    assert response.status_code == 200
    body = response.json()
    offer = body["offers"][0]

    transit = offer["transit"]
    assert transit["duration_minutes"] == 22
    assert transit["transport_types"] == ["tram", "bus"]
    assert len(transit["connections"]) == 2

    leg1 = transit["connections"][0]
    assert leg1["transport_type"] == "tram"
    assert leg1["line"] == "4"
    assert leg1["from_stop"] == "Zürich HB"
    assert leg1["to_stop"] == "Stauffacher"

    leg2 = transit["connections"][1]
    assert leg2["transport_type"] == "bus"
    assert leg2["line"] == "33"
    assert leg2["from_stop"] == "Stauffacher"
    assert leg2["to_stop"] == "Schmiede Wiedikon"

    assert offer["one_sentence_recommendation"] is not None


def test_get_place_detail_review_summary_uses_advantages_not_highlights(monkeypatch):
    """Verify review summaries use advantages/disadvantages, NOT positive_highlights/negative_highlights."""

    class DummyPlaceService:
        def get_place_detail(self, place_id: str, request_id: str | None):
            return {
                "id": place_id,
                "name": "Review Test Place",
                "review_summary": {
                    "advantages": ["Friendly staff", "Good price", "Clean"],
                    "disadvantages": ["Small space", "Long wait"],
                    "star_reasons": {
                        "five_star": ["Excellent service"],
                        "one_star": ["Noise"],
                    },
                },
            }

    monkeypatch.setattr(
        places_api, "place_service", DummyPlaceService(), raising=False
    )

    response = client.get("/api/places/place-review-test")

    assert response.status_code == 200
    body = response.json()
    review = body["place"]["review_summary"]

    assert isinstance(review["advantages"], list)
    assert len(review["advantages"]) == 3
    assert "Friendly staff" in review["advantages"]

    assert isinstance(review["disadvantages"], list)
    assert len(review["disadvantages"]) == 2
    assert "Long wait" in review["disadvantages"]

    assert "positive_highlights" not in review
    assert "negative_highlights" not in review

    assert "star_reasons" in review
    assert isinstance(review["star_reasons"]["five_star"], list)
    assert isinstance(review["star_reasons"]["one_star"], list)


def test_get_trace_returns_all_six_agent_pipeline_nodes(monkeypatch):
    """Verify trace graph contains all 8 nodes of the 6-agent pipeline and correct DAG edges."""

    class DummyTraceService:
        def get_trace(self, request_id: str):
            return {
                "trace_id": "trace-full",
                "request_id": request_id,
                "graph": {
                    "nodes": [
                        {"id": node, "type": "agent"}
                        for node in AGENT_PIPELINE_NODES
                    ],
                    "edges": [
                        {"from": "input_agent", "to": "crawling_agent_search"},
                        {"from": "input_agent", "to": "review_agent"},
                        {"from": "crawling_agent_search", "to": "crawling_agent_transit"},
                        {"from": "crawling_agent_transit", "to": "evaluation_agent"},
                        {"from": "evaluation_agent", "to": "orchestrator_agent"},
                        {"from": "review_agent", "to": "orchestrator_agent"},
                        {"from": "orchestrator_agent", "to": "output_agent_ranking"},
                        {"from": "orchestrator_agent", "to": "output_agent_recommendation"},
                    ],
                },
                "steps": [
                    {"agent_name": n, "status": "success", "duration_ms": 50}
                    for n in AGENT_PIPELINE_NODES
                ],
            }

    monkeypatch.setattr(
        requests_api, "trace_service", DummyTraceService(), raising=False
    )

    response = client.get("/api/requests/req-dag/trace")

    assert response.status_code == 200
    body = response.json()

    node_ids = {n["id"] for n in body["graph"]["nodes"]}
    assert node_ids == set(AGENT_PIPELINE_NODES)
    assert len(body["graph"]["nodes"]) == 8

    edges = body["graph"]["edges"]
    assert len(edges) == 8

    input_targets = {e["to"] for e in edges if e["from"] == "input_agent"}
    assert input_targets == {"crawling_agent_search", "review_agent"}

    orchestrator_sources = {e["from"] for e in edges if e["to"] == "orchestrator_agent"}
    assert orchestrator_sources == {"evaluation_agent", "review_agent"}

    output_targets = {e["to"] for e in edges if e["from"] == "orchestrator_agent"}
    assert output_targets == {"output_agent_ranking", "output_agent_recommendation"}

    assert all(s["status"] == "success" for s in body["steps"])
    assert len(body["steps"]) == 8

