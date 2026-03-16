# Backend Recommendation Generation Audit

Date: 2026-03-16  
Scope: read-only audit (no code changes), focused on recommendation generation pipeline

> Historical note (superseded in part): This audit captured pre- and early-synthesis status on 2026-03-16.
> For current backend synthesis behavior and config defaults, use `doc/backend_synthesis_agent.md` as the source of truth.
> In particular, synthesis response fields and helper-module structure are now maintained there.

## 1) Architecture overview

Current backend recommendation pipeline is a LangGraph DAG in backend/app/agents/graph.py:

1. intent_parser
2. crawling_search
3. transit_calculator
4. parallel:
   - evaluation_agent (ranking)
   - review_agent (review summarization router)
5. orchestrator_agent (LLM one-line recommendation per place)
6. output_ranking (final API result assembly)

Key service modules:

- Orchestrator/DAG: backend/app/agents/graph.py
- Ranking: backend/app/services/ranking.py
- Review routing: backend/app/services/review_router.py
- Review simple mode: backend/app/services/reviews.py
- Review advanced mode pipeline:
  - backend/app/services/review_analysis/service.py
  - backend/app/services/review_analysis/filtering.py
  - backend/app/services/review_analysis/apify_client.py
  - backend/app/services/review_analysis/summarizer.py
- Final non-stream response assembly: backend/app/services/orchestrator_service.py
- Final stream response assembly: backend/app/api/requests.py (_sse_response)

---

## 2) Generation flow diagram (text)

User query -> request_service.create_request -> orchestrator_service.run_recommendation_pipeline -> graph.run_pipeline

Inside graph:

raw_input + location + preferences
-> intent_parser (LLM parse user intent)
-> crawling_search (Apify or local seed)
-> transit_calculator (ETA + feasibility/reachability)
-> parallel:
   - evaluation_agent: rank_offers
   - review_agent: route_review_summaries(simple/advanced/fallback)
-> orchestrator_agent (LLM generates one_sentence_recommendation for each ranked place)
-> output_ranking (maps ranked+reviews to final results payload)
-> API response { request, results }

Place detail flow (separate from main ranking response):

GET /api/places/{place_id}
-> place_service.get_place_detail
-> uses cached provider + cached review_summary if present
-> fallback rule-based review summary/recommendation when needed
-> places API transforms to detail contract for frontend sections like Why we recommend this / AI Insights

---

## 3) File paths for each generation step

### Output type #1: Per-store short recommendation text (Explore list one-liner)

- Generated at:
  - Module: orchestrator_agent node
  - File: backend/app/agents/graph.py
  - Function: _orchestrator_node
- Written into each ranked item field:
  - one_sentence_recommendation
- Propagated to final result:
  - backend/app/agents/graph.py
  - Function: _output_ranking_node
  - Field in final_results item: one_sentence_recommendation

Generation type:
- LLM (OpenAI-compatible chat.completions)
- fallback on failure: empty string (rule fallback, no retry at orchestrator node)

### Output type #2: Per-store detailed insight (Why we recommend this / AI Insights / Strengths/Considerations)

Two backend paths feed this detail page output:

1) Preferred path (pipeline-generated summaries)
- Source generation:
  - simple mode LLM: backend/app/services/reviews.py -> summarise_providers
  - advanced mode LLM: backend/app/services/review_analysis/summarizer.py -> summarize_reviews
  - router normalization: backend/app/services/review_router.py -> route_review_summaries
- Cached into place service:
  - backend/app/services/orchestrator_service.py -> run_recommendation_pipeline -> place_service.cache_places
  - backend/app/services/place_service.py -> cache_places
- Served to place detail API:
  - backend/app/services/place_service.py -> get_place_detail
  - backend/app/api/places.py -> get_place_detail

2) Fallback path when no cached pipeline review_summary exists
- Generated at:
  - backend/app/services/place_service.py
  - Function: _generate_review_summary (keyword-based)
  - Function: _generate_one_sentence_recommendation (template/rule string assembly)

Generation type:
- AI Insights strengths/considerations:
  - Usually LLM-derived (simple or advanced review path)
  - Fallback rule-based in place_service
