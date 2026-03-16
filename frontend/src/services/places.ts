/**
 * Places API — contract §4.
 */
import type { PlaceDetailResponse, PlaceReviewsPage } from "@/types";

const BASE = "/api";

export async function getPlaceDetail(
  placeId: string,
  requestId?: string,
  options?: { ratingMode?: "apify_raw" | "review_pipeline" }
): Promise<PlaceDetailResponse> {
  const params = new URLSearchParams();
  if (requestId) params.set("request_id", requestId);
  if (options?.ratingMode) params.set("rating_mode", options.ratingMode);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";
  const res = await fetch(`${BASE}/places/${placeId}${suffix}`);
  if (!res.ok) throw new Error(`GET /places/${placeId} failed: ${res.status}`);
  return res.json();
}

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
