## Qing Dai – Backend-1 Agent Pipeline Summary

### Scope of Contributions

- **Agent pipeline orchestration (`app/agents/graph.py`)**: Implements a LangGraph `StateGraph` over `PlannerState` with nodes `intent_parser → retrieval → feasibility → ranking → explanation → END`. Adds a compiled `pipeline` graph plus a `run_pipeline(raw_input, location, preferences)` entry point that the rest of the backend can call.
- **Intent parsing agent (`app/agents/intent_parser.py`)**: Replaces the stub with a real OpenAI-powered intent parser that turns free-text queries into a `structured_request` dict (category, requested time, radius, constraints, location, status, timestamps).
- **Retrieval agent (`app/agents/retrieval.py`)**: Loads providers from the local seed file `backend/seed/zurich_providers.json`, filters by category and radius using `haversine_km`, and writes `candidate_providers` plus a trace step.
- **Feasibility agent (`app/agents/feasibility.py`)**: Implements time-window and travel-time checks based on opening hours and ETA, annotates providers with a human-readable `time_label`, and increments `retry_count` when nothing is feasible.
- **Planner state typing (`app/agents/state.py`)**: Extends `PlannerState` with `retry_count` and clarifies how agent outputs (structured request, candidates, feasible providers, ranked offers, trace, error) are threaded through the graph.
- **Dynamic retry loop in graph**: Adds `after_feasibility` and a conditional edge so that when `feasible_providers` is empty and `retry_count < 2`, the graph loops back to `retrieval` with an expanded radius.
- **Scoring and explanation inside the graph**: Implements an in-graph ranking node that normalises price, distance, and rating to \[0,1\], combines them with user preference weights, attaches `score`, `score_breakdown`, and human-readable `reasons` to each provider, and sorts them descending.
- **README and workflow diagram (`README.md`, `agent_workflow.png`)**: Documents the end-to-end agent pipeline (roles of each node, retry behaviour, tech stack) and provides a visual diagram of the graph.

### How the Agent Pipeline Works End-to-End

- **Input state**: `run_pipeline()` is called with:
  - **`raw_input: str`** – the user’s free-text request, e.g. `"Need a haircut near Zurich HB in 2 hours"`.
  - **`location: dict`** – `{"lat": float, "lng": float}` from the frontend.
  - **`preferences: dict | None`** – optional weights, typically shaped like `{"weight_price": 0.6, "weight_travel": 0.2, "weight_rating": 0.2}`.
  - The graph initialises `retry_count = 0`, empty provider lists, a pending `trace` via `make_trace()`, and `error = None`.
- **Intent parser**:
  - Builds a system prompt (`SYSTEM_PROMPT`) with today’s date, current time, and user location.
  - Calls OpenAI Chat Completions (`DEFAULT_MODEL = "gpt-4o"`) with `response_format={"type": "json_object"}` so that the model must return JSON.
  - Parses the response into a Python dict and fills a `structured_request` containing:
    - `id`, `raw_input`, `category`, `requested_time` (ISO string, with a default of now+1h if missing), `location`, `radius_km`, `constraints`, `status="open"`, and `created_at`.
  - Logs an intent-parser step into `trace`.
- **Retrieval**:
  - Reads providers from `backend/seed/zurich_providers.json`.
  - Filters by `category` (unless `"general"`) and uses `haversine_km` to compute distance from the user’s location to each provider.
  - Applies `radius_km`; if `retry_count > 0`, widens the search radius by 50% per retry (`radius *= 1 + 0.5 * retry`).
  - Populates `candidate_providers` with those within the (possibly widened) radius, adding `distance_km` to each provider.
  - Sorts candidates by distance ascending and logs a retrieval step to `trace`.
- **Feasibility**:
  - For each candidate, looks up the appropriate day in `opening_hours` (keys like `"mon"`, `"tue"`, …; values `"HH:MM-HH:MM"` or `null`).
  - Parses the opening interval, computes ETA with `eta_minutes(distance_km, TRAVEL_SPEED_KMH)`, and checks:
    - Provider is open on that day.
    - Arrival is before closing.
    - There is at least `MIN_OPEN_BUFFER_MINUTES` of time left after arrival.
  - Adds a user-facing `time_label` such as `"~8 min away"` or `"closing soon — only 10 min after arrival"`.
  - Writes passing providers into `feasible_providers`, increments `retry_count` when none pass, and logs a feasibility step.
- **Ranking + explanation**:
  - Computes a price midpoint for each provider’s `price_range` (e.g. `"CHF 35–55"` → 45).
  - Normalises price (inverted), distance (inverted), and rating into \[0,1\], then combines them with user preference weights.
  - Attaches `score`, `score_breakdown`, and top-3 `reasons` (e.g. `"Affordable pricing"`, `"Close by"`, `"Highly rated"`, plus optional `time_label`) to each provider.
  - Sorts providers by `score` descending and stores the result in `ranked_offers`.