- Why we recommend this (detail page):
  - api/places.py prefers review_summary.summary text if available
  - otherwise uses one_sentence_recommendation from place_service
  - no dedicated new LLM call in places API

### Output type #3: Final AI Agent response (chat-like response after full pipeline)

Backend status:
- Backend does NOT currently generate a dedicated conversational paragraph/object as a separate synthesis output.
- Backend returns structured payload:
  - non-stream: { request, results }
  - stream final event: { type: "result", request, results }

Current hard-coded/template conversational message location:
- Frontend template (not backend): frontend/src/pages/Chat.tsx
- In useEffect after pipelineStage === "completed", assistant content is hard-coded as:
  - "I found {n} places for \"{query}\". Here are my top recommendations:"

So current final chat sentence is template-generated in frontend, using backend result count + current query, not generated by backend LLM.

---

## 4) Input data schemas used at each generation step

### 4.1 Orchestrator one-line recommendation generation (_orchestrator_node)

Input state keys used:

- state["structured_request"]:
  - raw_input
  - category
  - constraints
- state["ranked_offers"] (top 10 considered): each item fields used:
  - id (for join)
  - name
  - address
  - rating
  - price_range
  - distance_km
  - score
- state["review_summaries"] joined by place_id -> id:
  - advantages
  - disadvantages

Exact prompt payload object passed to LLM (per place in places_info):

- name: str
- address: str
- rating: number | null
- price_range: str
- distance_km: number | null
- score: number | null
- advantages: list[str]
- disadvantages: list[str]

Expected LLM output schema:

{
  "recommendations": [
    { "name": "<place name>", "one_sentence_recommendation": "<sentence>" }
  ]
}

Matching logic:
- by place name -> write to ranked_offers[i].one_sentence_recommendation

### 4.2 Review summarization inputs and schemas

#### Simple mode (reviews.py -> summarise_providers)
Input providers list item fields used:
- id
- name
- rating
- review_count
- price_range
- distance_km
- category
- optional reviews[].text (up to 10 texts)

LLM expected output schema:

{
  "summaries": [
    {
      "place_id": "<id>",
      "advantages": ["..."],
      "disadvantages": ["..."]
    }
  ]
}

#### Advanced mode (review_analysis.service -> summarize pipeline)
Main pipeline function:
- analyze_and_summarize_reviews(dataset_id | place_url, ...)

Internal flow schemas:

1) Apify mapped review item (ReviewItem in review_analysis/schemas.py):
- id: str | null
- provider_id: str | null
- stars: float (1..5)
- text: str | null
- date: datetime

2) Filtering output (ReviewAnalysisResult):
- positive_reviews: list[ReviewItem]
- negative_reviews: list[ReviewItem]
- all_reviews_with_rating: list[ReviewItem]
- text_reviews: list[ReviewItem]
- stats:
  - avg_rating_recent: float
  - rating_distribution: dict[int, int] (1..5)
  - empty_text_review_count: int

3) Advanced summarizer LLM output (ReviewSummary):
- strengths: list[str]
- weaknesses: list[str]
- positive_aspects: list[str]
- negative_aspects: list[str]
- summary: str
- confidence: float (0..1)

4) Curated downstream payload from advanced summarizer:
- build_orchestrator_summary_payload(summary) returns:
  - strengths, weaknesses, positive_aspects, negative_aspects, summary, confidence
- service then appends aggregate stats fields into orchestrator_payload:
  - avg_rating_recent
  - rating_distribution
  - text_review_count
  - empty_text_review_count
  - selected_positive_review_count
  - selected_negative_review_count

5) Router-normalized output consumed by graph:
- place_id: str
- advantages: list[str]   (mapped from strengths in advanced mode)
- disadvantages: list[str] (mapped from weaknesses in advanced mode)
- optional summary: str
- optional rating_distribution: dict[str, int] (keys coerced to "1".."5")

### 4.3 Ranking module schemas (ranking.py)

Input:
- rank_offers(providers: list[dict], prefs: UserPreferences | None)

Provider fields consumed:
- price or price_range
- distance_km
- rating
(and pass-through other provider metadata)

Produced per ranked row:
- all original provider fields
- price (filled if missing)
- score: float
- score_breakdown:
  - price_score
  - distance_score
  - rating_score

