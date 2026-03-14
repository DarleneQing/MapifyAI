from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

from fastapi import FastAPI, APIRouter, Query, Path, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field


app = FastAPI(title="IntelligentLocalBid API", version="1.0.0")
router = APIRouter(prefix="/api")


class IntentType(str, Enum):
    search = "search"
    details = "details"


class LocationType(str, Enum):
    current_gps = "current_gps"
    named_place = "named_place"
    coordinates = "coordinates"


class RequestStatus(str, Enum):
    created = "created"
    in_progress = "in_progress"
    completed = "completed"
    expired = "expired"


class PriceLevel(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"


class PlaceStatus(str, Enum):
    open_now = "open_now"
    closing_soon = "closing_soon"
    closed = "closed"


class TransportType(str, Enum):
    train = "train"
    bus = "bus"
    tram = "tram"
    walk = "walk"
    mixed = "mixed"


class OfferStatus(str, Enum):
    pending = "pending"
    accepted = "accepted"
    rejected = "rejected"
    expired = "expired"


class TransitConnection(BaseModel):
    transport_type: TransportType
    line: Optional[str] = None
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    duration_minutes: int
    from_stop: Optional[str] = None
    to_stop: Optional[str] = None


class TransitInfo(BaseModel):
    duration_minutes: int
    transport_types: List[TransportType] = [TransportType.tram]
    departure_time: Optional[str] = None
    summary: Optional[str] = None
    connections: Optional[List[TransitConnection]] = None


class IntentLocation(BaseModel):
    type: LocationType = LocationType.current_gps
    lat: Optional[float] = None
    lng: Optional[float] = None
    radius_km: Optional[float] = Field(default=3.0, ge=0)


class IntentTimeWindow(BaseModel):
    type: str = "today"
    from_time: str = Field("now", alias="from")
    to: Optional[str] = None


class Intent(BaseModel):
    intent_type: IntentType = IntentType.search
    service_category: Optional[str] = None
    location: Optional[IntentLocation] = None
    time_window: Optional[IntentTimeWindow] = None
    budget_level: Optional[PriceLevel] = None
    special_requirements: Optional[List[str]] = None


class RequestModel(BaseModel):
    id: str
    user_id: Optional[str] = None
    intent: Intent
    status: RequestStatus = RequestStatus.created
    created_at: datetime
    completed_at: Optional[datetime] = None


class PlaceSummary(BaseModel):
    place_id: str
    name: str
    address: Optional[str] = None
    distance_km: Optional[float] = None
    price_level: Optional[PriceLevel] = None
    rating: Optional[float] = None
    rating_count: Optional[int] = None
    recommendation_score: Optional[float] = None
    status: Optional[PlaceStatus] = None
    transit: Optional[TransitInfo] = None
    reason_tags: Optional[List[str]] = None
    one_sentence_recommendation: Optional[str] = None


class OpeningHours(BaseModel):
    today_open: Optional[str] = None
    today_close: Optional[str] = None
    is_open_now: Optional[bool] = None


class PlaceBasic(BaseModel):
    place_id: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    location: Optional[Dict[str, float]] = None
    rating: Optional[float] = None
    rating_count: Optional[int] = None
    price_level: Optional[PriceLevel] = None
    status: Optional[PlaceStatus] = None
    opening_hours: Optional[OpeningHours] = None


class StarReasons(BaseModel):
    five_star: Optional[List[str]] = None
    one_star: Optional[List[str]] = None


class ReviewSummary(BaseModel):
    advantages: Optional[List[str]] = None
    disadvantages: Optional[List[str]] = None
    star_reasons: Optional[StarReasons] = None


class PlaceDetail(BaseModel):
    place: PlaceBasic
    review_summary: Optional[ReviewSummary] = None
    rating_distribution: Optional[Dict[str, int]] = None
    recommendation_reasons: Optional[List[str]] = None


class Weights(BaseModel):
    price: float = 0.3
    distance: float = 0.3
    rating: float = 0.3
    popularity: float = 0.1


class UserProfile(BaseModel):
    user_id: str
    persona: Optional[str] = None
    budget_level: Optional[PriceLevel] = None
    distance_preference: Optional[str] = None
    has_kids: Optional[bool] = None
    needs_wheelchair_access: Optional[bool] = None
    weights: Optional[Weights] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class OfferSlot(BaseModel):
    from_: datetime = Field(..., alias="from")
    to: datetime


class Offer(BaseModel):
    id: str
    request_id: str
    provider_id: str
    price: float
    currency: str = "CHF"
    eta_minutes: Optional[int] = None
    slot: Optional[OfferSlot] = None
    status: OfferStatus = OfferStatus.pending


class CreateRequestBody(BaseModel):
    query: str
    location: Optional[Dict[str, float]] = None
    language: Optional[str] = "zh-CN"
    stream: Optional[bool] = False


class CreateRequestResponse(BaseModel):
    request: RequestModel
    results: List[PlaceSummary] = []


class RequestWithResults(BaseModel):
    request: RequestModel
    results: List[PlaceSummary]


class PlaceDetailResponse(BaseModel):
    request_id: Optional[str] = None
    detail: PlaceDetail


class ReviewItem(BaseModel):
    author_name: Optional[str] = None
    rating: Optional[int] = None
    text: Optional[str] = None
    time: Optional[datetime] = None
    language: Optional[str] = None


class PaginatedReviews(BaseModel):
    place_id: str
    page: int
    page_size: int
    total: int
    reviews: List[ReviewItem]


class ColdStartSurveyBody(BaseModel):
    budget_level: Optional[PriceLevel] = None
    distance_preference: Optional[str] = None
    priority: Optional[str] = None
    persona: Optional[str] = None
    has_kids: Optional[bool] = None
    needs_wheelchair_access: Optional[bool] = None


class OffersListResponse(BaseModel):
    request_id: str
    offers: List[Offer]


class AgentStep(BaseModel):
    agent_name: str
    status: str = "success"
    duration_ms: int = 0
    input_summary: Optional[str] = None
    output_summary: Optional[str] = None


class AgentGraphNode(BaseModel):
    id: str
    type: str = "agent"


class AgentGraphEdge(BaseModel):
    from_node: str = Field(..., alias="from")
    to: str


class AgentGraph(BaseModel):
    nodes: List[AgentGraphNode]
    edges: List[AgentGraphEdge]


class AgentTraceResponse(BaseModel):
    trace_id: str
    request_id: str
    graph: AgentGraph
    steps: List[AgentStep]
    created_at: Optional[datetime] = None


class PrivacyMeta(BaseModel):
    permissions: List[Dict[str, Any]]
    data_collected: List[str]
    data_not_collected: List[str]


async def request_sse_generator(request_id: str):
    """SSE event sequence for the 6-agent pipeline:
    1. event: intent_parsed       — Input Agent completed
    2. event: stores_crawled      — Crawling Agent Sub-1 (Apify store search) completed
    3. event: transit_computed    — Crawling Agent Sub-2 (Swiss Transit ETA) completed
    4. event: reviews_fetched     — Review Agent (Apify reviews + LLM summary) completed
    5. event: scores_computed     — Evaluation Agent completed
    6. event: recommendations_ready — Orchestrator Agent completed
    7. event: completed           — Output Agent completed, final results
    """
    yield "event: ping\ndata: {}\n\n"


async def offers_sse_generator(request_id: str):
    yield "event: ping\ndata: {}\n\n"


@router.post("/requests", response_model=CreateRequestResponse, status_code=201)
async def create_request(body: CreateRequestBody = Body(...)):
    dummy_request = RequestModel(
        id="req_dummy",
        user_id=None,
        intent=Intent(intent_type=IntentType.search),
        status=RequestStatus.created,
        created_at=datetime.utcnow(),
    )
    return CreateRequestResponse(request=dummy_request, results=[])


@router.get("/requests/{request_id}", response_model=RequestWithResults)
async def get_request(request_id: str = Path(...)):
    dummy_request = RequestModel(
        id=request_id,
        user_id=None,
        intent=Intent(intent_type=IntentType.search),
        status=RequestStatus.in_progress,
        created_at=datetime.utcnow(),
    )
    return RequestWithResults(request=dummy_request, results=[])


@router.get("/requests/{request_id}/stream")
async def stream_request_results(request_id: str = Path(...)):
    return StreamingResponse(
        request_sse_generator(request_id),
        media_type="text/event-stream",
    )


@router.get("/places/{place_id}", response_model=PlaceDetailResponse)
async def get_place_detail(
    place_id: str = Path(...),
    request_id: Optional[str] = Query(None),
):
    dummy_place = PlaceBasic(place_id=place_id, name="Dummy Place")
    detail = PlaceDetail(place=dummy_place)
    return PlaceDetailResponse(request_id=request_id, detail=detail)


@router.get("/places/{place_id}/reviews", response_model=PaginatedReviews)
async def get_place_reviews(
    place_id: str = Path(...),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    sort: str = Query("newest"),
):
    return PaginatedReviews(
        place_id=place_id,
        page=page,
        page_size=page_size,
        total=0,
        reviews=[],
    )


@router.post("/profile/cold-start-survey", response_model=Dict[str, UserProfile])
async def submit_cold_start_survey(body: ColdStartSurveyBody):
    dummy_profile = UserProfile(user_id="u_dummy")
    return {"profile": dummy_profile}


@router.get("/profile", response_model=Dict[str, Optional[UserProfile]])
async def get_profile():
    return {"profile": None}


@router.put("/profile", response_model=Dict[str, UserProfile])
async def update_profile(profile: UserProfile):
    return {"profile": profile}


@router.post("/requests/{request_id}/offers", response_model=Dict[str, Offer], status_code=201)
async def create_offer(request_id: str, offer_body: Offer):
    return {"offer": offer_body}


@router.get("/requests/{request_id}/offers", response_model=OffersListResponse)
async def list_offers(request_id: str):
    return OffersListResponse(request_id=request_id, offers=[])


@router.get("/requests/{request_id}/offers/stream")
async def stream_offers(request_id: str):
    return StreamingResponse(
        offers_sse_generator(request_id),
        media_type="text/event-stream",
    )


@router.get("/traces/{trace_id}", response_model=AgentTraceResponse)
async def get_agent_trace(trace_id: str = Path(...)):
    dummy_graph = AgentGraph(
        nodes=[
            AgentGraphNode(id="input_agent"),
            AgentGraphNode(id="crawling_agent_search"),
            AgentGraphNode(id="crawling_agent_transit"),
            AgentGraphNode(id="evaluation_agent"),
            AgentGraphNode(id="review_agent"),
            AgentGraphNode(id="orchestrator_agent"),
            AgentGraphNode(id="output_agent_ranking"),
            AgentGraphNode(id="output_agent_recommendation"),
        ],
        edges=[
            AgentGraphEdge(**{"from": "input_agent", "to": "crawling_agent_search"}),
            AgentGraphEdge(**{"from": "input_agent", "to": "review_agent"}),
            AgentGraphEdge(**{"from": "crawling_agent_search", "to": "crawling_agent_transit"}),
            AgentGraphEdge(**{"from": "crawling_agent_transit", "to": "evaluation_agent"}),
            AgentGraphEdge(**{"from": "evaluation_agent", "to": "orchestrator_agent"}),
            AgentGraphEdge(**{"from": "review_agent", "to": "orchestrator_agent"}),
            AgentGraphEdge(**{"from": "orchestrator_agent", "to": "output_agent_ranking"}),
            AgentGraphEdge(**{"from": "orchestrator_agent", "to": "output_agent_recommendation"}),
        ],
    )
    return AgentTraceResponse(
        trace_id=trace_id,
        request_id="req_dummy",
        graph=dummy_graph,
        steps=[],
        created_at=datetime.utcnow(),
    )


@router.get("/meta/privacy", response_model=PrivacyMeta)
async def get_privacy_meta():
    return PrivacyMeta(
        permissions=[
            {
                "name": "location",
                "description": "用于推荐离你最近、当前营业的商家",
                "required": True,
            }
        ],
        data_collected=[
            "偏好配置（预算、权重等）",
            "画像标签（学生 / 上班族等）",
            "基础日志（Request id, trace id, 错误码）",
        ],
        data_not_collected=[
            "敏感个人身份信息",
            "精确历史轨迹（MVP 不存储）",
        ],
    )


app.include_router(router)