- **Retry loop**:
  - After `feasibility`, the graph uses `after_feasibility()`:
    - If there are no feasible providers and `retry_count < 2`, transitions to `"retrieval"` (widen radius and try again).
    - Otherwise transitions to `"ranking"`.
  - This creates a bounded feedback loop that widens the search gradually rather than failing immediately.

### How to Use Her Code in This Project

- **1. Configure environment and dependencies**
  - **Python environment**: Use Python 3.11+ and install backend dependencies from `backend/requirements.txt` (e.g. `pip install -r backend/requirements.txt`).
  - **Environment variables** (loaded via `backend/app/config.py` and `.env`):
    - **`OPENAI_API_KEY`**: must be set to a valid OpenAI key so that `intent_parser` can call GPT-4o.
    - **`SUPABASE_URL`**, **`SUPABASE_KEY`**, **`SUPABASE_SERVICE_ROLE_KEY`**: currently unused by `Backend-1`, but required later by `Backend-2` for real DB persistence.
    - **`DEFAULT_MODEL`**: defaults to `"gpt-4o"`; adjust if needed, but keep JSON response-format support.
- **2. Run the backend locally**
  - From the `backend/` directory, start the FastAPI app with Uvicorn, for example:
    - `uvicorn app.main:app --reload`
  - The app exposes `POST /api/requests` and related endpoints defined in `app/api/requests.py`, which will eventually delegate to an orchestrator service that uses `run_pipeline()`.
- **3. Call the LangGraph pipeline directly (for dev and testing)**
  - You can invoke the entire agent workflow from a Python shell or a small script, as described in `backend/README.md`:
    - Import and call:
      - `from app.agents.graph import run_pipeline`
      - `state = run_pipeline("I need a haircut near Zurich HB in 2 hours", {"lat": 47.378, "lng": 8.540})`
    - Inspect outputs:
      - `state["structured_request"]` → parsed intent and search parameters.
      - `state["candidate_providers"]` / `state["feasible_providers"]` → intermediate provider lists.
      - `state["ranked_offers"]` → final ranked offers with scores and reasons.
      - `state["trace"]` → structured execution trace for debugging and UI visualisation.
- **4. Wire the pipeline into the orchestrator service**
  - The controller–service contract in `doc/controller-service-contract.md` expects an `orchestrator_service.run_recommendation_pipeline(request_id: str) -> RankedOffersResponse`.
  - A typical implementation of `run_recommendation_pipeline` would:
    - Load the persisted `StructuredRequest` by `request_id` (using `marketplace.get_request` once Backend-2 is implemented).
    - Call `run_pipeline(request.raw_input, request.location, request.preferences)` from `app.agents.graph`.
    - Map the resulting `PlannerState` into a `RankedOffersResponse`-shaped dict:
      - `request` ← `state["structured_request"]`
      - `offers` ← `state["ranked_offers"]`
      - `trace` ← `state["trace"]`
    - Persist offers via `marketplace.persist_offers` and return the assembled response.
- **5. Expose results to the frontend via `POST /api/requests`**
  - The `app/api/requests.py#create_request` route already:
    - Accepts `CreateRequestPayload` (`raw_input`, `location`, `preferences`).
    - Uses `request_service.create_request` to persist a `StructuredRequest`.
    - Calls `orchestrator_service.run_recommendation_pipeline(request_id)` and returns its JSON.
  - Once the orchestrator service is wired to `run_pipeline()`, Qing’s agent graph will execute end-to-end whenever the frontend calls `POST /api/requests`.
- **6. Iterate towards real data**
  - **Today**: retrieval reads from `backend/seed/zurich_providers.json`, which is perfect for offline demos during the GenAI Zurich Hackathon.
  - **Later**: you can swap `_load_providers()` in `retrieval.py` for a real Supabase query (`providers` table) without touching callers, preserving the same `PlannerState` contract.
  - Feasibility, ranking, and explanation logic are already encapsulated in the graph, so higher layers (controllers/services/frontend) do not need to change when you move from seed data to live data.

### Where to Look When Extending or Debugging

- **Graph wiring and retry logic**: `backend/app/agents/graph.py`
- **LLM intent parsing**: `backend/app/agents/intent_parser.py`
- **Provider loading and distance filtering**: `backend/app/agents/retrieval.py`
- **Open-hours feasibility rules and `retry_count` updates**: `backend/app/agents/feasibility.py`
- **Shared state structure**: `backend/app/agents/state.py`
- **Seed provider data**: `backend/seed/zurich_providers.json`
- **High-level backend roadmap**: `backend/README.md`
- **HTTP contract and controller–service boundaries**: `doc/controller-service-contract.md`

