/**
 * Provider types — GET /api/providers.
 */
import type { LatLng } from "./common";

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
