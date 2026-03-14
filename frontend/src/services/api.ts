/**
 * API 服务层 — 严格对齐 controller-frontend-contract 文档
 *
 * 路由对应关系（contract §10 汇总）：
 *   POST   /api/requests/                         → createSearchRequest
 *   GET    /api/requests/{request_id}             → getRequest
 *   GET    /api/requests/{request_id}/stream      → subscribeRequestStream (SSE)
 *   GET    /api/requests/{request_id}/offers      → getOffers
 *   GET    /api/requests/{request_id}/offers/stream → subscribeOffersStream (SSE)
 *   POST   /api/offers/                           → submitOffer
 *   PATCH  /api/offers/{offer_id}                 → updateOffer
 *   GET    /api/providers/                        → listProviders
 *   GET    /api/providers/{provider_id}           → getProvider
 *   GET    /api/places/{place_id}                 → getPlaceDetail
 *   GET    /api/places/{place_id}/reviews         → getPlaceReviews
 *   POST   /api/profile/cold-start-survey         → submitColdStartSurvey
 *   GET    /api/profile                           → getProfile
 *   PUT    /api/profile                           → updateProfile
 *   PUT    /api/location/current                  → putDeviceLocation
 *   GET    /api/location/current                  → getDeviceLocation
 *   GET    /api/traces/{trace_id}                 → getTrace
 *   GET    /api/meta/privacy                      → getPrivacyMeta
 *   GET    /health                                → healthCheck
 */
import type {
  LatLng,
  CreateRequestPayload,
  SubmitOfferBody,
  UserPreferences,
  PlaceDetailResponse,
  PlaceReviewsPage,
  RequestWithResults,
  OffersResponse,
  TraceResponse,
  ProfileResponse,
  Provider,
  ColdStartSurveyPayload,
  PrivacyMeta,
  RequestSseEvent,
  OfferSseEvent,
} from "@/types";

const BASE = "/api";

const FALLBACK_PRIVACY_META: PrivacyMeta = {
  permissions: [
    {
      name: "Location",
      description: "Used to rank nearby providers and compute travel distance.",
      required: true,
    },
  ],
  data_collected: ["Approximate device location", "Search queries", "Preference weights"],
  data_not_collected: ["Payment card numbers", "Precise background tracking history"],
};

