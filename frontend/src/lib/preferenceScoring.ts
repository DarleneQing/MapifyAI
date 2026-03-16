/**
 * Preference-based scoring & sorting for AI recommendations.
 * Uses UserPreferences from OnboardingSurvey to dynamically rank places.
 */
import type { PlaceSummary } from "@/types";
import type { UserPreferences } from "@/components/onboarding/OnboardingSurvey";

// Category tags mapped to mock place data for matching
const PLACE_CATEGORIES: Record<string, string[]> = {
  p1: ["coffee"],
  p2: ["coffee", "dining"],
  p3: ["bakery", "dining"],
  p4: ["coffee"],
  p5: ["dining"],
  p6: ["coffee"],
};

// Vibe tags mapped to mock place data
const PLACE_VIBES: Record<string, string[]> = {
  p1: ["quiet", "trendy"],
  p2: ["quiet", "cozy"],
  p3: ["lively", "family"],
  p4: ["quiet", "pet"],
  p5: ["luxury", "outdoor"],
  p6: ["quiet", "trendy"],
};

/**
 * Score a single place against user preferences.
 * Returns a 0-1 normalized score.
 */
export function scorePlace(place: PlaceSummary, prefs: UserPreferences): number {
  // Weights: price and rating are 1-5 scale, distance is 1-30 km
  // Normalize to equal weighting
  const wPrice = prefs.priorities.price / 5;
  const wDist = 1 - (prefs.priorities.distance / 30); // shorter preference = higher weight on closeness
  const wRating = prefs.priorities.rating / 5;
  const total = wPrice + wDist + wRating;
  if (total === 0) return place.recommendation_score;

  // Price score: currently treat all places as neutral since backend exposes
  // free-form price strings (e.g. "$10–20", "CHF 30–60") without discrete levels.
  const priceScore = 1;

  // Distance score: use priorities.distance as preferred max range
  const maxDist = Math.max(prefs.priorities.distance, prefs.maxDistance);
  const distScore = place.distance_km <= maxDist
    ? 1 - (place.distance_km / maxDist) * 0.5
    : Math.max(0, 0.5 - (place.distance_km - maxDist) / 10);

  // Rating score: normalized to 0-1
  const ratingScore = place.rating / 5;

  // Base weighted score
  let score = wPrice * priceScore + wDist * distScore + wRating * ratingScore;

  // Category bonus: +15% if place matches any preferred category
  const placeCategories = PLACE_CATEGORIES[place.place_id] || [];
  const categoryMatch = prefs.categories.some((c) => placeCategories.includes(c));
  if (categoryMatch) score += 0.15;

  // Vibe bonus: +10% per matching vibe (max +20%)
  const placeVibes = PLACE_VIBES[place.place_id] || [];
  const vibeMatches = prefs.vibes.filter((v) => placeVibes.includes(v)).length;
  score += Math.min(vibeMatches * 0.1, 0.2);

  return Math.min(1, Math.max(0, score));
}

/**
 * Sort places by personalized score (descending).
 * Mutates the recommendation_score field for display.
 */
export function sortByPreferences(
  places: PlaceSummary[],
  prefs: UserPreferences | null
): PlaceSummary[] {
  if (!prefs) return places;

  return [...places]
    .map((p) => ({
      ...p,
      recommendation_score: parseFloat(scorePlace(p, prefs).toFixed(2)),
    }))
    .sort((a, b) => b.recommendation_score - a.recommendation_score);
}

/**
 * Filter places that exceed maxDistance (soft filter — deprioritize, don't remove).
 */
export function filterByDistance(
  places: PlaceSummary[],
  maxKm: number
): { nearby: PlaceSummary[]; farther: PlaceSummary[] } {
  const nearby = places.filter((p) => p.distance_km <= maxKm);
  const farther = places.filter((p) => p.distance_km > maxKm);
  return { nearby, farther };
}
