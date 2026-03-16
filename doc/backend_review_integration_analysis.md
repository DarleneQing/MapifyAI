# Backend Review Integration Analysis (Google Reviews / Summarization)

Date: 2026-03-15
Scope: inspect-only analysis of current backend codebase (no code changes)

## Implementation progress

### 2026-03-15: Router layer added

- New file created: backend/app/services/review_router.py
- Public entrypoint added:
   - route_review_summaries(providers: list[dict], review_mode: str = "simple") -> list[dict]
- Supported modes:
   - simple
   - advanced
   - fallback
- Current router behavior:
   - simple: calls app.services.reviews.summarise_providers(providers)
   - advanced: processes providers one by one via app.services.review_analysis.service.analyze_and_summarize_reviews(place_url=provider["google_maps_url"])
   - fallback: tries advanced per provider, then falls back to simple for that provider
- Normalized router output schema:
   - {"place_id": str, "advantages": list[str], "disadvantages": list[str]}
- Note:
   - This was the state immediately after router creation, before graph integration.

### 2026-03-15: Graph integration updated

- Updated file: backend/app/agents/state.py
   - PlannerState now includes optional review_mode
- Updated file: backend/app/agents/graph.py
   - _build_initial_state(..., review_mode: str | None = None)
   - run_pipeline(..., review_mode: str | None = None)
   - stream_pipeline(..., review_mode: str | None = None)
   - _review_node(...) now:
      - reads state.get("review_mode")
      - falls back to config REVIEW_MODE or "simple"
      - calls app.services.review_router.route_review_summaries(...)
- Graph topology unchanged
- Orchestrator expectations unchanged
- Default behavior preserved when no review_mode is provided:
   - router falls back to simple mode

   ### 2026-03-15: Config default added

   - Updated file: backend/app/config.py
      - Added REVIEW_MODE = os.getenv("REVIEW_MODE", "")
   - Effective priority order is now:
      1. explicit runtime override from graph state: state["review_mode"]
      2. config/env default: REVIEW_MODE
      3. hard default: "simple"
   - Backward compatibility preserved:
      - if REVIEW_MODE is unset and no runtime override is passed, behavior remains simple mode

   ### 2026-03-15: Focused router tests added

   - New test file: backend/tests/test_review_router.py
   - Covered behaviors:
      - simple mode uses existing Daisy/simple path and returns normalized schema
      - advanced mode maps review_analysis output to {place_id, advantages, disadvantages}
      - fallback mode survives advanced failure and still returns valid normalized summaries
      - place_id remains aligned with provider id for orchestrator join assumptions
   - Verification status:
      - pytest on backend/tests/test_review_router.py passed locally in workspace environment
      - result: 4 passed

   ### 2026-03-15: Focused graph-side review-node tests added

   - New test file: backend/tests/test_graph_review_node.py
   - Covered behaviors:
      - _review_node(...) defaults to simple mode when review_mode is absent from state
      - _review_node(...) passes review_mode="advanced" through to the router
      - _review_node(...) preserves graph contract shape: {"review_summaries": [...]} 
      - review mode precedence is locked down:
         - state override beats config default
         - config default is used when state override is absent
         - hard default "simple" is used when both are absent
   - Test strategy:
      - imports and tests app.agents.graph._review_node directly
      - mocks app.services.review_router.route_review_summaries
      - stubs langgraph.graph in the test file so the unit test does not require the real langgraph package at import time
   - Verification status:
      - pytest on backend/tests/test_graph_review_node.py passed locally in workspace environment
      - result: 4 passed

   ### 2026-03-15: Real-dependency graph smoke test added

   - New test file: backend/tests/test_graph_import_smoke.py
   - Purpose:
      - very thin smoke guard for real langgraph import/graph-construction behavior
      - catches import-time regressions without running full recommendation flow
   - Test behavior:
      - skips cleanly when langgraph is not installed (pytest.importorskip)
      - when langgraph is installed:
         - imports app.agents.graph
         - verifies pipeline exists
         - verifies _build_initial_state(...) accepts review_mode and returns expected state keys
   - Verification status:
      - pytest on backend/tests/test_graph_import_smoke.py passed locally
      - result: 1 passed

   ### 2026-03-15: langgraph dependency status

   - langgraph is now importable in the active Python environment.
   - Because conda base env is not writable, installation used a user-level pip fallback.

