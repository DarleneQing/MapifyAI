from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import requests, offers, providers, users, places, location
from app.config import SUPABASE_URL
from app.services.marketplace_memory import InMemoryMarketplace
from app.services.orchestrator_service import OrchestratorService
from app.services.request_service import RequestService
from app.services.trace import TraceService
from app.wiring import wire_requests_controller


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

    wire_requests_controller(
        marketplace=marketplace,
        trace_service=trace_service,
        request_service=request_service,
        orchestrator_service=orchestrator_service,
    )
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