### 4.4 Final output assembly schema (_output_ranking_node)

Input consumed:
- ranked_offers (already has score/score_breakdown and possibly one_sentence_recommendation)
- review_summaries (for review_summary_text by place_id)
- preferences (for attach_explanations)

Final results[] item schema produced:
- place_id
- name
- address
- distance_km
- price_level
- rating
- rating_count
- recommendation_score (from score)
- status
- transit
- reason_tags (from explanation.attach_explanations -> reasons)
- one_sentence_recommendation
- review_summary_text

---

## 5) Whether review JSON is already normalized

Short answer: partially yes, with a clear normalized interface at router boundary.

- Raw review source (Apify dataset item) is NOT directly consumed downstream.
- It is mapped to typed ReviewItem, filtered/deduplicated, then summarized.
- Graph downstream consumes router-normalized summary items:
  - place_id
  - advantages
  - disadvantages
  - optional summary
  - optional rating_distribution

Assessment:
- Downstream graph/orchestrator does NOT use raw review JSON.
- It uses curated summary fields (normalized and filtered), especially via review_router output.

---

## 6) Whether a shared payload assembly layer already exists

Global/shared layer across all generation outputs: No.

What exists today:
- Local assembly helpers in specific modules:
  - review_analysis.summarizer.build_orchestrator_summary_payload (advanced review only)
  - graph._output_ranking_node (final results payload assembly)
  - places API transform in api/places.py (detail response assembly)

Conclusion:
- There is no single shared payload-assembly component reused by list one-liner, detail insight, and final chat response.

---

## 7) Safest minimal insertion point for a new synthesis layer

Recommended minimal insertion point (backend):
- backend/app/agents/graph.py at/after _output_ranking_node, before API response leaves backend.

Why:
- At this point, all required ingredients are already merged:
  - structured_request
  - ranked_offers + recommendation_score
  - one_sentence_recommendation
  - review summary signals (advantages/disadvantages/summary)
  - tags from explanation
  - transit/status fields
- Minimal blast radius:
  - does not change ranking/review core logic
  - one place to support both non-stream and stream final payload

Practical options:
1. Add a new node (e.g., synthesis_agent) between output_ranking and END.
2. Or extend _output_ranking_node to assemble a dedicated final_agent_reply payload.

Given current code shape, option 1 is cleaner for future extensibility; option 2 is smallest immediate diff.

---

## A/B/C/D/E/F/G checklist mapping

A) Where generated
- #1 one-line: graph._orchestrator_node
- #2 detail insight: review_router + reviews/review_analysis + place_service/api/places
- #3 final chat sentence: currently frontend Chat.tsx template, not backend

B) Inputs used
- User prompt/intent: structured_request(raw_input/category/constraints/keywords upstream)
- Ranking outputs: score, score_breakdown, ranked rows
- Review aggregation: advantages/disadvantages/summary/rating_distribution
- Store metadata: name/address/rating/price/distance/category etc.
- Filtering results: review_analysis filtering outputs before summary
- Route/transit: transit_info from transit_calculator and place_service transit

C) Generation method
- LLM: intent parser, orchestrator one-line, simple review summary, advanced review summary
- Template/hard-coded: frontend final assistant sentence; AGENT_START/DONE progress strings; places API preference order for recommendation_reasons
- Rule-based: ranking scores, explanation tags, place_service fallback review summary & one-line fallback

D) Exact generation-step schema
- Documented in section 4 (orchestrator prompt payload, review schemas, ranking outputs, final results schema)

E) Review aggregation normalization
- Yes at downstream boundary (router normalized summary), based on curated summary fields, not raw dataset JSON

F) Ranking output fields + actual usage
- Produced: score, score_breakdown, price (+ passthrough provider fields)
- Used by orchestrator/response generation:
  - orchestrator LLM prompt: score + metadata
  - output_ranking: recommendation_score <- score
  - explanation.attach_explanations: uses score_breakdown
  - reason_tags: derived from explanation reasons

G) Final AI Agent reply location and data use
- Current conversational reply template in frontend/src/pages/Chat.tsx
- Uses: results.length + currentQuery
- Backend currently provides data-only payload, not synthesized conversational paragraph
