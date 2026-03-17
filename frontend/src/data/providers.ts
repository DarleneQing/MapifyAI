/**
 * Zurich providers data — real crawled stores from backend seed.
 * Replaces mock merchants on Index and Explore.
 */
import zurichProvidersJson from "./zurich_providers.json";
import type { PlaceDetail as PlaceDetailType, PlaceBasic, PlaceReview, ReviewSummary, RatingDistribution } from "@/types";

export interface ZurichProvider {
  id: string;
  name: string;
  category: string;
  location: { lat: number; lng: number };
  address: string;
  rating: number;
  review_count: number;
  price_range: string;
  opening_hours: Record<string, string | null>;
  website_url: string | null;
  google_maps_url: string;
  images?: string[];
  reviews: unknown[];
}

const RAW = zurichProvidersJson as ZurichProvider[];

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function getTodayKey(): (typeof DAY_KEYS)[number] {
  const d = new Date();
  return DAY_KEYS[d.getDay()];
}

function parseTime(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Compute open_now | closing_soon | closed from opening_hours. */
function computeStatus(oh: Record<string, string | null> | undefined): "open_now" | "closing_soon" | "closed" {
  if (!oh) return "open_now";
  const today = getTodayKey();
  const range = oh[today];
  if (!range) return "closed";
  const [openStr, closeStr] = range.split("-");
  const openMin = parseTime(openStr?.trim() ?? "0");
  const closeMin = parseTime(closeStr?.trim() ?? "24:00");
  const now = new Date();
  const currentMin = now.getHours() * 60 + now.getMinutes();
  if (currentMin < openMin || currentMin >= closeMin) return "closed";
  const remaining = closeMin - currentMin;
  if (remaining <= 30) return "closing_soon";
  return "open_now";
}

function priceRangeToLevel(priceRange: string): string {
  if (!priceRange) return "$$";
  if (priceRange.includes("CHF") && priceRange.length < 15) return "$$";
  if (priceRange.includes("–") || priceRange.includes("-")) {
    const low = priceRange.replace(/\D/g, "");
    if (low.length > 0 && parseInt(low, 10) > 100) return "$$$";
  }
  return "$$";
}

/** Shape used by Index (map + sheet list). */
export interface IndexMerchant {
  id: string;
  name: string;
  category: string;
  rating: number;
  hasBidding: boolean;
  lat: number;
  lng: number;
  address: string;
  status: "open_now" | "closing_soon" | "closed";
  tags: string[];
}

/** Shape used by Explore. */
export interface ExplorePlace {
  id: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  ratingCount: number;
  status: "open_now" | "closing_soon" | "closed";
  tags: string[];
  priceLevel: string;
  flashDeal?: { title: string; discount: string; expires_at: string; remaining: number };
}

function toIndexMerchant(p: ZurichProvider): IndexMerchant {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    rating: p.rating,
    hasBidding: true,
    lat: p.location.lat,
    lng: p.location.lng,
    address: p.address,
    status: computeStatus(p.opening_hours),
    tags: [p.category],
  };
}

function toExplorePlace(p: ZurichProvider): ExplorePlace {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    address: p.address,
    rating: p.rating,
    ratingCount: p.review_count,
    status: computeStatus(p.opening_hours),
    tags: [p.category],
    priceLevel: priceRangeToLevel(p.price_range),
  };
}

/** All Zurich providers as Index merchant shape (for map + list). */
export function getIndexMerchants(): IndexMerchant[] {
  return RAW.map(toIndexMerchant);
}

/** All Zurich providers as Explore place shape. */
export function getExplorePlaces(): ExplorePlace[] {
  return RAW.map(toExplorePlace);
}

/** First N seed stores for mock notification deals (id, name, category). */
export function getSeedStoresForNotificationDeals(count = 6): { id: string; name: string; category: string }[] {
  return RAW.slice(0, count).map((p) => ({ id: p.id, name: p.name, category: p.category }));
}

