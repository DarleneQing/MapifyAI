# Backend Architecture Analysis Report

> **Analysis Date**: 2026-03-14  
> **Last Updated**: 2026-03-15 (post David Song integration)  
> **Scope**: Backend implementation vs. documented specifications  
> **Reference Docs**: `api-intelligent-local-bid.md`, `PRD_IntelligentLocalBid.md`, `controller-service-contract.md`, `controller-frontend-contract.md`  
> **Related Teammate Analysis**: `backend_llm_integration_analysis.md`, `doc/backend_review_integration_analysis.md`

---

## Teammate Integration Update (2026-03-15)

David Song’s commit **e1b66b9** (“feat: orchestrator-only LLM override + Featherless QwQ-32B trial config”) added:

1. **Review router integration**  
   - New service: `backend/app/services/review_router.py` with `route_review_summaries(providers, review_mode)`.  
   - Modes: `simple` (existing Daisy path), `advanced` (review_analysis per provider), `fallback` (advanced → simple per provider).  
   - Output normalized to `{place_id, advantages, disadvantages}` for orchestrator compatibility.  
   - `_review_node` in `graph.py` now delegates to the router; `review_mode` comes from state → `REVIEW_MODE` env → default `"simple"`.  
   - **The `review_analysis/` module is now integrated** into the main pipeline via this router (previously documented as “NOT integrated”).

2. **Orchestrator-only LLM override**  
   - Config in `config.py`: `ORCHESTRATOR_MODEL`, `ORCHESTRATOR_API_KEY`, `ORCHESTRATOR_BASE_URL`.  
   - `_orchestrator_node` in `graph.py` resolves: API key/model from ORCHESTRATOR_* or fallback to `OPENAI_API_KEY` / `DEFAULT_MODEL`; uses `base_url` when set (e.g. Featherless).  
   - Intent parser and simple/advanced review summarizers are unchanged; only the orchestrator LLM is overridable.  
   - Docs/examples: `backend/.env.example`, `backend/README.md` (e.g. QwQ-32B trial).

3. **State and config**  
   - `PlannerState` in `state.py`: optional `review_mode`.  
   - `config.py`: `REVIEW_MODE` (existing) plus `ORCHESTRATOR_MODEL`, `ORCHESTRATOR_API_KEY`, `ORCHESTRATOR_BASE_URL`.

4. **Tests added**  
   - `backend/tests/test_review_router.py`, `test_graph_review_node.py`, `test_graph_import_smoke.py`, `test_graph_orchestrator_config.py`.

Wiring for providers/offers and auth (`get_current_provider_id`) is unchanged; see sections 2 and 7 below for remaining gaps.

---

## Executive Summary

The backend has a solid foundation with **core functionality implemented**, including the LangGraph multi-agent pipeline, basic CRUD operations, essential services, and **recommendation SSE streaming** via `POST /api/requests?stream=true`. Gaps remain in provider/offer wiring, profile routes, and optional GET stream / offer stream.

### Quick Stats

| Category | Implemented | Missing/Incomplete | Notes |
|----------|-------------|-------------------|-------|
| API Endpoints | 12 | 7 | POST stream=true returns SSE; GET /requests/{id}/stream not implemented |
| Services | 14 | 5 | Some referenced but not wired |
| Agents | 7/7 | 0 | Pipeline complete |
| Realtime/SSE | 1 | 3 | Recommendation stream via POST; GET stream & offer stream missing |

---

## 1. API Endpoints Analysis

### 1.1 Implemented Endpoints ✓

| Endpoint | Controller | Status | Notes |
|----------|-----------|--------|-------|
| `POST /api/requests` | requests.py | ✓ Working | Non-stream and stream mode; `stream=true` returns SSE from same request |
| `GET /api/requests/{id}` | requests.py | ✓ Working | |
| `GET /api/requests/{id}/offers` | requests.py | ✓ Working | |
| `GET /api/requests/{id}/trace` | requests.py | ✓ Working | Path differs from doc |
| `GET /api/places/{place_id}` | places.py | ✓ Working | PlaceDetailResponse contract |
| `GET /api/places/{place_id}/reviews` | places.py | ✓ Working | Pagination supported |
| `GET /api/users/me` | users.py | ✓ Working | |
| `PUT /api/users/me/preferences` | users.py | ✓ Working | |
| `GET /api/providers` | providers.py | ⚠ Shell Only | `provider_service` not wired |
| `GET /api/providers/{id}` | providers.py | ⚠ Shell Only | `provider_service` not wired |
| `POST /api/offers` | offers.py | ⚠ Shell Only | Services not wired |
| `PUT /api/location/current` | location.py | ✓ Working | |
| `GET /api/location/current` | location.py | ✓ Working | |