## 1. Main pipeline integration path

### 1.1 API and service entrypoints that call pipeline

1. Non-stream request path:
   - API endpoint: backend/app/api/requests.py, create_request(...)
   - Service call: orchestrator_service.run_recommendation_pipeline(request_id)
   - Orchestrator call into graph: backend/app/services/orchestrator_service.py imports and calls run_pipeline(...)

2. SSE stream path:
   - API endpoint: backend/app/api/requests.py, `_sse_response(...)`
   - Direct graph streaming call inside worker thread: `stream_pipeline(...)`
   - For the **parallel** stage (`evaluation_agent` + `review_agent`):
     - both agents emit `"starting"` progress events when they begin, and
     - both emit `"done"` progress events once completed (the stream now iterates all nodes in each LangGraph chunk instead of only the first key).
   - This ensures the frontend can show **Scoring & Ranking** and **Analyzing Reviews** with correct durations, and in advanced Apify mode the UI remains on **Analyzing Reviews** while the Google‑Reviews scraper is still running.

### 1.2 Graph orchestration entry

- Main orchestration module: backend/app/agents/graph.py
- Graph construction:
  - build_graph() -> StateGraph(PlannerState)
  - pipeline = build_graph()
- Public execution entrypoints in same file:
  - run_pipeline(raw_input, location, preferences=None)
  - stream_pipeline(raw_input, location, preferences=None)

### 1.3 Where _review_node(...) is invoked

- In graph wiring (backend/app/agents/graph.py):
  - Node registration: graph.add_node("review_agent", _review_node)
  - Conditional fan-out after transit_calculator:
    - _after_transit(...) returns ["evaluation_agent", "review_agent"] when candidates exist
  - Convergence:
    - graph.add_edge("review_agent", "orchestrator_agent")

Execution semantics:
- review_agent and evaluation_agent run in parallel branches.
- LangGraph merges their partial writes before orchestrator_agent runs.

### 1.4 Is graph.py the correct/minimal integration point?

Yes.

Reasoning:
- It is the only central place where review processing is currently chosen and invoked (_review_node).
- Both run_pipeline and stream_pipeline use the same compiled graph, so changing _review_node behavior affects both paths consistently.
- Orchestrator and API layers already consume state output generically; they do not directly choose review implementation.

Conclusion:
- backend/app/agents/graph.py is the correct minimal integration point for a configurable review-mode selector.

---

## 2. Current Daisy/simple review implementation (currently wired)

### 2.1 Files and main functions

- backend/app/agents/graph.py
  - _review_node(state: PlannerState) -> dict
- backend/app/services/reviews.py
  - summarise_providers(providers: list[dict]) -> list[dict]
  - _empty_summaries(providers: list[dict]) -> list[dict]

### 2.2 Effective signature and expected input

- _review_node input:
  - state["candidate_providers"] (list of provider dicts)
- summarise_providers input:
  - list[dict] providers
  - uses these provider fields when present:
    - id
    - name
    - rating
    - review_count
    - price_range
    - distance_km
    - category
    - reviews (optional list of review objects; expects review text under reviews[i]["text"])

So this implementation expects provider objects, not raw dataset IDs.

### 2.3 Crawling vs summarization behavior

- It does not crawl by itself.
- It only summarizes already available provider-level data.
- If provider.reviews exists, it includes up to 10 review texts in prompt.
- If reviews are absent, it generates plausible pros/cons from metadata (rating/price/etc).

### 2.4 Output structure

Returns list of dicts:
- place_id: string (mapped from provider id)
- advantages: list[string]
- disadvantages: list[string]

Fallback behavior:
- If no providers or no OPENAI_API_KEY or exception, returns empty summaries per provider:
  - {"place_id": id, "advantages": [], "disadvantages": []}

### 2.5 Keys relied on later

In backend/app/agents/graph.py orchestrator node:
- Builds review map as {r["place_id"]: r for r in state.get("review_summaries", [])}
- For each ranked place p, uses review_map[p.get("id", "")] and reads:
  - advantages
  - disadvantages

Therefore required compatibility keys are:
- place_id
- advantages
- disadvantages

### 2.6 Sync vs async

- Fully synchronous/blocking (OpenAI SDK call is sync).

### 2.7 Hidden assumptions