/** Coffee-focused seed stores for chat suggestions (id, name, rating, category, address). */
export function getSeedCoffeeSuggestions(
  count = 3
): { id: string; name: string; rating: number; category: string; address: string }[] {
  const candidates = RAW.filter((p) => {
    const cat = p.category.toLowerCase();
    return cat.includes("cafe") || cat.includes("coffee");
  });
  return candidates.slice(0, count).map((p) => ({
    id: p.id,
    name: p.name,
    rating: p.rating,
    category: p.category,
    address: p.address,
  }));
}

// ---------------------------------------------------------------------------
// Place detail from provider (for PlaceDetail page when API has no data)
// ---------------------------------------------------------------------------
function openingHoursToday(oh: Record<string, string | null> | undefined): PlaceBasic["opening_hours"] {
  if (!oh) return null;
  const today = getTodayKey();
  const range = oh[today];
  if (!range) return { today_open: "—", today_close: "—", is_open_now: false };
  const [openStr, closeStr] = range.split("-").map((s) => s?.trim() ?? "");
  return {
    today_open: openStr || "—",
    today_close: closeStr || "—",
    is_open_now: computeStatus(oh) === "open_now",
  };
}

function priceRangeToPriceLevel(priceRange: string): "low" | "medium" | "high" {
  if (!priceRange) return "medium";
  const lower = priceRange.toLowerCase();
  if (lower.includes("chf") && (lower.includes("–") || lower.includes("-"))) {
    const nums = priceRange.replace(/\D/g, " ");
    const parts = nums.trim().split(/\s+/).filter(Boolean).map((n) => parseInt(n, 10));
    const max = Math.max(0, ...parts);
    if (max > 80) return "high";
    if (max > 40) return "medium";
  }
  return "medium";
}

function buildRatingDistribution(reviews: unknown[]): RatingDistribution {
  const dist: RatingDistribution = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const r of reviews) {
    const star = (r as { stars?: number; rating?: number }).stars ?? (r as { stars?: number; rating?: number }).rating;
    if (typeof star === "number" && star >= 1 && star <= 5) dist[String(star)] = (dist[String(star)] ?? 0) + 1;
  }
  return dist;
}

/** Build PlaceDetail from a Zurich provider so "View Details" shows real crawled data. */
export function getPlaceDetailFromProvider(placeId: string): PlaceDetailType | null {
  const p = RAW.find((x) => x.id === placeId);
  if (!p) return null;

  const reviews = (p.reviews || []) as Array<{ name?: string; text?: string; stars?: number; rating?: number; publishedAtDate?: string }>;
  const ratingDist = buildRatingDistribution(reviews);
  const advantages = reviews
    .filter((r) => (r.stars ?? r.rating ?? 0) >= 4 && r.text)
    .slice(0, 3)
    .map((r) => (r.text ?? "").slice(0, 120) + (r.text && r.text.length > 120 ? "…" : ""));
  const disadvantages = reviews
    .filter((r) => (r.stars ?? r.rating ?? 0) <= 2 && r.text)
    .slice(0, 2)
    .map((r) => (r.text ?? "").slice(0, 100) + "…");

  const place: PlaceBasic = {
    place_id: p.id,
    name: p.name,
    address: p.address,
    phone: null,
    website: p.website_url ?? null,
    location: p.location,
    rating: p.rating,
    rating_count: p.review_count,
    price_level: priceRangeToPriceLevel(p.price_range),
    status: computeStatus(p.opening_hours),
    opening_hours: openingHoursToday(p.opening_hours),
    social_profiles: null,
    popular_times: null,
    detailed_characteristics: [p.category],
    images: Array.isArray(p.images) && p.images.length > 0
      ? p.images.filter((u): u is string => typeof u === "string").slice(0, 4)
      : null,
  };

  const review_summary: ReviewSummary = {
    advantages: advantages.length > 0 ? advantages : [`Highly rated (${p.rating} from ${p.review_count} reviews).`],
    disadvantages: disadvantages.length > 0 ? disadvantages : [],
    star_reasons: {
      five_star: advantages.slice(0, 2),
      one_star: disadvantages.slice(0, 1),
    },
  };

  return {
    place,
    review_summary,
    rating_distribution: ratingDist,
    questions_and_answers: null,
    customer_updates: null,
    recommendation_reasons: [
      `${p.rating}★ from ${p.review_count} reviews`,
      p.address?.includes("Zürich") ? "Located in Zurich" : "",
    ].filter(Boolean),
  };
}

