/**
 * Common types — Geo, preferences, validation.
 * Align with controller-frontend-contract.md §10.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface UserPreferences {
  weight_price: number;   // default 0.33
  weight_distance: number; // default 0.33
  weight_rating: number;   // default 0.34
}

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
