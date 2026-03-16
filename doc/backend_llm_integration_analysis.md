# Backend LLM Integration Analysis

Date: 2026-03-15  
Original scope: backend code inspection only (no code changes)

## Implementation status update (2026-03-15)

First-pass orchestrator-only override has now been implemented with backward compatibility:

- Added config fields in backend/app/config.py:
  - ORCHESTRATOR_MODEL
  - ORCHESTRATOR_API_KEY
  - ORCHESTRATOR_BASE_URL
- Updated backend/app/agents/graph.py::_orchestrator_node resolution order:
  - api key: ORCHESTRATOR_API_KEY or OPENAI_API_KEY
  - model: ORCHESTRATOR_MODEL or DEFAULT_MODEL
  - client: OpenAI(api_key=..., base_url=ORCHESTRATOR_BASE_URL) when base_url is set
- Kept prompt, chat.completions usage, response_format json_object, JSON parsing, and exception fallback unchanged.
- Added environment examples in backend/.env.example and usage notes in backend/README.md.
- Added focused tests in backend/tests/test_graph_orchestrator_config.py.

Validation summary:

- pytest -q tests/test_graph_orchestrator_config.py tests/test_graph_review_node.py
- Result: 7 passed

Trial default recommendation (docs/examples):

- ORCHESTRATOR_MODEL=Qwen/QwQ-32B
- ORCHESTRATOR_BASE_URL=https://api.featherless.ai/v1
- ORCHESTRATOR_API_KEY=fl-... (placeholder only, never hardcoded secret)
- Backward compatibility unchanged: if ORCHESTRATOR_* is unset, runtime still falls back to OPENAI_API_KEY + DEFAULT_MODEL.

Final integration step update (2026-03-15):

- Updated documented/example trial values to Featherless + QwQ-32B in:
  - backend/.env.example
  - backend/README.md
- No orchestrator prompt / JSON mode / parsing logic changes.
- No intent_parser, simple review summarizer, or advanced review summarizer behavior changes.

Full backend test run status:

- Command: pytest -q tests
- Environment notes:
  - fastapi and supabase had to be installed first in user site packages because base conda env is not writable.
- Result: 25 failed, 205 passed
- Failure clusters were outside this change scope:
  - Supabase integration tests failing due missing tables/functions in target schema
  - existing controller/crawling/wiring test mismatches unrelated to orchestrator-only trial-value docs update

## 1. Current orchestrator LLM call path

### Runtime path (non-stream request)

1. HTTP entry: POST /api/requests/ in backend/app/api/requests.py (create_request).
2. Request creation: RequestService.create_request in backend/app/services/request_service.py.
3. Pipeline trigger: OrchestratorService.run_recommendation_pipeline in backend/app/services/orchestrator_service.py.
4. Graph execution: run_pipeline in backend/app/agents/graph.py.
5. Orchestrator node execution: _orchestrator_node in backend/app/agents/graph.py.
6. Final API output assembly: _output_ranking_node in backend/app/agents/graph.py, returned through OrchestratorService.

### Runtime path (SSE stream=true)

1. HTTP entry: POST /api/requests/?stream=true in backend/app/api/requests.py.
2. `requests._sse_response` invokes `stream_pipeline` from `backend/app/agents/graph.py` inside a worker thread and pushes events into an async queue.
3. For each LangGraph chunk, `stream_pipeline`:
   - fires a `"starting"` progress event via callback before node execution, and
   - yields a `"done"` progress event for **every node key in the chunk** (this matters when `evaluation_agent` and `review_agent` run in parallel).
4. The controller drains the queue and writes SSE lines `data: <JSON>\n\n`.  
5. Final state (including orchestrator output from `_orchestrator_node` and advanced/simple review summaries) is turned into a `"result"` event and streamed as the last SSE message.

### Orchestrator-specific implementation details

- Orchestrator location:
  - backend/app/agents/graph.py
  - function: _orchestrator_node(state: PlannerState)
- Final recommendation-generation LLM call:
  - client.chat.completions.create(...) inside _orchestrator_node
- SDK/client used:
  - OpenAI Python SDK (from openai import OpenAI)
  - client constructed inline as OpenAI(api_key=OPENAI_API_KEY)
- Model variable/config used:
  - DEFAULT_MODEL from backend/app/config.py