1. Provider id must match ranked offer id:
   - review_map uses place_id, lookup key is ranked offer id.
2. Provider reviews, if present, use text field:
   - r.get("text") is used; no fallback to textTranslated here.
3. Provider list is already the candidate set:
   - no internal filtering by open status, category, etc.

---

## 3. Current advanced review implementation (not wired into graph)

### 3.1 Files and entrypoints

Advanced module namespace: backend/app/services/review_analysis/

Primary entrypoint:
- service.py
  - analyze_and_summarize_reviews(
      dataset_id: Optional[str]=None,
      place_url: Optional[str]=None,
      top_k_positive: int=30,
      top_k_negative: int=30,
      skip_empty_text_for_summarization: bool=True,
      max_reviews: int=100,
      reviews_start_date: str="1 year",
      language: str="en",
      personal_data: bool=False,
      debug_include_selected_reviews: bool=False,
    ) -> dict[str, Any]

Supporting pipeline functions:
- apify_client.py
  - run_google_maps_reviews_scraper(place_url, ...) -> str dataset_id
  - load_reviews_from_dataset(dataset_id, provider_id=None, limit=None) -> list[ReviewItem]
- filtering.py
  - analyze_reviews(ReviewAnalysisRequest) -> ReviewAnalysisResult
- summarizer.py
  - summarize_reviews(positive_reviews, negative_reviews, model=..., provider_label="") -> ReviewSummary
  - build_orchestrator_summary_payload(summary: ReviewSummary) -> dict

### 3.2 What it includes

It includes all of these stages:
- crawling (optional, when place_url mode)
- dataset loading and mapping
- dedup/filter/sort/top-k selection
- LLM summarization
- payload shaping for downstream orchestrator-style use

### 3.3 Inputs expected

High-level entry requires exactly one of:
- dataset_id
- place_url

Notable expected payloads:
- place_url must be a Google Maps place URL consumable by Apify actor.
- dataset mode expects an existing Apify dataset ID.
- underlying review items carry stars/date/text.

### 3.4 Output format

analyze_and_summarize_reviews returns dict with keys:
- dataset_id
- orchestrator_payload
  - strengths
  - weaknesses
  - positive_aspects
  - negative_aspects
  - summary
  - confidence
  - avg_rating_recent
  - rating_distribution
  - text_review_count
  - empty_text_review_count
  - selected_positive_review_count
  - selected_negative_review_count
- summary_result (full ReviewSummary)
- review_stats
- debug

Important: this schema is not the same as current graph review_summaries schema.

### 3.5 Single-place vs batch

- Designed as single-place per call (one dataset_id or one place_url).
- Batch behavior would require looping externally over candidate providers.

### 3.6 Sync vs async

- Fully synchronous/blocking.

### 3.7 Can it be adapted for _review_node?

Yes, reasonably.

But adaptation is required because:
- Current _review_node receives list of providers, not one place_url/dataset.
- Current orchestrator expects place_id + advantages/disadvantages lists.

A wrapper can:
- loop candidates
- call analyze_and_summarize_reviews(place_url=provider.google_maps_url)
- map advanced output to expected review_summaries schema.

---

## 4. PlannerState and state flow

### 4.1 PlannerState definition location

- backend/app/agents/state.py

### 4.2 Current keys in PlannerState

- raw_input
- location
- preferences
- structured_request
- candidate_providers
- retry_count
- ranked_offers
- review_summaries
- final_results
- trace
- error

Initial values are built in backend/app/agents/graph.py _build_initial_state(...).

### 4.3 Current review_summaries type and expected structure

Typed as list[dict] in PlannerState.

Effective expected shape (from orchestrator usage):
- each item should contain:
  - place_id
  - advantages (list)
  - disadvantages (list)

### 4.4 Is adding review_mode safe?

Yes, with caveat:
- Runtime dict flow is flexible; adding state key is straightforward.
- For type consistency, PlannerState in state.py should include review_mode (or allow optional typed key) if implemented.

### 4.5 Downstream assumptions on review_summaries schema

Strong assumption in orchestrator node:
- key place_id exists for map join with ranked offer id
- keys advantages/disadvantages exist (or default empty list via get)

No downstream code currently consumes strengths/weaknesses/summary directly from state["review_summaries"].

---

## 5. Provider/candidate structure needed for reviews

