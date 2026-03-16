"""
LangGraph pipeline — multi-agent DAG for LocalBid recommendations.

Architecture:
  intent_parser → crawling_search → transit_calculator
                                            │
                              ┌─────────────┴─────────────┐
                              ▼                           ▼
                      evaluation_agent            review_agent
                              │                           │
                              └─────────────┬─────────────┘
                                            ▼
                                   orchestrator_agent
                                            │
                                     output_ranking
                                            │
                                           END

evaluation_agent and review_agent run in parallel via LangGraph's Send API —
both receive the pre-selection list from transit_calculator simultaneously.
LangGraph merges their state writes before orchestrator_agent runs.

The orchestrator_agent is the LLM brain: it reads user intent +
hard scores (evaluation_agent) + review summaries (review_agent) and
generates one_sentence_recommendation per place.

If APIFY_API_TOKEN is not set, crawling_search falls back to the local seed file.
"""
import json
import threading
import time

from langgraph.graph import StateGraph, END
from app.agents import intent_parser
from app.agents.state import PlannerState
from app.agents.trace import add_step, make_trace
from app.config import (
    APIFY_API_TOKEN,
    OPENAI_API_KEY,
    DEFAULT_MODEL,
    REVIEW_MODE,
    ORCHESTRATOR_MODEL,
    ORCHESTRATOR_API_KEY,
    ORCHESTRATOR_BASE_URL,
)
from app.models.schemas import UserPreferences, LatLng

# Thread-local storage so multiple concurrent requests each have their own callback.
# The background thread running stream_pipeline() sets this; node wrappers read it.
_node_callback = threading.local()


def _wrap(name: str, fn):
    """Wrap a node function to fire the thread-local callback before it runs."""
    def wrapped(state):
        cb = getattr(_node_callback, "fn", None)
        if cb:
            cb(name, "starting")
        return fn(state)
    return wrapped


# ---------------------------------------------------------------------------
# Node: crawling_search  (Apify or seed fallback)
# ---------------------------------------------------------------------------

def _crawling_search_node(state: PlannerState) -> PlannerState:
    if APIFY_API_TOKEN:
        from app.agents import crawling_search
        return crawling_search.run(state)
    from app.agents import retrieval
    return retrieval.run(state)


# ---------------------------------------------------------------------------
# Node: transit_calculator  (SBB ETA + reachability filter)
# ---------------------------------------------------------------------------

def _transit_calculator_node(state: PlannerState) -> PlannerState:
    from app.agents import transit_calculator
    return transit_calculator.run(state)


# ---------------------------------------------------------------------------
# Node: evaluation_agent  (hard score calculation via ranking.py)
# ---------------------------------------------------------------------------

def _evaluation_node(state: PlannerState) -> dict:
    # Returns only the key this node owns — required for parallel execution.
    # Returning the full state would cause LangGraph to see multiple writers
    # on every key when evaluation_agent and review_agent run simultaneously.
    from app.services.ranking import rank_offers

    providers = state["candidate_providers"]
    prefs_dict = state.get("preferences") or {}
    try:
        prefs = UserPreferences(**prefs_dict) if prefs_dict else None
    except Exception:
        prefs = None

    ranked = rank_offers(providers, prefs)
    return {"ranked_offers": ranked}


# ---------------------------------------------------------------------------
# Node: review_agent  (Apify reviews + LLM summary)
#
# Currently a stub — returns empty advantages/disadvantages.
# TODO: call Apify review scraper for each place in candidate_providers,
#       then call OpenAI to produce structured advantages / disadvantages,
#       and store them in state["review_summaries"].
# ---------------------------------------------------------------------------

def _review_node(state: PlannerState) -> dict:
    # Returns only the key this node owns — required for parallel execution.
    from app.services.review_router import route_review_summaries

    providers = state["candidate_providers"]
    review_mode = state.get("review_mode") or REVIEW_MODE or "simple"
    summaries = route_review_summaries(providers, review_mode=review_mode)
    return {"review_summaries": summaries}