### 1.2 Missing Endpoints ✗

| Documented Endpoint | Priority | Impact |
|-------------------|----------|--------|
| `GET /api/requests/{id}/stream` | Low | Optional re-subscribe; recommendation stream is via POST `?stream=true` |
| `POST /api/profile/cold-start-survey` | Medium | Cold-start questionnaire (US-09) |
| `GET /api/profile` | Medium | Full profile retrieval |
| `PUT /api/profile` | Medium | Full profile update |
| `GET /api/meta/privacy` | Low | Privacy disclosure (PRD 8.4) |
| `GET /api/traces/{trace_id}` | Low | Path mismatch (exists at `/requests/{id}/trace`) |
| `GET /api/requests/{id}/offers/stream` | Medium | Offer realtime updates (V2) |
| `POST /api/requests/{id}/offers` | Low | Provider offer submission (different path) |

### 1.3 Path Discrepancies

```
Documented                          | Implemented
------------------------------------|-----------------------------------
GET /api/traces/{trace_id}          | GET /api/requests/{id}/trace ✓
POST /api/requests/{id}/offers      | POST /api/offers ⚠
GET /api/profile                    | GET /api/users/me (partial)
```

---

## 2. Services Analysis

### 2.1 Implemented Services ✓

| Service | File | Wired | Notes |
|---------|------|-------|-------|
| `RequestService` | request_service.py | ✓ Yes | create_request, ensure_request_exists |
| `OrchestratorService` | orchestrator_service.py | ✓ Yes | run_recommendation_pipeline |
| `PlaceService` | place_service.py | ✓ Yes | get_place_detail, list_reviews, cache; returns `images` (up to 4 URLs) from cache/Apify |
| `InMemoryProfileService` | profile_service.py | ✓ Yes | Basic preference CRUD |
| `AnonymousAuthService` | auth_service.py | ✓ Yes | Returns "anonymous" user_id |
| `LocationService` | location_service.py | ✓ Yes | Device location sync |
| `InMemoryMarketplace` | marketplace_memory.py | ✓ Yes | Request/Offer storage |
| `TraceService` | trace.py | ✓ Yes | Agent trace storage |
| `ranking` module | ranking.py | ✓ (internal) | Score calculation |
| `explanation` module | explanation.py | ✓ (internal) | Reason generation |
| `reviews` module | reviews.py | ✓ (internal) | LLM review summarization |
| `review_router` | review_router.py | ✓ Yes | Routes simple/advanced/fallback; used by _review_node |
| `swiss_transit` module | swiss_transit.py | ✓ (internal) | transport.opendata.ch |
| `apify_search` module | apify_search.py | ✓ (internal) | Apify Google Maps |
| `geo` module | geo.py | ✓ (internal) | Haversine distance |

### 2.2 Missing/Incomplete Services ✗

| Service | Documented In | Status | Impact |
|---------|--------------|--------|--------|
| `provider_service` | controller-service-contract.md | ⚠ Not wired | Providers API broken |
| `offer_service` | controller-service-contract.md | ⚠ Not wired | Offers API broken |
| `meta_service` | controller-service-contract.md | ✗ Not implemented | Privacy endpoint |
| `sse_service` | controller-service-contract.md | ✗ Not implemented | All streaming |
| `intent_service` | controller-service-contract.md | ⚠ Exists as agent | Not standalone |

### 2.3 Service Wiring Issues

**Problem**: Controllers reference services that are never injected.

```python
# backend/app/api/providers.py
provider_service: Any | None = None  # NEVER WIRED!

# backend/app/api/offers.py
offer_service: Any | None = None     # NEVER WIRED!
auth_service: Any | None = None      # NEVER WIRED!
request_service: Any | None = None   # NEVER WIRED!
```