### 5.1 Where schemas are defined

Core provider model:
- backend/app/models/schemas.py class Provider

Actual runtime candidate construction:
- Seed path: backend/app/agents/retrieval.py (loads backend/seed/zurich_providers.json)
- Apify path: backend/app/agents/crawling_search.py transform_apify_result(...)

### 5.2 Shape of items in state["candidate_providers"]

Common fields used across pipeline:
- id
- name
- category
- location {lat, lng}
- address
- rating
- review_count
- price_range
- opening_hours
- distance_km

Additional fields in crawling path:
- website_url
- google_maps_url
- reviews
- social_profiles
- review_distribution
- popular_times
- questions_and_answers
- customer_updates
- detailed_characteristics
- average_rating
- transit_info (added later by transit_calculator)
- reachability_status (added later by transit_calculator)

### 5.3 Fields available for advanced pipeline support

Available now in many candidates:
- id (yes)
- name (yes)
- google_maps_url (yes in crawling transform; also in seed fixture)
- reviews (yes in crawling transform; seed also has reviews but shape differs)

Not available by default in state:
- dataset_id per provider (no)
- explicit place_url key (no, but google_maps_url can act as place_url)

### 5.4 Does graph state currently have enough info for advanced direct run?

Partially.

For place_url mode:
- Usually yes if google_maps_url exists and is valid Google Maps URL.

Potential gaps:
1. Some providers may have missing/empty google_maps_url.
2. Retrieval seed reviews use rating field, not stars/date required by advanced typed ReviewItem ingestion path.
3. Advanced service expects one place_url per call; _review_node currently batch-processes provider list at once.

---

## 6. Output compatibility analysis

### 6.1 Side-by-side input signatures

| Implementation | Main function | Input shape | Mode |
|---|---|---|---|
| Simple (wired) | app.services.reviews.summarise_providers(providers) | list of provider dicts | batch |
| Advanced (not wired) | app.services.review_analysis.service.analyze_and_summarize_reviews(...) | exactly one of dataset_id or place_url | single place per call |

### 6.2 Side-by-side output schemas

| Implementation | Returned structure | Directly compatible with orchestrator in graph.py? |
|---|---|---|
| Simple | list[{place_id, advantages, disadvantages}] | Yes |
| Advanced | dict with dataset_id, orchestrator_payload{strengths/weaknesses/...}, summary_result, review_stats, debug | No (needs mapping + list wrapper + place_id attachment) |

### 6.3 Minimal common normalized schema for _review_node

For current orchestrator compatibility, _review_node should output:
- review_summaries: list of entries shaped as:
  - place_id: string (must match ranked offer id)
  - advantages: list[string]
  - disadvantages: list[string]

Optional extra keys can be included without breaking current orchestrator (it ignores them).

### 6.4 Required review_summaries format for orchestrator_agent continuity

Must preserve this join contract:
- review_summary.place_id == ranked_offer.id

Must preserve key names currently read by orchestrator:
- advantages
- disadvantages

If these keys remain, orchestrator_agent in graph.py can continue working without major changes.

---

## 7. Minimal-change integration options

### Option A: selector directly inside _review_node(...) in graph.py

Description:
- In _review_node, branch by config/state flag and call simple or advanced path inline.

Estimated changes:
- 1 file minimum (backend/app/agents/graph.py), likely 2-3 if config added.

Risk to Daisy path:
- Medium: graph.py becomes more complex; easy to accidentally affect parallel write behavior or fallback behavior.

Maintainability:
- Lower than Option B (business logic mixed in graph node).

Suitability now:
- Fastest short-term patch, but not cleanest.

### Option B: add small review_router/review_service wrapper called by _review_node

Description:
- Keep _review_node thin.
- Add router function in service layer that accepts provider list + review_mode and returns normalized list[{place_id, advantages, disadvantages}].

Estimated changes:
- 2-4 files:
  - new service router
  - graph.py call site
  - config/state typing
  - tests

Risk to Daisy path:
- Low: default route can remain simple path exactly as today.

Maintainability:
- Best among minimal changes: graph orchestration separated from review implementation specifics.

Suitability now:
- Very suitable; still minimal but cleaner and safer for future iterations.

### Option C: graph-level dependency injection of review function (build-time)

Description:
- Parameterize build_graph with review callable injected at startup.