# ---------------------------------------------------------------------------
# Node: orchestrator_agent  (LLM brain)
#
# Receives:
#   - state["structured_request"]  — user intent, category, constraints
#   - state["ranked_offers"]       — pre-selection list with hard scores
#   - state["review_summaries"]    — advantages / disadvantages per place
#
# Produces:
#   - one_sentence_recommendation attached to each item in ranked_offers
# ---------------------------------------------------------------------------

def _orchestrator_node(state: PlannerState) -> PlannerState:
    start = time.time() * 1000
    from openai import OpenAI

    resolved_api_key = ORCHESTRATOR_API_KEY or OPENAI_API_KEY
    resolved_model = ORCHESTRATOR_MODEL or DEFAULT_MODEL
    if ORCHESTRATOR_BASE_URL:
        client = OpenAI(api_key=resolved_api_key, base_url=ORCHESTRATOR_BASE_URL)
    else:
        client = OpenAI(api_key=resolved_api_key)
    ranked = state["ranked_offers"]
    review_map = {r["place_id"]: r for r in state.get("review_summaries", [])}
    req = state["structured_request"] or {}

    if not ranked:
        state["trace"] = add_step(
            state["trace"],
            agent="orchestrator_agent",
            input_data={},
            output_data={"skipped": "no ranked offers"},
            start_ms=start,
        )
        return state

    places_info = []
    for p in ranked[:10]:
        review = review_map.get(p.get("id", ""), {})
        places_info.append({
            "name": p.get("name", ""),
            "address": p.get("address", ""),
            "rating": p.get("rating"),
            "price_range": p.get("price_range", ""),
            "distance_km": p.get("distance_km"),
            "score": p.get("score"),
            "advantages": review.get("advantages", []),
            "disadvantages": review.get("disadvantages", []),
        })

    prompt = f"""You are a local service recommendation assistant in Zurich.

User's request: {req.get("raw_input", "")}
Category: {req.get("category", "")}
Constraints: {json.dumps(req.get("constraints", {}))}

Top candidate places with scores and reviews:
{json.dumps(places_info, indent=2, ensure_ascii=False)}

For each place write ONE concise sentence (max 20 words) explaining why it suits
this specific user request. Focus on the most relevant factor: price, proximity,
rating, or availability.

Return a JSON object:
{{
  "recommendations": [
    {{"name": "<place name>", "one_sentence_recommendation": "<sentence>"}}
  ]
}}"""

    try:
        response = client.chat.completions.create(
            model=resolved_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "You return only valid JSON."},
                {"role": "user", "content": prompt},
            ],
        )
        result = json.loads(response.choices[0].message.content)
        recs = result.get("recommendations", [])
        rec_map = {r["name"]: r.get(
            "one_sentence_recommendation", "") for r in recs}
        for p in ranked:
            p["one_sentence_recommendation"] = rec_map.get(
                p.get("name", ""), "")
    except Exception:
        for p in ranked:
            p.setdefault("one_sentence_recommendation", "")

    state["ranked_offers"] = ranked
    state["trace"] = add_step(
        state["trace"],
        agent="orchestrator_agent",
        input_data={"ranked": len(ranked)},
        output_data={"with_recommendations": len(ranked)},
        start_ms=start,
    )
    return state


# ---------------------------------------------------------------------------
# Node: output_ranking  (format ranked_offers → PlaceSummary[] for the API)
# ---------------------------------------------------------------------------

def _price_level(price_range: str | None) -> str:
    import re
    if not price_range:
        return "medium"
    nums = re.findall(r"\d+", price_range)
    if not nums:
        return "medium"
    avg = sum(float(n) for n in nums) / len(nums)
    if avg < 40:
        return "low"
    if avg < 80:
        return "medium"
    return "high"


def _reachability_to_status(reachability: str | None) -> str:
    if reachability == "closing_soon":
        return "closing_soon"
    if reachability == "unreachable":
        return "closed"
    return "open_now"


def _format_transit(transit_info: dict | None) -> dict | None:
    if not transit_info:
        return None
    return {
        "duration_minutes": transit_info.get("duration_minutes"),
        "transport_types": transit_info.get("transport_types", []),
        "departure_time": transit_info.get("departure_time"),
        "summary": transit_info.get("summary"),
        "connections": transit_info.get("connections"),
    }


