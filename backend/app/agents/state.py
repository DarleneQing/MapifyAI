from typing import Any
from typing_extensions import NotRequired, TypedDict
from app.models.schemas import StructuredRequest, Provider, Offer, AgentTrace, UserPreferences


class PlannerState(TypedDict):
    # Input
    raw_input: str
    location: dict           # {"lat": float, "lng": float}
    preferences: dict        # UserPreferences as dict
    review_mode: NotRequired[str | None]

    # Populated by Intent Parser Agent
    structured_request: dict | None

    # Populated by Retrieval Agent
    candidate_providers: list[dict]

    # retry count for feasibility check, how many times we've widened the radius
    retry_count: int

    # Populated by Evaluation Agent (ranking.py)
    ranked_offers: list[dict]

    # Populated by Review Agent (advantages/disadvantages per place)
    review_summaries: list[dict]

    # Populated by Output Ranking node (final PlaceSummary[] for API)
    final_results: list[dict]

    # Populated by synthesis_agent (final conversational reply)
    agent_reply: NotRequired[str | None]

    # Trace (US-13)
    trace: dict              # AgentTrace as dict

    # Error state
    error: str | None