function mapPreferencesToProfileResponse(data: {
  id?: string;
  preferences?: Partial<UserPreferences>;
}): ProfileResponse {
  const preferences = data.preferences || {};

  return {
    profile: {
      user_id: data.id || "anonymous",
      persona: "anonymous",
      budget_level: "medium",
      distance_preference: "balanced",
      has_kids: false,
      needs_wheelchair_access: false,
      weights: {
        price: preferences.weight_price ?? 0.33,
        distance: preferences.weight_distance ?? 0.33,
        rating: preferences.weight_rating ?? 0.34,
        popularity: 0,
      },
      created_at: new Date(0).toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

function mapAgentTraceToTraceResponse(trace: {
  request_id: string;
  steps?: Array<{ agent: string; duration_ms?: number | null; input?: unknown; output?: unknown }>;
}): TraceResponse {
  const steps = (trace.steps || []).map((step, index) => ({
    agent_name: step.agent,
    status: "completed",
    duration_ms: step.duration_ms ?? 0,
    input_summary: JSON.stringify(step.input ?? {}),
    output_summary: JSON.stringify(step.output ?? {}),
  }));

  return {
    trace_id: trace.request_id,
    request_id: trace.request_id,
    graph: {
      nodes: steps.map((step, index) => ({ id: `${index}`, type: step.agent_name })),
      edges: steps.slice(1).map((step, index) => ({ from: `${index}`, to: `${index + 1}` })),
    },
    steps,
    created_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────
// 1. Requests (contract §2)
// ─────────────────────────────────────────────

/**
 * POST /api/requests/?stream={bool}
 *
 * - stream=false (default): returns JSON { request, results }
 * - stream=true: returns SSE text/event-stream
 *
 * Returns raw Response so caller can handle both modes.
 */
export async function createSearchRequest(
  query: string,
  location: LatLng,
  options?: {
    stream?: boolean;
    language?: string;
    preferences?: UserPreferences | null;
  }
): Promise<Response> {
  const stream = options?.stream ?? false;
  const payload: CreateRequestPayload = {
    query,
    location,
    ...(options?.language ? { language: options.language } : {}),
    ...(options?.preferences ? { preferences: options.preferences } : {}),
  };

  return fetch(`${BASE}/requests/?stream=${stream}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(stream ? { Accept: "text/event-stream" } : {}),
    },
    body: JSON.stringify(payload),
  });
}

/** GET /api/requests/{request_id} — contract §2.2 */
export async function getRequest(
  requestId: string
): Promise<RequestWithResults> {
  const res = await fetch(`${BASE}/requests/${requestId}`);
  if (!res.ok) throw new Error(`GET /requests/${requestId} failed: ${res.status}`);
  return res.json();
}

/**
 * GET /api/requests/{request_id}/stream — contract §2.3
 * Returns EventSource-compatible SSE stream.
 */
export function subscribeRequestStream(
  requestId: string,
  onEvent: (event: RequestSseEvent) => void,
  onError?: (err: Event) => void
): EventSource {
  const es = new EventSource(`${BASE}/requests/${requestId}/stream`);

  const eventTypes = [
    "intent_parsed",
    "stores_crawled",
    "transit_computed",
    "reviews_fetched",
    "scores_computed",
    "recommendations_ready",
    "completed",
  ] as const;

  eventTypes.forEach((type) => {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as RequestSseEvent;
        onEvent(data);
      } catch {
        console.warn(`Failed to parse SSE event: ${type}`, e.data);
      }
    });
  });

  if (onError) es.onerror = onError;

  return es;
}

// ─────────────────────────────────────────────
// 2. Places (contract §4)
// ─────────────────────────────────────────────

/** GET /api/places/{place_id}?request_id={optional} — contract §4.1 */
export async function getPlaceDetail(
  placeId: string,
  requestId?: string
): Promise<PlaceDetailResponse> {
  const qs = requestId ? `?request_id=${requestId}` : "";
  const res = await fetch(`${BASE}/places/${placeId}${qs}`);
  if (!res.ok) throw new Error(`GET /places/${placeId} failed: ${res.status}`);
  return res.json();
}

/** GET /api/places/{place_id}/reviews?page=&page_size=&sort= — contract §4.2 */
export async function getPlaceReviews(
  placeId: string,
  page = 1,
  pageSize = 20,
  sort: "newest" | "highest_rating" | "lowest_rating" = "newest"
): Promise<PlaceReviewsPage> {
  const res = await fetch(
    `${BASE}/places/${placeId}/reviews?page=${page}&page_size=${pageSize}&sort=${sort}`
  );
  if (!res.ok) throw new Error(`GET /places/${placeId}/reviews failed: ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────
// 3. Providers (backend providers controller)
// ─────────────────────────────────────────────

/** GET /api/providers/?category=&lat=&lng=&radius_km= */
export async function listProviders(options?: {
  category?: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
}): Promise<Provider[]> {
  const params = new URLSearchParams();
  if (options?.category) params.set("category", options.category);
  if (options?.lat != null) params.set("lat", String(options.lat));
  if (options?.lng != null) params.set("lng", String(options.lng));
  if (options?.radius_km != null) params.set("radius_km", String(options.radius_km));

  const qs = params.toString() ? `?${params.toString()}` : "";
  const res = await fetch(`${BASE}/providers/${qs}`);
  if (!res.ok) throw new Error(`GET /providers failed: ${res.status}`);
  return res.json();
}

/** GET /api/providers/{provider_id} */
export async function getProvider(providerId: string): Promise<Provider> {
  const res = await fetch(`${BASE}/providers/${providerId}`);
  if (!res.ok) throw new Error(`GET /providers/${providerId} failed: ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────
// 4. Offers (contract §6)
// ─────────────────────────────────────────────

/** GET /api/requests/{request_id}/offers — contract §6.1 */
export async function getOffers(
  requestId: string
): Promise<OffersResponse> {
  const res = await fetch(`${BASE}/requests/${requestId}/offers`);
  if (!res.ok) throw new Error(`GET /requests/${requestId}/offers failed: ${res.status}`);
  return res.json();
}

/** POST /api/offers/ — backend offers controller */
export async function submitOffer(payload: SubmitOfferBody) {
  const res = await fetch(`${BASE}/offers/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`POST /offers failed: ${res.status}`);
  return res.json();
}

/** PATCH /api/offers/{offer_id} */
export async function updateOffer(
  offerId: string,
  payload: Record<string, unknown>
) {
  const res = await fetch(`${BASE}/offers/${offerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`PATCH /offers/${offerId} failed: ${res.status}`);
  return res.json();
}

/**
 * GET /api/requests/{request_id}/offers/stream — contract §6.2
 * SSE for real-time offer updates.
 */
export function subscribeOffersStream(
  requestId: string,
  onEvent: (event: OfferSseEvent) => void,
  onError?: (err: Event) => void
): EventSource {
  const es = new EventSource(`${BASE}/requests/${requestId}/offers/stream`);

  (["offer_created", "offer_updated"] as const).forEach((type) => {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as OfferSseEvent;
        onEvent(data);
      } catch {
        console.warn(`Failed to parse SSE event: ${type}`, e.data);
      }
    });
  });

  if (onError) es.onerror = onError;

  return es;
}

// ─────────────────────────────────────────────
// 5. Profile & Personalization (contract §5)
// ─────────────────────────────────────────────

/** POST /api/profile/cold-start-survey — contract §5.1 */
export async function submitColdStartSurvey(
  payload: ColdStartSurveyPayload
): Promise<ProfileResponse> {
  return updateProfile({
    budget_level: payload.budget_level,
    distance_preference: payload.distance_preference,
    persona: payload.persona,
    has_kids: payload.has_kids,
    needs_wheelchair_access: payload.needs_wheelchair_access,
    weights: {
      price: payload.priority === "price" ? 1 : 0.33,
      distance: payload.priority === "distance" ? 1 : 0.33,
      rating: payload.priority === "rating" ? 1 : 0.34,
      popularity: 0,
    },
  });
}

/** GET /api/profile — contract §5.2 */
export async function getProfile(): Promise<ProfileResponse> {
  const res = await fetch(`${BASE}/users/me`);
  if (!res.ok) throw new Error(`GET /users/me failed: ${res.status}`);
  const data = await res.json();
  return mapPreferencesToProfileResponse(data);
}

/**
 * PUT /api/profile — contract §5.2
 * Supports partial update (persona, weights, etc.)
 */
export async function updateProfile(
  payload: Partial<{
    persona: string;
    budget_level: string;
    distance_preference: string;
    has_kids: boolean;
    needs_wheelchair_access: boolean;
    weights: {
      price: number;
      distance: number;
      rating: number;
      popularity: number;
    };
  }>
): Promise<ProfileResponse> {
  const weights = payload.weights;
  const prefs: UserPreferences = {
    weight_price: weights?.price ?? 0.33,
    weight_distance: weights?.distance ?? 0.33,
    weight_rating: weights?.rating ?? 0.34,
  };
  return updatePreferences(prefs);
}

/**
 * @deprecated Use updateProfile() instead.
 * Kept for backward compat with Profile page that uses UserPreferences shape.
 * Internally maps weight_price/weight_distance/weight_rating → weights object.
 */
export async function updatePreferences(
  prefs: UserPreferences
): Promise<ProfileResponse> {
  const res = await fetch(`${BASE}/users/me/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error(`PUT /users/me/preferences failed: ${res.status}`);
  const data = await res.json();
  return mapPreferencesToProfileResponse({ preferences: data });
}

// ─────────────────────────────────────────────
// 6. Device Location (contract §9)
// ─────────────────────────────────────────────

export interface DeviceLocationPayload {
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  timestamp?: string | null;
}

export interface DeviceLocation {
  device_id: string;
  lat: number;
  lng: number;
  accuracy_m?: number | null;
  updated_at: string;
}

/** PUT /api/location/current?device_id=<id> — contract §9.2 */
export async function putDeviceLocation(
  deviceId: string,
  payload: DeviceLocationPayload
): Promise<DeviceLocation> {
  const res = await fetch(
    `${BASE}/location/current?device_id=${encodeURIComponent(deviceId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error(`PUT /location/current failed: ${res.status}`);
  return res.json();
}

/** GET /api/location/current?device_id=<id> — contract §9.2 */
export async function getDeviceLocation(
  deviceId: string
): Promise<DeviceLocation> {
  const res = await fetch(
    `${BASE}/location/current?device_id=${encodeURIComponent(deviceId)}`
  );
  if (!res.ok) throw new Error(`GET /location/current failed: ${res.status}`);
  return res.json();
}

// ─────────────────────────────────────────────
// 7. Debug / Trace (contract §7)
// ─────────────────────────────────────────────

/** GET /api/traces/{trace_id} — contract §7 */
export async function getTrace(
  traceId: string
): Promise<TraceResponse> {
  const res = await fetch(`${BASE}/requests/${traceId}/trace`);
  if (!res.ok) throw new Error(`GET /requests/${traceId}/trace failed: ${res.status}`);
  const data = await res.json();
  return mapAgentTraceToTraceResponse(data);
}

// ─────────────────────────────────────────────
// 8. Privacy (contract §8)
// ─────────────────────────────────────────────

/** GET /api/meta/privacy — contract §8 */
export async function getPrivacyMeta(): Promise<PrivacyMeta> {
  try {
    const res = await fetch(`${BASE}/meta/privacy`);
    if (!res.ok) return FALLBACK_PRIVACY_META;
    return res.json();
  } catch {
    return FALLBACK_PRIVACY_META;
  }
}

// ─────────────────────────────────────────────
// 9. Health
// ─────────────────────────────────────────────

/** GET /health */
export async function healthCheck(): Promise<unknown> {
  const res = await fetch("/health");
  if (!res.ok) throw new Error(`GET /health failed: ${res.status}`);
  return res.json();
}