def _output_ranking_node(state: PlannerState) -> PlannerState:
    start = time.time() * 1000
    from app.services.explanation import attach_explanations

    prefs_dict = state.get("preferences") or {}
    try:
        prefs = UserPreferences(**prefs_dict) if prefs_dict else None
    except Exception:
        prefs = None

    ranked_with_reasons = attach_explanations(state["ranked_offers"][:10], prefs)
    review_map = {
        r["place_id"]: (r.get("summary") or "").strip()
        for r in state.get("review_summaries", [])
    }

    results = []
    for p in ranked_with_reasons:
        place_id = p.get("id", "")
        results.append({
            "place_id": place_id,
            "name": p.get("name", ""),
            "address": p.get("address", ""),
            "distance_km": p.get("distance_km"),
            "price_level": _price_level(p.get("price_range")),
            "rating": p.get("rating"),
            "rating_count": p.get("review_count", 0),
            "recommendation_score": p.get("score"),
            "status": _reachability_to_status(p.get("reachability_status")),
            "transit": _format_transit(p.get("transit_info")),
            "reason_tags": p.get("reasons", []),
            "one_sentence_recommendation": p.get("one_sentence_recommendation", ""),
            "review_summary_text": review_map.get(place_id, ""),
        })

    state["final_results"] = results
    state["trace"] = add_step(
        state["trace"],
        agent="output_ranking",
        input_data={"ranked": len(state["ranked_offers"])},
        output_data={"results": len(results)},
        start_ms=start,
    )
    return state


# ---------------------------------------------------------------------------
# Conditional edge after transit_calculator
# Retry crawling_search with wider radius if no candidates remain
# ---------------------------------------------------------------------------

def _after_transit(state: PlannerState):
    if not state["candidate_providers"] and state.get("retry_count", 0) < 2:
        state["retry_count"] = state.get("retry_count", 0) + 1
        return "retry"
    # Fan-out: return a list of strings so LangGraph runs both nodes in parallel
    # AND the static graph compiler can see both edges for draw_mermaid()
    return ["evaluation_agent", "review_agent"]


# ---------------------------------------------------------------------------
# Graph wiring
# ---------------------------------------------------------------------------

def build_graph():
    graph = StateGraph(PlannerState)

    graph.add_node("intent_parser",      _wrap("intent_parser",      intent_parser.run))
    graph.add_node("crawling_search",    _wrap("crawling_search",    _crawling_search_node))
    graph.add_node("transit_calculator", _wrap("transit_calculator", _transit_calculator_node))
    graph.add_node("evaluation_agent",   _wrap("evaluation_agent",   _evaluation_node))
    graph.add_node("review_agent",       _wrap("review_agent",       _review_node))
    graph.add_node("orchestrator_agent", _wrap("orchestrator_agent", _orchestrator_node))
    graph.add_node("output_ranking",     _wrap("output_ranking",     _output_ranking_node))

    graph.set_entry_point("intent_parser")
    graph.add_edge("intent_parser", "crawling_search")
    graph.add_edge("crawling_search", "transit_calculator")
    graph.add_conditional_edges(
        "transit_calculator",
        _after_transit,
        {
            "retry": "crawling_search",
            "evaluation_agent": "evaluation_agent",
            "review_agent": "review_agent",
        },
    )
    # Both parallel branches converge at orchestrator_agent
    graph.add_edge("evaluation_agent", "orchestrator_agent")
    graph.add_edge("review_agent", "orchestrator_agent")
    graph.add_edge("orchestrator_agent", "output_ranking")
    graph.add_edge("output_ranking", END)

    return graph.compile()


pipeline = build_graph()


