from typing import Any
from typing_extensions import TypedDict
from app.models.schemas import StructuredRequest, Provider, Offer, AgentTrace, UserPreferences


class PlannerState(TypedDict):
    # Input
    raw_input: str
    location: dict           # {"lat": float, "lng": float}
    preferences: dict        # UserPreferences as dict

    # Populated by Intent Parser Agent
    structured_request: dict | None

    # Populated by Retrieval Agent
    candidate_providers: list[dict]

    # Populated by Feasibility Agent
    feasible_providers: list[dict]

    # Populated by Ranking Agent (Backend-3)
    ranked_offers: list[dict]

    # Populated by Explanation Agent (Backend-3)
    # (reasons are added directly into each offer dict)

    # Trace (US-13)
    trace: dict              # AgentTrace as dict

    # Error state
    error: str | None