Estimated changes:
- Medium-high: graph builder, app wiring, possible lifecycle updates.

Risk to Daisy path:
- Medium (larger surface area and startup wiring changes).

Maintainability:
- Good long-term, but too heavy for quick switch rollout.

Suitability now:
- Less suitable for immediate implementation.

### Recommendation

Recommend Option B (small review router/wrapper service).

Why:
- Preserves current graph topology and state contracts.
- Minimizes break risk for currently working Daisy pipeline.
- Makes advanced/simple switching and fallback behavior explicit and testable.

---

## 8. Proposed next implementation plan (no code changes yet)

### 8.1 Likely files to change

1. backend/app/agents/graph.py
   - keep _review_node thin, delegate to router
2. backend/app/agents/state.py
   - add optional review_mode key (if state-based override is needed)
3. backend/app/config.py
   - add default review mode config (for env/runtime default)
4. New file, likely backend/app/services/review_router.py
   - normalize outputs from simple/advanced to list[{place_id, advantages, disadvantages}]
5. tests (new or updated):
   - backend/tests/test_agents.py or a new backend/tests/test_review_router.py
   - add graph-level mode/fallback tests

### 8.2 Likely new fields

- review_mode: one of simple, advanced
- optional: review_fallback_mode = simple (or implicit fallback behavior)

Possible placement:
- config default from environment
- optional runtime override from request preferences or structured constraints

### 8.3 Config/runtime override approach

Suggested priority order:
1. Explicit runtime override in state (if provided)
2. Config default from env (e.g. REVIEW_MODE)
3. Hard default = simple

### 8.4 Fallback behavior

Recommended:
- In advanced mode, on per-provider failure (missing URL, actor failure, summarizer failure), fallback to simple summary for that provider or return empty summary entry.
- Global fallback to simple mode on systemic failure is also reasonable and safer for production continuity.

### 8.5 Implementation order

1. Introduce router with normalized output contract.
2. Switch _review_node to call router.
3. Add mode selection (config + optional state override).
4. Add fallback logic advanced -> simple.
5. Add tests for mode selection and compatibility.

### 8.6 Tests to add

1. Contract test: _review_node output always list of {place_id, advantages, disadvantages}.
2. Mode test: simple mode calls existing summarise_providers path unchanged.
3. Advanced mode test: maps advanced output to normalized schema.
4. Fallback test: advanced failure falls back to simple without crashing graph.
5. Orchestrator compatibility test: review_summaries join still works with ranked_offers ids.

---

## 9. Open questions / missing info

1. Source of runtime override:
   - Should review_mode come from env only, request preferences, or both?

2. Per-provider advanced call policy:
   - Is it acceptable latency-wise to run Apify review scraping during request pipeline for multiple candidates?

3. Advanced output mapping policy:
   - Should strengths map directly to advantages and weaknesses to disadvantages, or should additional transformation rules be used?

4. Failure policy granularity:
   - fallback per provider vs fallback whole request when one provider fails?

5. URL quality guarantees:
   - Are google_maps_url values guaranteed valid for all candidate providers in production data?

6. Cost/timeout budget:
   - What timeout and cost limits are acceptable for advanced mode in synchronous request handling?

7. Language behavior:
   - Advanced summarizer outputs English by prompt; should this be aligned with user language preference in existing request payload?

8. Concurrency strategy for advanced batch adaptation:
   - Keep sequential (simpler, safer) or introduce controlled parallelism later?

---

## Data flow summary (definitions + real call sites)

1. POST /api/requests -> request_service.create_request -> orchestrator_service.run_recommendation_pipeline.
2. Orchestrator calls run_pipeline from app.agents.graph.
3. Graph executes nodes:
   - intent_parser
   - crawling_search (or retrieval fallback)
   - transit_calculator
   - parallel: evaluation_agent + review_agent
   - orchestrator_agent
   - output_ranking
4. review_agent invokes _review_node -> app.services.reviews.summarise_providers (simple path today).
5. orchestrator_agent consumes state["review_summaries"] via place_id join and reads advantages/disadvantages.
6. final output is assembled in output_ranking as state["final_results"], returned by orchestrator service.

Advanced review_analysis pipeline currently exists and is validated through tests/scripts, but is not called by runtime API/orchestrator/graph paths.