def _build_initial_state(
    raw_input: str,
    location: LatLng | dict,
    preferences: UserPreferences | dict | None = None,
    review_mode: str | None = None,
) -> PlannerState:
    """Build the initial LangGraph state dict."""
    if isinstance(location, LatLng):
        location_dict = location.model_dump()
    else:
        location_dict = location

    if isinstance(preferences, UserPreferences):
        prefs_dict = preferences.model_dump()
    elif preferences is None:
        prefs_dict = {
            "weight_price": 0.33,
            "weight_distance": 0.33,
            "weight_rating": 0.34,
        }
    else:
        prefs_dict = preferences

    return {
        "retry_count": 0,
        "raw_input": raw_input,
        "location": location_dict,
        "preferences": prefs_dict,
        "review_mode": review_mode,
        "structured_request": None,
        "candidate_providers": [],
        "ranked_offers": [],
        "review_summaries": [],
        "final_results": [],
        "trace": make_trace(request_id="pending"),
        "error": None,
    }


def run_pipeline(
    raw_input: str,
    location: LatLng | dict,
    preferences: UserPreferences | dict | None = None,
    review_mode: str | None = None,
) -> PlannerState:
    """Entry point called by the API layer. Returns the final PlannerState."""
    initial_state = _build_initial_state(
        raw_input,
        location,
        preferences,
        review_mode,
    )
    return pipeline.invoke(initial_state)


# Messages sent BEFORE a node starts and AFTER it finishes
AGENT_START_MESSAGES: dict[str, str] = {
    "intent_parser":      "Understanding your request...",
    "crawling_search":    "Searching Google Maps for nearby places...",
    "transit_calculator": "Calculating transit times via SBB...",
    "evaluation_agent":   "Scoring and ranking candidates...",
    "review_agent":       "Summarizing customer reviews...",
    "orchestrator_agent": "Generating personalized recommendations...",
    "output_ranking":     "Finalizing your top results...",
}

AGENT_DONE_MESSAGES: dict[str, str] = {
    "intent_parser":      "Request understood",
    "crawling_search":    "Found nearby places",
    "transit_calculator": "Transit times calculated",
    "evaluation_agent":   "Candidates scored",
    "review_agent":       "Reviews summarized",
    "orchestrator_agent": "Recommendations ready",
    "output_ranking":     "Done!",
}


def stream_pipeline(
    raw_input: str,
    location: LatLng | dict,
    preferences: UserPreferences | dict | None = None,
    review_mode: str | None = None,
    on_node_start=None,
):
    """
    Generator that yields "done" events as each agent node completes, plus a
    final "result" event with the full PlannerState.

    "starting" events are dispatched **immediately** (before the node runs)
    via the ``on_node_start`` callback, which the caller should wire to an
    async queue so the frontend receives them in real-time.  If no callback is
    provided, "starting" events are yielded together with "done" (batched,
    not real-time — kept for backwards-compat / tests).

    Yields:
      {"type": "progress", "status": "done", "agent": ..., "duration_ms": ...}
      {"type": "result", "state": <final PlannerState>}
    """
    initial_state = _build_initial_state(
        raw_input,
        location,
        preferences,
        review_mode,
    )
    final_state: PlannerState | None = None

    _start_buffer: list[dict] = []
    _node_start_ms: dict[str, float] = {}

    def _on_node_start(name: str, _status: str) -> None:
        _node_start_ms[name] = time.time() * 1000
        event = {
            "type": "progress",
            "status": "starting",
            "agent": name,
            "message": AGENT_START_MESSAGES.get(name, f"Starting {name}..."),
        }
        if on_node_start is not None:
            on_node_start(event)
        else:
            _start_buffer.append(event)

    _node_callback.fn = _on_node_start
    try:
        for chunk in pipeline.stream(initial_state):
            if _start_buffer:
                yield from _start_buffer
                _start_buffer.clear()

            # Chunk may contain one or multiple nodes (e.g. parallel evaluation_agent + review_agent)
            for node_name in chunk:
                final_state = chunk[node_name]
                start_ms = _node_start_ms.get(node_name)
                duration_ms = int(time.time() * 1000 - start_ms) if start_ms is not None else None
                yield {
                    "type": "progress",
                    "status": "done",
                    "agent": node_name,
                    "duration_ms": duration_ms,
                    "message": AGENT_DONE_MESSAGES.get(node_name, f"{node_name} completed"),
                }
    finally:
        _node_callback.fn = None

    yield {"type": "result", "state": final_state}
