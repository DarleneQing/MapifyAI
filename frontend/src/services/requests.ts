/**
 * Requests API — contract §2.
 */
import type {
  LatLng,
  CreateRequestPayload,
  UserPreferences,
  RequestWithResults,
  RequestSseEvent,
} from "@/types";
import { API_BASE } from "./config";

export async function createSearchRequest(
  query: string,
  location: LatLng,
  options?: {
    stream?: boolean;
    language?: string;
    preferences?: UserPreferences | null;
    signal?: AbortSignal;
  }
): Promise<Response> {
  const stream = options?.stream ?? false;
  const payload: CreateRequestPayload = {
    query,
    location,
    ...(options?.language ? { language: options.language } : {}),
    ...(options?.preferences ? { preferences: options.preferences } : {}),
  };

  return fetch(`${API_BASE}/requests/?stream=${stream}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(stream ? { Accept: "text/event-stream" } : {}),
    },
    body: JSON.stringify(payload),
    ...(options?.signal ? { signal: options.signal } : {}),
  });
}

export async function getRequest(
  requestId: string
): Promise<RequestWithResults> {
  const res = await fetch(`${API_BASE}/requests/${requestId}`);
  if (!res.ok) throw new Error(`GET /requests/${requestId} failed: ${res.status}`);
  return res.json();
}

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
