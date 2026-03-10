from pydantic import BaseModel
from datetime import datetime
from typing import Any


# ---------------------------------------------------------------------------
# Shared geo primitive
# ---------------------------------------------------------------------------

class LatLng(BaseModel):
    lat: float
    lng: float


# ---------------------------------------------------------------------------
# Core domain models
# ---------------------------------------------------------------------------

class StructuredRequest(BaseModel):
    id: str
    raw_input: str
    category: str               # e.g. "haircut", "massage", "repair"
    requested_time: datetime
    location: LatLng
    radius_km: float = 5.0
    constraints: dict[str, Any] = {}   # {"max_price": 80, "language": "en", ...}
    status: str = "pending"     # "pending" | "open" | "closed"
    created_at: datetime | None = None


class OpeningHours(BaseModel):
    mon: str | None = None      # "09:00-18:00" or None if closed
    tue: str | None = None
    wed: str | None = None
    thu: str | None = None
    fri: str | None = None
    sat: str | None = None
    sun: str | None = None


class Provider(BaseModel):
    id: str
    name: str
    category: str
    location: LatLng
    address: str
    rating: float               # 0.0 – 5.0
    review_count: int = 0
    price_range: str            # e.g. "CHF 30–60"
    opening_hours: OpeningHours = OpeningHours()
    website_url: str | None = None
    google_maps_url: str | None = None
    distance_km: float | None = None    # computed at query time, not stored
    reviews: list[dict] | None = None   # mock reviews for summarizer


class Offer(BaseModel):
    id: str
    request_id: str
    provider_id: str
    price: float
    eta_minutes: int
    slot_time: datetime
    notes: str | None = None
    score: float | None = None
    score_breakdown: dict[str, float] | None = None  # {"price": 0.4, "distance": 0.3, ...}
    reasons: list[str] | None = None                 # Top-3 explanation strings
    time_label: str | None = None                    # "closes in 20 min — hurry"
    created_at: datetime | None = None


class UserPreferences(BaseModel):
    weight_price: float = 0.33
    weight_distance: float = 0.33
    weight_rating: float = 0.34


# ---------------------------------------------------------------------------
# Agent trace (US-13)
# ---------------------------------------------------------------------------

class TraceStep(BaseModel):
    agent: str
    input: dict[str, Any]
    output: dict[str, Any]
    duration_ms: int | None = None


class AgentTrace(BaseModel):
    request_id: str
    steps: list[TraceStep] = []
    total_duration_ms: int | None = None


# ---------------------------------------------------------------------------
# API request/response wrappers
# ---------------------------------------------------------------------------

class CreateRequestPayload(BaseModel):
    raw_input: str
    location: LatLng
    preferences: UserPreferences | None = None


class SubmitOfferPayload(BaseModel):
    request_id: str
    provider_id: str
    price: float
    eta_minutes: int
    slot_time: datetime
    notes: str | None = None


class RankedOffersResponse(BaseModel):
    request: StructuredRequest
    offers: list[Offer]
    trace: AgentTrace | None = None


# ---------------------------------------------------------------------------
# Device-scoped location (anonymous MVP)
# ---------------------------------------------------------------------------


class DeviceLocationPayload(BaseModel):
    lat: float
    lng: float
    accuracy_m: float | None = None
    timestamp: datetime | None = None


class DeviceLocation(BaseModel):
    device_id: str
    lat: float
    lng: float
    accuracy_m: float | None = None
    updated_at: datetime
