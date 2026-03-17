# README Preparation (Implementation-Based)

Prepared on: 2026-03-17

Scope rule used: only repository-implemented behavior is described. If unclear, it is marked as uncertain.

## Project summary

- IntelligentLocalBid is currently a FastAPI + LangGraph recommendation backend plus a React frontend.
- Core implemented backend capability: take a user query and location, run a multi-stage pipeline (intent parsing, place retrieval, transit filtering, ranking, review summarization, recommendation synthesis), and return ranked place recommendations.
- Frontend currently mixes real backend integration (chat/recommendation flow) with substantial local demo data and fallback behavior.

## What is implemented

### Implemented in backend

- API app and wiring
  - FastAPI app with routers: `requests`, `offers`, `providers`, `users`, `places`, `location`.
  - Startup dependency wiring in `backend/app/main.py` and `backend/app/wiring.py`.
- Recommendation pipeline (LangGraph)
  - Graph wiring and execution in `backend/app/agents/graph.py`.
  - Implemented stages:
    - `intent_parser` (`backend/app/agents/intent_parser.py`): LLM parses query into structured request.
    - `crawling_search` (`backend/app/agents/crawling_search.py`): Apify Google Maps search + transform + opening-hours filter.
    - `retrieval` fallback (`backend/app/agents/retrieval.py`): seed JSON fallback if Apify token missing.
    - `transit_calculator` (`backend/app/agents/transit_calculator.py`): SBB/OpenData ETA + reachability filtering.
    - `evaluation_agent` (`backend/app/services/ranking.py`): weighted scoring/ranking.
    - `review_agent` via router (`backend/app/services/review_router.py`): simple/advanced/fallback review summarization.
    - `orchestrator_agent` and `synthesis_agent` (`backend/app/agents/graph.py` + synthesis helpers): LLM-generated one-line per-place rec + overall agent reply.
    - `output_ranking` (`backend/app/agents/graph.py` + `backend/app/services/explanation.py`): final result formatting + reason tags.
- Requests workflow
  - `POST /api/requests/` supports non-stream and stream mode in `backend/app/api/requests.py`.
  - Stream mode currently implemented as POST response SSE (`text/event-stream`) using `stream_pipeline(...)`.
  - Trace retrieval endpoint `GET /api/requests/{id}/trace` is implemented.
- Place detail workflow
  - `GET /api/places/{place_id}` and `GET /api/places/{place_id}/reviews` implemented in `backend/app/api/places.py` with `backend/app/services/place_service.py` cache + Apify fallback.
- User preferences and location
  - `GET /api/users/me` and `PUT /api/users/me/preferences` implemented in `backend/app/api/users.py`.
  - Device location endpoints `PUT/GET /api/location/current` in `backend/app/api/location.py`.
- Storage behavior
  - Optional Supabase persistence (`backend/app/services/marketplace.py`, `backend/app/models/db.py`).
  - In-memory fallback (`backend/app/services/marketplace_memory.py`, in-memory profile service).

### Implemented only in frontend demo

- Home/Explore maps and many place cards are driven by local seed-derived frontend data, not live backend query:
  - `frontend/src/data/providers.ts` (+ local `zurich_providers.json` in frontend data folder).
  - Index and Explore pages import this directly (`frontend/src/pages/Index.tsx`, `frontend/src/pages/Explore.tsx`).
- Chat/recommendation UI has backend integration but also mock fallback:
  - `frontend/src/hooks/useSearchStream.ts` falls back to hardcoded `MOCK_PLACES` when backend request/stream fails.
- Place detail page has backend fetch but local fallback layers:
  - `frontend/src/pages/PlaceDetail.tsx` tries API, then `getPlaceDetailFromProvider(...)`, then hardcoded `MOCK_DETAILS`.
- Merchant and auth flows are local mock UX:
  - `frontend/src/contexts/AuthContext.tsx` uses localStorage mock user.
  - Merchant dashboard/settings/login features are mock data/UI (`frontend/src/pages/MerchantDashboard.tsx`, related pages/components).
- Queue status, notifications, featured deals are demo/local state behavior in frontend hooks/components and data providers.
- Privacy page uses fallback metadata if backend endpoint missing (`frontend/src/services/privacy.ts`, `frontend/src/pages/Privacy.tsx`).

## What is planned

- Explicit placeholders/TODOs in code:
  - `PATCH /api/offers/{id}` returns 501 Not Implemented (`backend/app/api/offers.py`).
  - Realtime event module has TODO comments (`backend/app/realtime/events.py`).
  - Retrieval module header still describes future Supabase query plan (`backend/app/agents/retrieval.py`).
  - Synthesis context notes mention future token-budget-aware selection (`backend/app/services/synthesis_context.py`).
- Partially scaffolded but not wired services:
  - Providers/offers controllers depend on `provider_service`/`offer_service`, but startup wiring currently does not inject these (uncertain if intentionally deferred).

## Architecture summary

