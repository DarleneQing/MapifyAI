/**
 * TypeScript 类型契约 — 严格对齐 controller-frontend-contract 文档
 *
 * 字段命名与后端 pydantic 模型 & 前端对齐文档保持一致。
 * 更新时请同步 controller-frontend-contract.md 第 10 节。
 */

// ── Geo ──────────────────────────────────────
export interface LatLng {
  lat: number;
  lng: number;
}

// ── User Preferences (schemas.UserPreferences) ──
export interface UserPreferences {
  weight_price: number;   // default 0.33
  weight_distance: number; // default 0.33
  weight_rating: number;   // default 0.34
}

// ── Create Request Payload (schemas.CreateRequestPayload) ──
// NOTE: `stream` is a query parameter in the URL, but also accepted in body per contract
export interface CreateRequestPayload {
  query?: string;
  raw_input?: string;
  location: LatLng;
  preferences?: UserPreferences | null;
  language?: string; // e.g. "zh-CN" / "en-US"
}

// ── Submit Offer Body (offers controller SubmitOfferBody) ──
export interface SubmitOfferBody {
  request_id: string;
  price: number;
  eta_minutes: number;
  message?: string | null;
}

// ── Structured Request (schemas.StructuredRequest) ──
export interface StructuredRequest {
  id: string;
  raw_input: string;
  category: string;            // e.g. "haircut" | "massage"
  requested_time: string;      // ISO datetime
  location: LatLng;
  radius_km: number;
  constraints: Record<string, unknown>;
  status: "pending" | "open" | "closed" | string;
  created_at: string | null;
}

// ── SBB Transit (contract §3 PlaceSummary.transit) ──
export type TransportType = "train" | "bus" | "tram" | "walk";

export interface TransitConnection {
  transport_type: TransportType;
  line?: string | null;
  departure_time?: string | null;
  arrival_time?: string | null;
  duration_minutes: number;
  from_stop?: string | null;
  to_stop?: string | null;
}

export interface TransitInfo {
  duration_minutes: number;
  transport_types: TransportType[];
  departure_time?: string | null;
  summary?: string | null;           // e.g. "22 min — Tram 4 → Bus 33"
  connections?: TransitConnection[] | null;
}

// ── Place Summary (列表 / 地图联动, contract §3) ──
export interface PlaceSummary {
  place_id: string;
  name: string;
  address: string;
  distance_km: number;
  price_level: "low" | "medium" | "high" | string;
  rating: number;
  rating_count: number;
  recommendation_score: number;
  status: "open_now" | "closing_soon" | "closed" | string;
  transit?: TransitInfo | null;
  reason_tags: string[];
  one_sentence_recommendation?: string | null;
  flash_deal?: FlashDeal | null;
  queue_status?: "low" | "medium" | "busy" | null;
  // legacy compat: some mock data may still use eta_minutes at top level
  eta_minutes?: number;
}

// ── Flash Deal (秒杀券 / 优惠券) ──
export interface FlashDeal {
  title: string;           // e.g. "50% Off Latte"
  discount: string;        // e.g. "-50%" or "CHF 5 off"
  expires_at: string;      // ISO datetime
  remaining?: number;      // slots left
}

// ── Request + Results (GET /api/requests/{id}, contract §2.2) ──
export interface RequestWithResults {
  request: StructuredRequest;
  results: PlaceSummary[];
}

// ── SSE Events (contract §2.1.2 / §2.3) ──
export interface ReviewFetchedItem {
  place_id: string;
  advantages: string[];
  disadvantages: string[];
}

export type RequestSseEvent =
  | { type: "intent_parsed";          request_id: string; intent: Record<string, unknown> }
  | { type: "stores_crawled";         request_id: string; store_count: number; results: PlaceSummary[] }
  | { type: "transit_computed";       request_id: string; results: PlaceSummary[] }
  | { type: "reviews_fetched";        request_id: string; reviews: ReviewFetchedItem[] }
  | { type: "scores_computed";        request_id: string; results: PlaceSummary[] }
  | { type: "recommendations_ready";  request_id: string; results: PlaceSummary[] }
  | { type: "completed";             request_id: string; results: PlaceSummary[] };

// ── Place Detail (GET /api/places/{place_id}, contract §4.1) ──
export interface OpeningHoursToday {
  today_open: string;
  today_close: string;
  is_open_now: boolean;
}