- Prompt/messages sent:
  - A single formatted user prompt containing:
    - user raw_input/category/constraints
    - top candidate places (name, address, rating, price_range, distance_km, score)
    - review-derived advantages/disadvantages
  - messages:
    - system: You return only valid JSON.
    - user: full prompt text
- Output format expected:
  - strict JSON object with top-level recommendations array:
    - [{"name": "<place name>", "one_sentence_recommendation": "<sentence>"}]
  - mapping is by place name, then written to ranked_offers[i]["one_sentence_recommendation"]
- Strict JSON assumption:
  - Yes. The call sets response_format={"type": "json_object"} and then does json.loads(response.choices[0].message.content).

### Practical parsing implication

The orchestrator assumes:

- API supports OpenAI-style chat.completions endpoint
- API accepts response_format={"type": "json_object"}
- Returned content is valid JSON object, not free-form reasoning text

Any deviation triggers exception and silent fallback to empty one_sentence_recommendation fields.

## 2. Current global LLM usage across backend

### LLM/model call sites

| Component | File path | Function | Purpose | SDK/client | Model variable | Shares orchestrator config? | Expected output/parsing |
|---|---|---|---|---|---|---|---|
| Main orchestrator | backend/app/agents/graph.py | _orchestrator_node | Final per-place recommendation sentence generation | OpenAI(api_key=OPENAI_API_KEY) | DEFAULT_MODEL | Yes (same OPENAI_API_KEY + DEFAULT_MODEL) | Strict JSON via response_format json_object + json.loads |
| Intent parser | backend/app/agents/intent_parser.py | run | Parse user query into structured_request | Module-level OpenAI(api_key=OPENAI_API_KEY) | DEFAULT_MODEL | Yes | Strict JSON via response_format json_object + json.loads |
| Review summarizer (simple) | backend/app/services/reviews.py | summarise_providers | Build advantages/disadvantages for providers | OpenAI(api_key=OPENAI_API_KEY) | DEFAULT_MODEL | Yes | Strict JSON via response_format json_object + json.loads |
| Review summarizer (advanced) | backend/app/services/review_analysis/summarizer.py | summarize_reviews / _summarize_reviews_internal | Summarize selected review evidence into structured ReviewSummary | OpenAI(api_key=FEATHERLESS_API_KEY or "no-key", base_url="https://api.featherless.ai/v1") | DEFAULT_SUMMARIZER_MODEL (default arg) | No (separate key + separate model constant) | Freeform response parsed as JSON with fence stripping + Pydantic validation + retry once + fallback |

### Distinction requested

- Main orchestrator model:
  - backend/app/agents/graph.py::_orchestrator_node
  - uses OPENAI_API_KEY + DEFAULT_MODEL
- Review summarization models:
  - Simple path: backend/app/services/reviews.py::summarise_providers (OPENAI_API_KEY + DEFAULT_MODEL)
  - Advanced path: backend/app/services/review_analysis/summarizer.py (FEATHERLESS_API_KEY + hardcoded Featherless base_url + DEFAULT_SUMMARIZER_MODEL)
- Intent parser model:
  - backend/app/agents/intent_parser.py::run (OPENAI_API_KEY + DEFAULT_MODEL)
- Other model-dependent components:
  - review_router (backend/app/services/review_router.py) is routing logic only; it delegates to simple or advanced summarizers, no direct LLM call.

## 3. Current config/env structure for models

### Where settings are defined

In backend/app/config.py:

- OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
- FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY", "")
- REVIEW_MODE = os.getenv("REVIEW_MODE", "")
- DEFAULT_MODEL = "gpt-4o-mini" (hardcoded constant, not currently read from env)

In backend/.env.example:

- OPENAI_API_KEY present
- FEATHERLESS_API_KEY not listed in .env.example currently
- no DEFAULT_MODEL env entry
- no provider base_url env entry

### Base URL configurability today

- Orchestrator / intent parser / simple reviews:
  - No base_url override wired; they rely on OpenAI default endpoint.
- Advanced review summarizer:
  - Yes, uses explicit base_url, but hardcoded constant in code:
    - FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1"
  - Not env-driven today.

### OpenAI-only assumption

- Partially yes:
  - Main orchestrator path currently assumes OpenAI default endpoint behavior.
- Not fully yes:
  - advanced review summarizer already uses OpenAI-compatible SDK against Featherless base_url.

### Client construction pattern

- Not centralized.
- Repeated inline in multiple modules:
  - backend/app/agents/graph.py
  - backend/app/agents/intent_parser.py
  - backend/app/services/reviews.py
  - backend/app/services/review_analysis/summarizer.py

