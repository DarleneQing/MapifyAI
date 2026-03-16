/**
 * Request & SSE types — search, payloads, stream events.
 * Align with controller-frontend-contract.md §10.
 */
import type { LatLng, UserPreferences } from "./common";
import type { PlaceSummary } from "./place";

export interface CreateRequestPayload {
  query?: string;
  raw_input?: string;
  location: LatLng;
  preferences?: UserPreferences | null;
  language?: string;
}

export interface SubmitOfferBody {
  request_id: string;
  price: number;
  eta_minutes: number;
  message?: string | null;
}

export interface StructuredRequest {
  id: string;
  raw_input: string;
  category: string;
  requested_time: string;
  location: LatLng;
  radius_km: number;
  constraints: Record<string, unknown>;
  status: "pending" | "open" | "closed" | string;
  created_at: string | null;
}

export interface RequestWithResults {
  request: StructuredRequest;
  results: PlaceSummary[];
}

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