- High-level implemented architecture:
  - Frontend (React/Vite) issues request to backend `/api/requests/`.
  - Backend executes LangGraph pipeline and returns ranked place recommendations.
  - Optional SSE progress events over the same POST response when `stream=true`.
  - Place detail API reads from pipeline-cached places; falls back to on-demand Apify fetch when uncached.
  - Persistence mode:
    - Supabase if configured.
    - In-memory fallback if not configured.

## Workflow summary

### Main user flow (implemented path)

- User submits natural-language query + location.
- Backend creates request record and runs pipeline.
- Pipeline returns top ranked places with score, reason tags, one-sentence recommendation, and optional review summary text.
- Frontend displays live pipeline progress (if stream mode) and recommendation cards.
- User can open place detail page; frontend calls `/api/places/{id}` and renders details/reviews.

### Multi-agent / multi-stage workflow

- Implemented graph order (`backend/app/agents/graph.py`):
  - `intent_parser` -> `crawling_search`/`retrieval` -> `transit_calculator`
  - then parallel fan-out: `evaluation_agent` + `review_agent`
  - then merge: `orchestrator_agent` -> `output_ranking` -> `synthesis_agent`
- Retry behavior:
  - If no candidates after transit and retry count < 2, graph retries crawling with wider radius.

### Data flow from query to recommendation

- `POST /api/requests/` payload enters `RequestService.create_request(...)`.
- `OrchestratorService.run_recommendation_pipeline(...)` loads request and invokes graph.
- Graph state evolves through:
  - `structured_request`
  - `candidate_providers`
  - `ranked_offers`
  - `review_summaries`
  - `final_results`
  - `agent_reply`
- Response includes:
  - `request`
  - `results` (top places)
  - `agent_reply` (summary text)

### Ranking / explanation / personalization logic

- Ranking (`backend/app/services/ranking.py`):
  - Score dimensions: price, travel, rating.
  - Uses normalized weighted sum with user preference weights.
  - Travel signal uses commute time or distance per config.
- Explanations (`backend/app/services/explanation.py`):
  - Deterministic reason tags from score breakdown + available facts.
  - Includes preference-priority reason when applicable.
- Personalization:
  - User weight preferences passed from request payload into pipeline.
  - Orchestrator/synthesis prompts incorporate request constraints and ranked context.

## Tech stack

- Backend
  - Python, FastAPI, Pydantic, LangGraph, OpenAI client, Apify client, httpx, Supabase client.
- Frontend
  - React + TypeScript + Vite, React Router, React Query, Tailwind, shadcn/radix UI, Framer Motion, Leaflet.
- External integrations
  - OpenAI-compatible LLM endpoint(s) for intent parsing, per-place recommendation text, synthesis, and review summarization.
  - Apify Google Maps actor for place and review data.
  - SBB/transport.opendata.ch for transit ETA.
  - Supabase for optional persistence.

## Repo structure

- `backend/`
  - `app/agents/`: graph + stage nodes.
  - `app/services/`: ranking, reviews, transit, orchestration, storage services.
  - `app/api/`: FastAPI controllers.
  - `tests/`: backend tests.
  - `seed/`: Zurich provider seed data.
- `frontend/`
  - `src/pages/`: page-level UI.
  - `src/services/`: API clients.
  - `src/hooks/`: stream/location/preferences hooks.
  - `src/data/`: frontend-local provider/demo datasets.
- `doc/`
  - Architecture and contract documents.
- `supabase/`
  - local config/migrations.

## Commands to run

### Backend (supported by repo docs/code)

- Setup and run:
  - `cd backend`
  - `python -m venv venv`
  - Windows: `venv\Scripts\activate`
  - `pip install -r requirements.txt`
  - `uvicorn app.main:app --reload`
- Test:
  - `pytest tests/`

### Frontend

- Setup and run:
  - `cd frontend`
  - `npm i`
  - `npm run dev`
- Additional scripts:
  - `npm run build`
  - `npm run lint`
  - `npm run test`

## Missing information for final README

- Confirmed production scope vs demo scope:
  - Which frontend pages are intended MVP product surface vs hackathon/demo-only views.
- Backend endpoint maturity table (needed for README accuracy):
  - `offers` and `providers` routes are present, but service wiring appears incomplete; readiness should be explicitly declared.
- Environment matrix:
  - Which env vars are mandatory for "minimal local run" vs "full real-data run".
- Streaming contract clarification:
  - Implemented stream path is `POST /api/requests/?stream=true` (SSE response body).
  - Frontend service file also defines EventSource GET stream helpers (`/api/requests/{id}/stream`, `/api/requests/{id}/offers/stream`) that are not currently implemented in backend controllers.
- Schema naming consistency (uncertain):
  - `UserPreferences` uses `weight_travel`, while some profile service code references `weight_distance`; confirm intended canonical field names.
- Dataset ownership/source note:
  - Clarify provenance and refresh process for seed/provider JSONs used by backend and frontend.

## Uncertain items (explicit)

- `review_agent` in `graph.py` has stale comments saying "stub", but code actually calls `review_router`; comment and implementation diverge.
- Providers/offers controller endpoints may be intentionally scaffolded for upcoming work, but current runtime readiness appears partial due to missing service wiring.