**Missing in `main.py` lifespan:**
- `wire_providers_controller()` - Does not exist
- `wire_offers_controller()` - Does not exist

---

## 3. Multi-Agent Pipeline Analysis

### 3.1 Pipeline Architecture ✓

The LangGraph pipeline is **fully implemented** and matches the PRD specification:

```
                    intent_parser
                         │
                         ▼
                  crawling_search (Apify)
                         │
                         ▼
                  transit_calculator (Swiss Transit API)
                         │
           ┌─────────────┴─────────────┐
           ▼                           ▼
   evaluation_agent              review_agent
           │                           │
           └─────────────┬─────────────┘
                         ▼
                orchestrator_agent (LLM)
                         │
                         ▼
                   output_ranking
                         │
                        END
```

### 3.2 Agent Implementation Status

| Agent | File | Status | External API |
|-------|------|--------|--------------|
| Intent Parser | intent_parser.py | ✓ Complete | OpenAI |
| Crawling Search | crawling_search.py | ✓ Complete | Apify Google Maps; `maxImages: 4`, provider dict includes `images` (list of URLs) |
| Transit Calculator | transit_calculator.py | ✓ Complete | transport.opendata.ch |
| Evaluation Agent | graph.py | ✓ Complete | - |
| Review Agent | graph.py + review_router.py | ✓ Complete | simple: OpenAI; advanced/fallback: review_analysis (Featherless optional) |
| Orchestrator Agent | graph.py | ✓ Complete | Configurable: ORCHESTRATOR_* or OpenAI |
| Output Ranking | graph.py | ✓ Complete | - |

### 3.3 Parallel Execution ✓

The pipeline correctly implements parallel execution:
- `evaluation_agent` and `review_agent` run simultaneously after `transit_calculator`
- Both converge at `orchestrator_agent`
- Implemented via LangGraph's conditional edges

---

## 4. Duplicate/Redundant Code

### 4.1 File Duplications

| Active File | Redundant File | Issue |
|-------------|---------------|-------|
| `ranking.py` | `ranking_todo.py` | Old stub with `NotImplementedError` |
| `explanation.py` | `explaination_todo.py` | Old stub with `NotImplementedError` |
| `crawling_search.py` | `retrieval.py` | `retrieval.py` is seed-data fallback |

**Recommendation**: Delete `*_todo.py` files and consider merging `retrieval.py` logic.

### 4.2 Overlapping Functionality

| Module A | Module B | Overlap |
|----------|----------|---------|
| `reviews.py` | `review_analysis/` | Both do review summarization |
| `place_service.py` | `review_analysis/service.py` | Both generate review summaries |

**Details**:
- `reviews.py`: Simple LLM-based summary used in pipeline (Daisy/simple path).
- `review_analysis/`: Full pipeline with Apify review scraper, filtering, and structured output.
- **As of 2026-03-15:** The `review_analysis/` module **is integrated** via `review_router.py`. The graph’s `_review_node` calls `route_review_summaries(..., review_mode)`; modes `advanced` and `fallback` use the review_analysis pipeline (per provider), with output normalized to `{place_id, advantages, disadvantages}` for the orchestrator.

---

## 5. Realtime/SSE Features

### 5.1 Status: Partially Implemented

| Feature | Documented In | Status |
|---------|--------------|--------|
| Recommendation streaming | api-intelligent-local-bid.md §3.1 | ✓ Implemented via `POST /api/requests?stream=true` (same response body is SSE) |
| GET /requests/{id}/stream | controller-frontend-contract.md §2.3 | ✗ Not implemented (optional) |
| Offer realtime updates | api-intelligent-local-bid.md §6.4 | ✗ Not implemented |
| `broadcast_new_offer` | realtime/events.py | ✗ `NotImplementedError` |
| `broadcast_request_closed` | realtime/events.py | ✗ `NotImplementedError` |

### 5.2 Implemented SSE Event Format (POST stream=true)

The same POST response has `Content-Type: text/event-stream`. Each line is `data: <JSON>\n\n`:

- **progress (starting)**: `{ "type": "progress", "status": "starting", "agent": "<node_name>", "message": "..." }`  
  - Emitted via the LangGraph callback when a node is about to run.  
  - For fan‑out after `transit_calculator`, both `evaluation_agent` and `review_agent` get their own `"starting"` events.
