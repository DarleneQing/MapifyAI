"""
LangGraph Graph Definition  (Backend-1 — yours to implement)
-------------------------------------------------------------
Wires all agents into a state machine using LangGraph.

TODO:
  1. Create a StateGraph with PlannerState
  2. Add each agent as a node
  3. Add edges: intent_parser → retrieval → feasibility → ranking → explanation → END
  4. Call ranking/explanation via services (implemented by Backend-3)
  5. Compile and expose run_pipeline()

Docs: https://langchain-ai.github.io/langgraph/
"""
from langgraph.graph import StateGraph, END

from app.agents.state import PlannerState
from app.agents import intent_parser, retrieval, feasibility
from app.agents.trace import make_trace


# TODO: import ranking and explanation nodes once Backend-3 implements them
# from app.agents import ranking_node, explanation_node


def _score_provider(p: dict, prefs: dict, min_price: float, max_price: float, min_dist: float, max_dist: float) -> tuple[float, dict]:
    """Simple weighted score. All dimensions normalised to [0, 1]."""
    def norm(val, lo, hi, invert=False):
        if hi == lo:
            return 1.0
        n = (val - lo) / (hi - lo)
        return 1 - n if invert else n

    price_mid = _parse_price_midpoint(p.get("price_range", ""))
    price_score = norm(price_mid, min_price, max_price, invert=True)
    distance_score = norm(p.get("distance_km", 0),
                          min_dist, max_dist, invert=True)
    rating_score = norm(p.get("rating", 3.0), 1.0, 5.0)

    wp = prefs.get("weight_price", 0.33)
    wd = prefs.get("weight_distance", 0.33)
    wr = prefs.get("weight_rating", 0.34)

    total = wp * price_score + wd * distance_score + wr * rating_score
    breakdown = {
        "price_score": round(price_score, 3),
        "distance_score": round(distance_score, 3),
        "rating_score": round(rating_score, 3),
    }
    return round(total, 4), breakdown


def _parse_price_midpoint(price_range: str) -> float:
    """Extract midpoint from 'CHF 30–60' style strings."""
    import re
    nums = re.findall(r"\d+", price_range)
    if len(nums) >= 2:
        return (float(nums[0]) + float(nums[1])) / 2
    if len(nums) == 1:
        return float(nums[0])
    return 50.0  # fallback


def _explain(p: dict, breakdown: dict, prefs: dict) -> list[str]:
    """Generate top-3 human-readable reasons from score breakdown."""
    reasons = []
    sorted_dims = sorted(breakdown.items(), key=lambda x: x[1], reverse=True)

    labels = {
        "price_score":    f"Affordable pricing ({p.get('price_range', 'N/A')})",
        "distance_score": f"Close by — only {p.get('distance_km', '?')} km away",
        "rating_score":   f"Highly rated at {p.get('rating', '?')} ★",
    }
    for dim, _ in sorted_dims[:3]:
        reasons.append(labels.get(dim, dim))

    # Add time label if present
    if p.get("time_label") and len(reasons) < 3:
        reasons.append(p["time_label"].capitalize())

    return reasons[:3]


def _ranking_node(state: PlannerState) -> PlannerState:
    providers = state["feasible_providers"]
    prefs = state.get("preferences") or {}

    if not providers:
        state["ranked_offers"] = []
        return state

    prices = [_parse_price_midpoint(p.get("price_range", ""))
              for p in providers]
    dists = [p.get("distance_km", 0) for p in providers]
    min_p, max_p = min(prices), max(prices)
    min_d, max_d = min(dists), max(dists)

    scored = []
    for p, price in zip(providers, prices):
        score, breakdown = _score_provider(
            p, prefs, min_p, max_p, min_d, max_d)
        reasons = _explain(p, breakdown, prefs)
        scored.append(
            {**p, "score": score, "score_breakdown": breakdown, "reasons": reasons})

    scored.sort(key=lambda x: x["score"], reverse=True)
    state["ranked_offers"] = scored
    return state


def after_feasibility(state: PlannerState) -> str:
    if len(state["feasible_providers"]) == 0 and state.get("retry_count", 0) < 2:
        return "retry"
    return "ranking"


def _explanation_stub(state: PlannerState) -> PlannerState:
    """Explanations are already attached in _ranking_node."""
    return state


def build_graph():
    graph = StateGraph(PlannerState)

    graph.add_node("intent_parser", intent_parser.run)
    graph.add_node("retrieval", retrieval.run)
    graph.add_node("feasibility", feasibility.run)
    graph.add_node("ranking", _ranking_node)
    # TODO: swap for Backend-3 node
    graph.add_node("explanation", _explanation_stub)

    graph.set_entry_point("intent_parser")
    graph.add_edge("intent_parser", "retrieval")
    graph.add_edge("retrieval", "feasibility")
    graph.add_conditional_edges(
        "feasibility",
        after_feasibility,
        {
            "retry": "retrieval",
            "ranking": "ranking",
        })
    graph.add_edge("ranking", "explanation")
    graph.add_edge("explanation", END)

    return graph.compile()


# Module-level compiled graph (import this in api/requests.py)
pipeline = build_graph()


def run_pipeline(raw_input: str, location: dict, preferences: dict | None = None) -> PlannerState:
    """
    Entry point called by the API layer.
    Returns the final PlannerState with ranked_offers + trace.
    """
    initial_state: PlannerState = {
        "retry_count": 0,
        "raw_input": raw_input,
        "location": location,
        "preferences": preferences or {"weight_price": 0.33, "weight_distance": 0.33, "weight_rating": 0.34},
        "structured_request": None,
        "candidate_providers": [],
        "feasible_providers": [],
        "ranked_offers": [],
        # id updated after intent_parser runs
        "trace": make_trace(request_id="pending"),
        "error": None,
    }
    return pipeline.invoke(initial_state)
