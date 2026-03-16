/**
 * Profile API — contract §5.
 */
import type {
  UserPreferences,
  ProfileResponse,
  ColdStartSurveyPayload,
} from "@/types";

const BASE = "/api";

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

export { mapPreferencesToProfileResponse };

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

export async function getProfile(): Promise<ProfileResponse> {
  const res = await fetch(`${BASE}/users/me`);
  if (!res.ok) throw new Error(`GET /users/me failed: ${res.status}`);
  const data = await res.json();
  return mapPreferencesToProfileResponse(data);
}

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
