# Backend Synthesis Agent

Date: 2026-03-16
Status: Source of truth for backend synthesis behavior (Phase 2, Round 1)

## Current Graph Order

The LangGraph pipeline order is:

1. intent_parser
2. crawling_search
3. transit_calculator
4. evaluation_agent (parallel)
5. review_agent (parallel)
6. orchestrator_agent
7. output_ranking
8. synthesis_agent
9. END

The `synthesis_agent` node runs after ranking output assembly and writes `state["agent_reply"]`.

## Backend Response Contract

Synthesis is now part of backend responses:

- Non-stream response:

```json
{
  "request": { "...": "..." },
  "results": ["..."],
  "agent_reply": "..."
}
```

- Stream final result event:

```json
{
  "type": "result",
  "request": { "...": "..." },
  "results": ["..."],
  "agent_reply": "..."
}
```

## Round 1 Helper Modules

To keep `graph.py` minimal, Round 1 extracted synthesis logic into helpers:

- `backend/app/agents/synthesis_prompts.py`
  - `build_synthesis_prompt(...)`
  - builds system and user prompt content
  - applies tone and reply-length knobs

- `backend/app/services/synthesis_context.py`
  - `select_synthesis_context(...)`
  - `build_context_item(...)`
  - builds and filters context payload from `final_results`, `ranked_offers`, and `review_summaries`

`graph.py` now orchestrates these helpers without changing ranking, review routing, or orchestrator internals.

## Synthesis Inputs (Current)

The synthesis context is built from:

- `structured_request`
  - `raw_input`, `category`, `constraints`
- `final_results` (top N)
  - `name`, `recommendation_score`, `reason_tags`, `transit.summary`
  - `one_sentence_recommendation`, `review_summary_text`
- `ranked_offers` (joined by place id)
  - `rating`, `distance_km`
- `review_summaries` (joined by place id)
  - `advantages`
  - `disadvantages` (available, toggle-controlled)

## Config Knobs and Defaults

Configuration lives in `backend/app/agent_synthesis_config.py`.

Context selection:

- `MAX_PLACES_IN_CONTEXT = 3`
- `SYNTHESIS_BUDGET_TOKENS = 2000`

Signal toggles:

- `ENABLE_REVIEW_SIGNALS = True`
- `ENABLE_REVIEW_DISADVANTAGES = False`
- `ENABLE_RANKING_SIGNALS = True`
- `ENABLE_CONSTRAINT_SIGNALS = True`

Reply style and fallback:

- `SYNTHESIS_REPLY_LENGTH = "medium"`
- `SYNTHESIS_TONE = "helpful"`
- `SYNTHESIS_FALLBACK_ENABLED = True`

Backward-safety note:

- Defaults preserve Phase 1 behavior in practice:
  - top-context limit remains 3
  - review advantages and ranking signals remain enabled
  - fallback remains enabled
  - disadvantages are still excluded by default

## Failure Behavior

If synthesis LLM generation fails or returns empty content:

- backend uses template fallback reply when `SYNTHESIS_FALLBACK_ENABLED` is `True`.

## Intentionally Unfinished (Later Phases)

The following are intentionally left for later phases:

- Frontend consumption of `agent_reply` in chat UI
- Budget-aware context selection heuristics (token-aware truncation beyond fixed top-N)
- Optional tuning of tone/length and expanded signal usage
