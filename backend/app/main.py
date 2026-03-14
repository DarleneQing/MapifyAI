from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import requests, offers, providers, users, places, location
from app.config import SUPABASE_URL
from app.services.auth_service import AnonymousAuthService
from app.services.marketplace_memory import InMemoryMarketplace
from app.services.orchestrator_service import OrchestratorService
from app.services.place_service import PlaceService
from app.services.profile_service import InMemoryProfileService
from app.services.request_service import RequestService
from app.services.trace import TraceService
from app.wiring import (
    wire_requests_controller,
    wire_users_controller,
    wire_places_controller,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Wire controllers to services at startup."""
    if SUPABASE_URL:
        import app.services.marketplace as marketplace_module
        marketplace = marketplace_module
    else:
        marketplace = InMemoryMarketplace()

    trace_service = TraceService()
    request_service = RequestService(marketplace)
    orchestrator_service = OrchestratorService(
        marketplace=marketplace,
        trace_service=trace_service,
    )
    auth_service = AnonymousAuthService()
    profile_service = InMemoryProfileService()

    wire_requests_controller(
        marketplace=marketplace,
        trace_service=trace_service,
        request_service=request_service,
        orchestrator_service=orchestrator_service,
    )
    wire_users_controller(
        auth_service=auth_service,
        profile_service=profile_service,
    )

    # PlaceService uses location_service from location API module for user location
    place_service = PlaceService(
        location_service=location.location_service,
        marketplace=marketplace,
    )
    wire_places_controller(place_service=place_service)

    # Store place_service on orchestrator so it can cache places after crawling
    orchestrator_service.place_service = place_service

    yield


app = FastAPI(title="LocalBid API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(requests.router)
app.include_router(offers.router)
app.include_router(providers.router)
app.include_router(users.router)
app.include_router(places.router)
app.include_router(location.router)


@app.get("/")
def root():
    """Root redirects to docs; use /health for liveness."""
    return {
        "message": "LocalBid API",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