- **progress (done)**: `{ "type": "progress", "status": "done", "agent": "<node_name>", "duration_ms": <number>, "message": "..." }`  
  - Emitted once per node when it finishes.  
  - For the parallel branch, **both** `evaluation_agent` and `review_agent` now emit `"done"` events (the stream iterates all keys in each LangGraph chunk), so frontend timing for **Scoring & Ranking** and **Analyzing Reviews** is accurate even in advanced Apify mode.
- **result**: `{ "type": "result", "request": {...}, "results": [PlaceSummary[]] }`.
- **error**: `{ "type": "error", "message": "..." }`.

Backend agent names: `intent_parser`, `crawling_search`, `transit_calculator`, `review_agent`, `evaluation_agent`, `orchestrator_agent`, `output_ranking`.  The logical 7 UI stages are:
`intent_parsed` → `stores_crawled` → `transit_computed` → `reviews_fetched` → `scores_computed` → `recommendations_ready` → `completed`.

---

## 6. Config and LLM Overrides (post 2026-03-15)

| Config | Purpose |
|--------|--------|
| `REVIEW_MODE` | Default review path: `simple` \| `advanced` \| `fallback`; overridable via `PlannerState.review_mode`. |
| `ORCHESTRATOR_MODEL` | Model for orchestrator node only (e.g. `Qwen/QwQ-32B`). Fallback: `DEFAULT_MODEL`. |
| `ORCHESTRATOR_API_KEY` | API key for orchestrator; fallback: `OPENAI_API_KEY`. |
| `ORCHESTRATOR_BASE_URL` | Base URL for orchestrator client (e.g. `https://api.featherless.ai/v1`). |

Intent parser and review summarizers (simple and advanced) are unchanged; only the orchestrator LLM uses ORCHESTRATOR_* when set. See repo-root `backend_llm_integration_analysis.md` and `doc/backend_review_integration_analysis.md` for full LLM call paths, review integration details, and compatibility notes.

---

## 7. Data Model Alignment

### 7.1 Core Models ✓

| Model | schemas.py | API Contract | Aligned |
|-------|-----------|--------------|---------|
| `LatLng` | ✓ | ✓ | ✓ |
| `StructuredRequest` | ✓ | ✓ | ✓ |
| `Provider` | ✓ | PlaceSummary | ⚠ Partial |
| `Offer` | ✓ | ✓ | ✓ |
| `UserPreferences` | ✓ | ✓ | ✓ |
| `AgentTrace` | ✓ | ✓ | ✓ |
| `DeviceLocation` | ✓ | ✓ | ✓ |

### 7.2 Missing Models

| Model | Documented In | Status |
|-------|--------------|--------|
| `UserProfile` | api-intelligent-local-bid.md §2.4 | ✗ Not in schemas.py |
| `ColdStartSurveyPayload` | controller-service-contract.md | ✗ Not in schemas.py |
| `PrivacyMeta` | controller-service-contract.md | ✗ Not in schemas.py |
| `PlaceSummary` | api-intelligent-local-bid.md §2.2 | ⚠ Output-only (graph.py) |

---

## 8. Authentication & Authorization

### 8.1 Current State

```python
class AnonymousAuthService:
    def get_current_user_id(self) -> str:
        return "anonymous"
    
    # MISSING: get_current_provider_id()
```

### 8.2 Issues

1. **`get_current_provider_id()`** is called in `offers.py` but **not implemented**
2. No JWT/token validation
3. No role differentiation (user vs provider)

---

## 9. Recommendations

### 9.1 Critical (P0) — Must Fix

1. **Wire missing services in `main.py`**:
   ```python
   # Add to lifespan:
   provider_service = ProviderService(marketplace)
   offer_service = OfferService(marketplace)
   wire_providers_controller(provider_service=provider_service)
   wire_offers_controller(
       auth_service=auth_service,
       request_service=request_service, 
       offer_service=offer_service,
   )
   ```

2. **Implement `get_current_provider_id()` in `AnonymousAuthService`**

3. **Delete redundant `*_todo.py` files**

### 9.2 High (P1) — Should Fix