/** Saved-place shape for default Saved tab (optional flashDeal). */
export interface SavedPlaceFromSeed {
  id: string;
  name: string;
  rating: number;
  category: string;
  address: string;
  priceLevel: string;
  status: "open_now" | "closing_soon" | "closed";
  tags: string[];
  savedAt: string;
  flashDeal?: { title: string; discount: string; expires_at: string; remaining: number };
}

/** Mock deals: remaining (available amount) is always 1–10. */
const MOCK_DEALS: Array<{ title: string; discount: string; expires_at: string; remaining: number }> = [
  { title: "Lunch special", discount: "20% off", expires_at: "Today 18:00", remaining: 6 },
  { title: "Happy hour", discount: "2 for 1 drinks", expires_at: "Today 22:00", remaining: 5 },
  { title: "First visit", discount: "15% off", expires_at: "3 days left", remaining: 10 },
  { title: "Weekend deal", discount: "10% off", expires_at: "Sun 23:59", remaining: 8 },
  { title: "Quick service", discount: "CHF 5 off", expires_at: "Today 20:00", remaining: 3 },
  { title: "Early bird", discount: "25% off before 11:00", expires_at: "Tomorrow 11:00", remaining: 7 },
  { title: "Student deal", discount: "10% off", expires_at: "Ongoing", remaining: 9 },
  { title: "Flash sale", discount: "30% off", expires_at: "Today 21:00", remaining: 8 },
  { title: "Combo deal", discount: "Buy 2 get 1 free", expires_at: "Today 19:00", remaining: 7 },
  { title: "Late night", discount: "15% off after 21:00", expires_at: "Tonight 23:59", remaining: 4 },
  { title: "Loyalty reward", discount: "CHF 10 off next visit", expires_at: "7 days", remaining: 6 },
  { title: "Birthday month", discount: "20% off", expires_at: "End of month", remaining: 10 },
  { title: "Takeaway", discount: "Free delivery", expires_at: "Today 17:00", remaining: 4 },
  { title: "Group booking", discount: "10% off 4+ people", expires_at: "3 days", remaining: 5 },
  { title: "Morning special", discount: "Coffee + pastry CHF 8", expires_at: "Tomorrow 10:00", remaining: 2 },
  { title: "Last minute", discount: "25% off", expires_at: "Today 14:00", remaining: 2 },
  { title: "New customer", discount: "CHF 15 off", expires_at: "14 days", remaining: 10 },
  { title: "Refer a friend", discount: "Both get 15% off", expires_at: "Ongoing", remaining: 8 },
  { title: "Seasonal offer", discount: "20% off menu", expires_at: "Sun 23:59", remaining: 6 },
  { title: "Kids eat free", discount: "Under 12 free", expires_at: "Sat 16:00", remaining: 5 },
  { title: "Wine Wednesday", discount: "Half-price wine", expires_at: "Wed 23:00", remaining: 4 },
  { title: "Brunch bundle", discount: "CHF 25 for two", expires_at: "Sun 14:00", remaining: 3 },
  { title: "Express deal", discount: "15% off under 30 min", expires_at: "Today 20:00", remaining: 6 },
  { title: "Double points", discount: "2x loyalty points", expires_at: "This week", remaining: 9 },
  { title: "Off-peak", discount: "20% off 14:00–17:00", expires_at: "Today 17:00", remaining: 9 },
  { title: "Weekday special", discount: "CHF 12 menu", expires_at: "Fri 15:00", remaining: 7 },
  { title: "Dessert on us", discount: "Free dessert", expires_at: "Today 21:00", remaining: 10 },
  { title: "Parking included", discount: "Free 2h parking", expires_at: "Ongoing", remaining: 10 },
];

