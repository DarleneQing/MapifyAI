"""
Planner Agent  (Backend-1 — yours to implement)
------------------------------------------------
Decides which agents to run and in what order based on the request.
For MVP this is a fixed pipeline; stretch goal is dynamic planning via LLM.

TODO:
  1. (MVP)   Always run: intent_parser → retrieval → feasibility → ranking → explanation
  2. (Stretch) Call Claude to let it decide which optional agents to include
              (e.g. skip feasibility if user said "any time", add review_summarizer if
               user asked for recommendations)
  3. Return the ordered list of agent names to graph.py
"""
from app.agents.state import PlannerState


FIXED_PIPELINE = [
    "intent_parser",
    "retrieval",
    "feasibility",
    "ranking",      # implemented by Backend-3 — calls services/ranking.py
    "explanation",  # implemented by Backend-3 — calls services/explanation.py
]


def plan(state: PlannerState) -> list[str]:
    """
    Returns the ordered list of agent node names to execute.
    TODO: replace with LLM-driven dynamic planning (stretch).
    """
    return FIXED_PIPELINE