1. **Recommendation SSE** is implemented: `POST /api/requests?stream=true` returns SSE (progress starting/done with duration_ms, result, error). Optional: add `GET /api/requests/{id}/stream` for re-subscribe without re-POST.

2. **`review_analysis/` integration (done 2026-03-15):** Connected via `review_router.py`; `_review_node` uses `review_mode` (state/env/default "simple"). Optional: document runtime override source (request vs env only) and per-provider latency/cost policy.

3. **Add missing endpoints**:
   - `POST /api/profile/cold-start-survey`
   - `GET/PUT /api/profile`
   - `GET /api/meta/privacy`

### 9.3 Medium (P2) — Nice to Have

1. Create `UserProfile` model with full persona/weights
2. Add `PrivacyMeta` model and endpoint
3. Implement offer realtime SSE
4. Add proper JWT authentication (Supabase Auth integration)
5. **Orchestrator LLM (done 2026-03-15):** Orchestrator-only model/API/base_url override is implemented; see `backend_llm_integration_analysis.md` for details and Featherless/QwQ-32B trial notes.

### 9.4 Low (P3) — Future

1. Provider dashboard APIs
2. Multi-source data validation
3. A/B testing infrastructure

---

## 10. File Structure Summary

```
backend/app/
├── api/                          # Controllers
│   ├── requests.py               ✓ Wired
│   ├── places.py                 ✓ Wired
│   ├── users.py                  ✓ Wired
│   ├── providers.py              ⚠ NOT wired
│   ├── offers.py                 ⚠ NOT wired
│   └── location.py               ✓ Wired
│
├── agents/                       # LangGraph Pipeline
│   ├── graph.py                  ✓ Complete
│   ├── intent_parser.py          ✓ Complete
│   ├── crawling_search.py        ✓ Complete
│   ├── transit_calculator.py     ✓ Complete
│   ├── retrieval.py              ⚠ Seed fallback only
│   ├── state.py                  ✓ TypedDict
│   └── trace.py                  ✓ Helper functions
│
├── services/
│   ├── orchestrator_service.py   ✓ Pipeline runner
│   ├── request_service.py        ✓ Request CRUD
│   ├── place_service.py          ✓ Place detail/reviews
│   ├── profile_service.py        ✓ User preferences
│   ├── auth_service.py           ⚠ Missing provider auth
│   ├── location_service.py       ✓ Device location
│   ├── marketplace_memory.py     ✓ In-memory storage
│   ├── trace.py                  ✓ Trace storage
│   ├── ranking.py                ✓ Score calculation
│   ├── ranking_todo.py           ✗ REDUNDANT - delete
│   ├── explanation.py            ✓ Reason generation
│   ├── explaination_todo.py      ✗ REDUNDANT - delete
│   ├── reviews.py                ✓ LLM summarization (simple path)
│   ├── review_router.py          ✓ Routes simple/advanced/fallback (integrated in graph)
│   ├── swiss_transit.py          ✓ Transit API
│   ├── apify_search.py           ✓ Apify client
│   ├── geo.py                    ✓ Haversine
│   └── review_analysis/          ✓ Integrated via review_router (advanced/fallback modes)
│       ├── service.py
│       ├── schemas.py
│       ├── apify_client.py
│       ├── filtering.py
│       └── summarizer.py
│
├── realtime/
│   └── events.py                 ✗ NotImplementedError
│
├── models/
│   ├── schemas.py                ✓ Pydantic models
│   └── db.py                     ✓ Supabase client
│
├── main.py                       ⚠ Missing providers/offers wiring
├── wiring.py                     ⚠ Missing wire_providers_controller, wire_offers_controller
└── config.py                     ✓ Environment config; includes REVIEW_MODE, ORCHESTRATOR_MODEL/API_KEY/BASE_URL
```

---

## 11. Conclusion

The backend has **~70% functional coverage** of the documented API. The core recommendation pipeline works correctly, but several API endpoints are non-functional due to missing service wiring. The highest-priority fixes are:

1. Wire `provider_service` and `offer_service`
2. Implement `get_current_provider_id()`
3. Clean up redundant `*_todo.py` files
4. Implement SSE streaming (if demo requires it)

The architecture is sound and follows good separation of concerns. Most gaps are configuration/wiring issues rather than missing code.