export interface PlaceBasic {
  place_id: string;
  name: string;
  address: string;
  phone?: string | null;
  website?: string | null;
  location: LatLng;
  rating: number;
  rating_count: number;
  price_level: "low" | "medium" | "high" | string;
  status: "open_now" | "closing_soon" | "closed" | string;
  opening_hours?: OpeningHoursToday | null;
  social_profiles?: Record<string, string> | null;
  popular_times?: Record<string, number[]> | null;
  detailed_characteristics?: string[] | null;
  images?: string[] | null;
}

export interface ReviewSummary {
  advantages: string[];
  disadvantages: string[];
  star_reasons: Record<string, string[]>;
}

export type RatingDistribution = Record<string, number>;

export interface QuestionAndAnswer {
  question: string;
  answer: string;
}

export interface CustomerUpdate {
  text: string;
  language: string;
}

export interface PlaceDetail {
  place: PlaceBasic;
  review_summary: ReviewSummary;
  rating_distribution: RatingDistribution;
  questions_and_answers?: QuestionAndAnswer[] | null;
  customer_updates?: CustomerUpdate[] | null;
  recommendation_reasons: string[];
}

export interface PlaceDetailResponse {
  request_id: string | null;
  detail: PlaceDetail;
}

// ── Reviews (GET /api/places/{place_id}/reviews, contract §4.2) ──
export interface PlaceReview {
  author_name: string;
  rating: number;
  text: string;
  time: string;       // ISO datetime
  language: string;
}

export interface PlaceReviewsPage {
  place_id: string;
  page: number;
  page_size: number;
  total: number;
  reviews: PlaceReview[];
}

// ── User Profile & Cold Start (contract §5) ──
export interface UserProfileWeights {
  price: number;
  distance: number;
  rating: number;
  popularity: number;
}

export interface UserProfile {
  user_id: string;
  persona: string;                // e.g. "student_saver" / "family_with_kids"
  budget_level: "low" | "medium" | "high" | string;
  distance_preference: string;    // e.g. "nearby_first"
  has_kids: boolean;
  needs_wheelchair_access: boolean;
  weights: UserProfileWeights;
  created_at: string;
  updated_at: string;
}

export interface ColdStartSurveyPayload {
  budget_level: "low" | "medium" | "high" | string;
  distance_preference: string;
  priority: string;
  persona: string;
  has_kids: boolean;
  needs_wheelchair_access: boolean;
}

export interface ProfileResponse {
  profile: UserProfile;
}

// ── Offers (contract §6) ──
export interface OfferSlot {
  from: string;  // ISO datetime
  to: string;    // ISO datetime
}

export interface Offer {
  id: string;
  request_id: string;
  provider_id: string;
  price: number;
  currency: string;
  eta_minutes: number;
  slot: OfferSlot;
  status: string;   // "pending" | "accepted" | ...
}

export interface OffersResponse {
  request_id: string;
  offers: Offer[];
}

export type OfferSseEvent =
  | { type: "offer_created"; offer: Offer }
  | { type: "offer_updated"; offer: Offer };

// ── Providers (GET /api/providers, contract & schemas.Provider) ──
export interface Provider {
  id: string;
  name: string;
  category: string;
  location: LatLng;
  address: string;
  rating: number;
  review_count: number;
  price_range: string;
  distance_km?: number | null;
}

// ── Debug / Trace (GET /api/traces/{trace_id}, contract §7) ──
export interface TraceGraphNode {
  id: string;
  type: string;
}

export interface TraceGraphEdge {
  from: string;
  to: string;
}

export interface TraceStepView {
  agent_name: string;
  status: string;
  duration_ms: number;
  input_summary: string;
  output_summary: string;
}

export interface TraceResponse {
  trace_id: string;
  request_id: string;
  graph: {
    nodes: TraceGraphNode[];
    edges: TraceGraphEdge[];
  };
  steps: TraceStepView[];
  created_at: string;
}

// ── Privacy (GET /api/meta/privacy, contract §8) ──
export interface PrivacyPermission {
  name: string;
  description: string;
  required: boolean;
}

export interface PrivacyMeta {
  permissions: PrivacyPermission[];
  data_collected: string[];
  data_not_collected: string[];
}

// ── Validation Error (OpenAPI HTTPValidationError) ──
export interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
  input?: unknown;
  ctx?: Record<string, unknown>;
}

export interface HTTPValidationError {
  detail: ValidationErrorItem[];
}
