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


def _ranking_stub(state: PlannerState) -> PlannerState:
    """Temporary stub — replace with real ranking node from Backend-3."""
    state["ranked_offers"] = []
    return state


def _explanation_stub(state: PlannerState) -> PlannerState:
    """Temporary stub — replace with real explanation node from Backend-3."""
    return state


def build_graph():
    graph = StateGraph(PlannerState)

    graph.add_node("intent_parser", intent_parser.run)
    graph.add_node("retrieval", retrieval.run)
    graph.add_node("feasibility", feasibility.run)
    graph.add_node("ranking", _ranking_stub)       # TODO: swap for Backend-3 node
    graph.add_node("explanation", _explanation_stub)  # TODO: swap for Backend-3 node

    graph.set_entry_point("intent_parser")
    graph.add_edge("intent_parser", "retrieval")
    graph.add_edge("retrieval", "feasibility")
    graph.add_edge("feasibility", "ranking")
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
        "raw_input": raw_input,
        "location": location,
        "preferences": preferences or {"weight_price": 0.33, "weight_distance": 0.33, "weight_rating": 0.34},
        "structured_request": None,
        "candidate_providers": [],
        "feasible_providers": [],
        "ranked_offers": [],
        "trace": make_trace(request_id="pending"),  # id updated after intent_parser runs
        "error": None,
    }
    return pipeline.invoke(initial_state)
