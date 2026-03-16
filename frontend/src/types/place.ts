/**
 * Place-related types — summary, detail, reviews, transit.
 * Align with controller-frontend-contract.md §10.
 */
import type { LatLng } from "./common";

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
  summary?: string | null;
  connections?: TransitConnection[] | null;
}

export interface FlashDeal {
  title: string;
  discount: string;
  expires_at: string;
  remaining?: number;
}

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
  /** Final LLM review summary paragraph (after ranking/scoring). Shown in place card and detail. */
  review_summary_text?: string | null;
  flash_deal?: FlashDeal | null;
  queue_status?: "low" | "medium" | "busy" | null;
  eta_minutes?: number;
}

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

export interface PlaceReview {
  author_name: string;
  rating: number;
  text: string;
  time: string;
  language: string;
}

export interface PlaceReviewsPage {
  place_id: string;
  page: number;
  page_size: number;
  total: number;
  reviews: PlaceReview[];
}
