/**
 * Profile & cold-start types — contract §5.
 */
export interface UserProfileWeights {
  price: number;
  distance: number;
  rating: number;
  popularity: number;
}

export interface UserProfile {
  user_id: string;
  persona: string;
  budget_level: "low" | "medium" | "high" | string;
  distance_preference: string;
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