### Global vs component-level model choice

- Global shared model today for 3 components:
  - DEFAULT_MODEL is shared by orchestrator + intent_parser + simple review summarizer.
- Component-specific model already exists in one area:
  - advanced review summarizer has DEFAULT_SUMMARIZER_MODEL and function parameter model.

## 4. Orchestrator-specific compatibility requirements

### Protocol/API assumptions

The orchestrator currently assumes:

- OpenAI-compatible chat completions API: client.chat.completions.create
- OpenAI-style response object shape: response.choices[0].message.content
- Availability of response_format={"type": "json_object"}

### JSON schema expected by orchestrator

Expected model output:

{
  "recommendations": [
    {"name": "<place name>", "one_sentence_recommendation": "<sentence>"}
  ]
}

Then logic maps by name and writes into ranked_offers.

### Failure handling today

- Wrapped in broad try/except Exception in _orchestrator_node.
- On any failure:
  - no exception is re-raised
  - each ranked offer gets default empty one_sentence_recommendation
- Trace still records orchestrator step, but error cause is not persisted in trace output.

### Break risk with reasoning-style responses

High if provider/model does any of these:

- Returns chain-of-thought text plus JSON (invalid for direct json.loads)
- Ignores json_object response format
- Uses a different response shape or endpoint behavior
- Does not support response_format parameter

Result would be silent degradation (blank recommendation sentences), not hard failure.

## 5. Featherless integration feasibility

### Feasibility based on current structure

- OpenAI-compatible base_url path is already proven in code:
  - backend/app/services/review_analysis/summarizer.py constructs OpenAI(..., base_url=...)
- Therefore, orchestrator migration to Featherless via OpenAI SDK is likely feasible if Featherless exposes compatible chat-completions semantics for the chosen model.

### What is likely required

- Model name change alone is probably insufficient for orchestrator if provider endpoint differs from OpenAI default.
- Orchestrator likely needs provider-specific base_url wiring (and possibly provider-specific key).

### Orchestrator-only override ease

- Easy-to-moderate.
- _orchestrator_node has local client construction; can be isolated with minimal blast radius.
- Current DEFAULT_MODEL is shared globally, so changing it alone affects intent parser and simple review summarizer too.

### Dedicated orchestrator config safety

Adding dedicated settings such as ORCHESTRATOR_MODEL / ORCHESTRATOR_API_KEY / ORCHESTRATOR_BASE_URL is the safest low-risk path for first migration pass because:

- avoids changing intent parser behavior
- avoids changing simple review summarizer behavior
- keeps fallback to current OpenAI path straightforward

### Is current abstraction sufficient?

- For one quick orchestrator-only swap: yes, direct local change is possible.
- For maintainability across multiple providers/components: current abstraction is weak; a thin shared LLM client/helper would reduce repetition and config drift.

## 6. Minimal-change integration options

### Option A: replace DEFAULT_MODEL globally

- Code changes needed:
  - minimal config constant change (DEFAULT_MODEL)
- Break risk:
  - high
  - also changes intent_parser and simple review summarizer at same time
  - could break parser/review JSON behavior if reasoning model is less strict
- Backward compatibility:
  - weak; no component isolation
- Suitability now:
  - poor for safe rollout

### Option B: add orchestrator-only config

Suggested fields:

- ORCHESTRATOR_MODEL
- ORCHESTRATOR_API_KEY
- ORCHESTRATOR_BASE_URL

- Code changes needed:
  - small, localized to config + orchestrator node wiring
  - optional doc/env example updates
- Break risk:
  - low-to-medium
  - only orchestrator path changed
- Backward compatibility:
  - strong if fallback order preserves existing OPENAI_API_KEY + DEFAULT_MODEL when new vars unset
- Suitability now:
  - best for quick safe implementation

### Option C: thin shared LLM helper/factory

- Code changes needed:
  - moderate (new helper module + migration of call sites incrementally)
- Break risk:
  - medium initially (touches integration plumbing)
  - lower long-term operational risk
- Backward compatibility:
  - can be strong if helper preserves current defaults
- Suitability now:
  - good if team wants cleaner multi-provider foundation, but heavier than needed for immediate orchestrator swap

### Recommendation

Recommend Option B now.

Rationale:

- minimal blast radius
- explicit per-component provider control
- safest path to trial Featherless reasoning model in the LLM brain only
- easy rollback by toggling env vars

