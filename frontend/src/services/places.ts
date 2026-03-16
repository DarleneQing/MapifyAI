/**
 * Places API — contract §4.
 */
import type { PlaceDetailResponse, PlaceReviewsPage } from "@/types";

const BASE = "/api";

export async function getPlaceDetail(
  placeId: string,
  requestId?: string
): Promise<PlaceDetailResponse> {
  const qs = requestId ? `?request_id=${requestId}` : "";
  const res = await fetch(`${BASE}/places/${placeId}${qs}`);
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