/** One place per category from seed, for default Saved tab list. */
export function getOneSavedPerCategory(): SavedPlaceFromSeed[] {
  const order = ["restaurant", "cafe", "bar", "haircut", "massage", "dentist", "repair", "general"];
  const seen = new Set<string>();
  const out: SavedPlaceFromSeed[] = [];
  for (const cat of order) {
    const p = RAW.find((x) => x.category === cat && !seen.has(x.id));
    if (!p) continue;
    seen.add(p.id);
    out.push({
      id: p.id,
      name: p.name,
      rating: p.rating,
      category: p.category,
      address: p.address,
      priceLevel: priceRangeToLevel(p.price_range),
      status: computeStatus(p.opening_hours),
      tags: [p.category],
      savedAt: "Saved",
    });
  }
  return out;
}

const SAVED_CATEGORY_ORDER = ["restaurant", "cafe", "bar", "haircut", "massage", "dentist", "repair", "general"] as const;
const PER_CATEGORY = 4;

/** Place IDs that have (mock) discounts only — no overlap with queue (p001–p010, p081–p082). */
const DISCOUNT_PLACE_IDS = [
  "p011", "p012", "p013", "p014", "p015", "p016", "p017",
  "p018", "p019", "p020", "p021", "p022", "p023", "p024", "p025", "p026", "p027",
  "p028", "p029", "p030", "p031", "p032",
  "p057", "p058", "p059", "p060",
  "p077", "p078", "p079", "p080",
];

/** Set of place ids that have a (mock) discount; used to show only these on Home map. */
export function getMerchantIdsWithDiscount(): Set<string> {
  return new Set(DISCOUNT_PLACE_IDS);
}

/** Resolve seed place id by exact name match (for queue/discount lookup when saved place id may differ). */
export function getSeedIdByPlaceName(name: string): string | undefined {
  const normalized = name.trim();
  const p = RAW.find((x) => x.name.trim() === normalized);
  return p?.id;
}

/** Deal for a place id — only for discount stores (distinct from queue stores). */
export function getDealForPlaceId(
  placeId: string
): { title: string; discount: string; expires_at: string; remaining: number } | undefined {
  const idx = DISCOUNT_PLACE_IDS.indexOf(placeId);
  if (idx === -1) return undefined;
  return MOCK_DEALS[idx % MOCK_DEALS.length];
}

/** Four places per category from seed; only discount-store IDs get a flashDeal. */
export function getFourSavedPerCategory(): SavedPlaceFromSeed[] {
  const discountSet = new Set(DISCOUNT_PLACE_IDS);
  const out: SavedPlaceFromSeed[] = [];
  for (const cat of SAVED_CATEGORY_ORDER) {
    const inCategory = RAW.filter((x) => x.category === cat);
    const taken = inCategory.slice(0, PER_CATEGORY);
    for (let i = 0; i < taken.length; i++) {
      const p = taken[i];
      const hasDeal = discountSet.has(p.id);
      const dealIdx = hasDeal ? DISCOUNT_PLACE_IDS.indexOf(p.id) : -1;
      out.push({
        id: p.id,
        name: p.name,
        rating: p.rating,
        category: p.category,
        address: p.address,
        priceLevel: priceRangeToLevel(p.price_range),
        status: computeStatus(p.opening_hours),
        tags: [p.category],
        savedAt: "Saved",
        flashDeal: dealIdx >= 0 ? MOCK_DEALS[dealIdx % MOCK_DEALS.length] : undefined,
      });
    }
  }
  return out;
}

/** Raw reviews for a place from crawled data (for ReviewsList when place is from seed). */
export function getReviewsForPlace(placeId: string): PlaceReview[] | null {
  const p = RAW.find((x) => x.id === placeId);
  if (!p || !p.reviews?.length) return null;
  const list = (p.reviews as Array<{ name?: string; text?: string; stars?: number; rating?: number; publishedAtDate?: string }>)
    .filter((r) => r.text)
    .map((r) => ({
      author_name: r.name ?? "Guest",
      rating: r.stars ?? r.rating ?? 0,
      text: r.text ?? "",
      time: r.publishedAtDate ?? new Date().toISOString(),
      language: "en",
    }));
  return list.length ? list : null;
}