## 7. Suggested migration scope

Recommended first pass:

- Yes: swap orchestrator model/provider only.
- Yes: keep review summarizers unchanged initially.
  - simple review summarizer should remain on current path for stability
  - advanced review summarizer is already a separate Featherless-backed subsystem and should not be coupled to orchestrator migration in same pass
- Yes: keep intent_parser unchanged initially.

Model call sites to avoid changing in first pass:

- backend/app/agents/intent_parser.py::run
- backend/app/services/reviews.py::summarise_providers
- backend/app/services/review_analysis/summarizer.py (unless separately planned)

## 8. Proposed implementation plan (no code changes yet)

### Likely files to change

1. backend/app/config.py
2. backend/app/agents/graph.py
3. backend/.env.example
4. backend/README.md
5. Possibly new helper file (if chosen): backend/app/services/llm_client.py

### Likely config fields to add

- ORCHESTRATOR_MODEL
- ORCHESTRATOR_API_KEY
- ORCHESTRATOR_BASE_URL
- Optional hardening toggle:
  - ORCHESTRATOR_ENFORCE_JSON_MODE=true/false

### Fallback strategy

In orchestrator node runtime, resolve in this order:

1. ORCHESTRATOR_API_KEY else OPENAI_API_KEY
2. ORCHESTRATOR_MODEL else DEFAULT_MODEL
3. If ORCHESTRATOR_BASE_URL set: pass to OpenAI(base_url=...)
4. Else: use OpenAI default endpoint

If provider rejects response_format json_object, either:

- keep strict mode for safety and fail to existing empty-sentence fallback, or
- controlled fallback path that strips code fences and attempts JSON extraction before defaulting

### Test additions after implementation

Recommended new/updated tests:

1. Orchestrator config precedence test
   - verifies ORCHESTRATOR_* overrides are used when set
2. Orchestrator backward-compat test
   - verifies OPENAI_API_KEY + DEFAULT_MODEL path still used when ORCHESTRATOR_* unset
3. Orchestrator base_url wiring test
   - verifies OpenAI is constructed with base_url when ORCHESTRATOR_BASE_URL set
4. Orchestrator JSON-compat behavior test
   - verifies malformed/non-JSON model output preserves current safe fallback behavior
5. Optional integration smoke test
   - mock chat.completions response and assert one_sentence_recommendation still populates correctly

## 9. Open questions / missing information

Before coding, these are unresolved:

1. Exact Featherless endpoint for chat completions
   - confirm final base URL and API version path
2. Auth expectations
   - confirm Bearer token format compatibility with OpenAI SDK key handling
3. Exact orchestrator target model ID
   - confirm reasoning model name string expected by Featherless
4. JSON mode support
   - confirm response_format json_object support for that exact model
5. Output style constraints
   - confirm whether model may return reasoning text wrappers and if so whether server-side extraction fallback is acceptable
6. Token/latency/cost limits
   - confirm acceptable max tokens and timeout budgets for orchestrator SLA
7. Reliability expectations
   - decide if silent empty-sentence fallback is acceptable, or if explicit warning/error metadata should be surfaced in trace
8. Deployment secret management
   - decide where ORCHESTRATOR_API_KEY and ORCHESTRATOR_BASE_URL will be stored per environment

---

## Appendix: verified runtime flow map

| Stage | Function | Notes on model flow |
|---|---|---|
| Request entry | backend/app/api/requests.py::create_request | Calls orchestrator service after request creation |
| Service entry | backend/app/services/orchestrator_service.py::run_recommendation_pipeline | Calls run_pipeline with request raw_input/location/preferences |
| Graph entry | backend/app/agents/graph.py::run_pipeline | Invokes compiled LangGraph pipeline |
| Intent parse | backend/app/agents/intent_parser.py::run | Uses OPENAI_API_KEY + DEFAULT_MODEL |
| Review summarize | backend/app/agents/graph.py::_review_node -> backend/app/services/review_router.py::route_review_summaries | simple path uses OPENAI_API_KEY + DEFAULT_MODEL; advanced path uses Featherless settings |
| Orchestrator LLM brain | backend/app/agents/graph.py::_orchestrator_node | Uses OPENAI_API_KEY + DEFAULT_MODEL, strict JSON expectation |
| Output format | backend/app/agents/graph.py::_output_ranking_node | Emits final results with one_sentence_recommendation |
