"""
Wiring layer: connects controllers to service implementations.

Called at app startup to inject service dependencies into API modules.
"""
from typing import Any


def wire_requests_controller(
    *,
    auth_service: Any = None,
    request_service: Any = None,
    orchestrator_service: Any = None,
    marketplace: Any = None,
    trace_service: Any = None,
) -> None:
    """
    Wire service instances to the requests controller.

    Only assigns non-None values so partial wiring is supported.
    """
    import app.api.requests as requests_api

    if auth_service is not None:
        requests_api.auth_service = auth_service
    if request_service is not None:
        requests_api.request_service = request_service
    if orchestrator_service is not None:
        requests_api.orchestrator_service = orchestrator_service
    if marketplace is not None:
        requests_api.marketplace = marketplace
    if trace_service is not None:
        requests_api.trace_service = trace_service


def wire_users_controller(
    *,
    auth_service: Any = None,
    profile_service: Any = None,
) -> None:
    """
    Wire service instances to the users controller.
    """
    import app.api.users as users_api

    if auth_service is not None:
        users_api.auth_service = auth_service
    if profile_service is not None:
        users_api.profile_service = profile_service


def wire_places_controller(
    *,
    place_service: Any = None,
) -> None:
    """
    Wire service instances to the places controller.
    """
    import app.api.places as places_api

    if place_service is not None:
        places_api.place_service = place_service
