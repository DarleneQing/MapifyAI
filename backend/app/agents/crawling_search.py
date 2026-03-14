"""
Crawling Agent Sub-1 — Apify Google Maps search + opening hours filter.

Input:  state["structured_request"] (category, location, radius_km, requested_time)
Output: state["candidate_providers"]  (stores open during the requested time window)

Pipeline position: replaces seed-based retrieval.py when Apify is available.
"""
import re
import time
import uuid
from datetime import datetime

from app.agents.state import PlannerState
from app.agents.trace import add_step
from app.services.apify_search import search_places
from app.services.geo import haversine_km

DAY_MAP = {
    "monday": "mon",
    "tuesday": "tue",
    "wednesday": "wed",
    "thursday": "thu",
    "friday": "fri",
    "saturday": "sat",
    "sunday": "sun",
}


def _parse_12h_time(raw: str) -> tuple[int, int]:
    """Parse a single 12-hour time like '5 PM', '11:30 AM', '12 AM' into (hour24, minute).

    Also handles bare numbers without AM/PM (e.g. '12' = noon in Google Maps).
    """
    raw = raw.strip().replace("\u202f", " ").replace("\u00a0", " ")
    match = re.match(r"(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$", raw, re.IGNORECASE)
    if not match:
        raise ValueError(f"Cannot parse time: {raw}")

    hour = int(match.group(1))
    minute = int(match.group(2) or 0)
    period = (match.group(3) or "").upper()

    if not period:
        return hour, minute

    if period == "AM":
        if hour == 12:
            hour = 0
    else:
        if hour != 12:
            hour += 12

    return hour, minute


def _split_range(range_str: str) -> tuple[str, str]:
    """Split '7 AM-6 PM' or '7 AM to 6 PM' into open/close parts."""
    if " to " in range_str:
        parts = range_str.split(" to ", 1)
    else:
        parts = range_str.split("-", 1)
    return parts[0].strip(), parts[1].strip()


def convert_12h_range_to_24h(range_str: str) -> str:
    """Convert '7:30 AM-6:30 PM' or '7 AM to 6 PM' to '07:30-18:30'."""
    if "," in range_str:
        # Split shift like "12 to 9:30 AM, 11 AM to 10:30 PM" -- take widest window
        segments = [s.strip() for s in range_str.split(",")]
        first_open, _ = _split_range(segments[0])
        _, last_close = _split_range(segments[-1])
        oh, om = _parse_12h_time(first_open)
        ch, cm = _parse_12h_time(last_close)
    else:
        open_str, close_str = _split_range(range_str)
        oh, om = _parse_12h_time(open_str)
        ch, cm = _parse_12h_time(close_str)
    return f"{oh:02d}:{om:02d}-{ch:02d}:{cm:02d}"


def parse_apify_hours(apify_hours: list[dict] | None) -> dict:
    """
    Convert Apify openingHours list to our internal format.

    Input:  [{"day": "Monday", "hours": "11:30 AM-11 PM"}, ...]
    Output: {"mon": "11:30-23:00", "tue": ..., "sun": None}
    """
    result = {abbr: None for abbr in DAY_MAP.values()}

    if not apify_hours:
        return result

    for entry in apify_hours:
        day_full = entry.get("day", "").lower()
        hours_str = entry.get("hours", "")
        abbr = DAY_MAP.get(day_full)
        if not abbr:
            continue

        if not hours_str or hours_str.lower() == "closed":
            result[abbr] = None
            continue

        try:
            result[abbr] = convert_12h_range_to_24h(hours_str)
        except (ValueError, IndexError):
            result[abbr] = None

    return result


def _time_to_minutes(h: int, m: int) -> int:
    return h * 60 + m


def is_open_at(opening_hours: dict, requested_dt: datetime) -> bool:
    """Check if a store is open at the requested datetime."""
    day_key = requested_dt.strftime("%a").lower()
    hours_str = opening_hours.get(day_key)

    if not hours_str:
        return False

    try:
        open_str, close_str = hours_str.split("-")
        oh, om = map(int, open_str.split(":"))
        ch, cm = map(int, close_str.split(":"))
    except (ValueError, IndexError):
        return False

    open_min = _time_to_minutes(oh, om)
    close_min = _time_to_minutes(ch, cm)
    req_min = _time_to_minutes(requested_dt.hour, requested_dt.minute)

    if close_min > open_min:
        return open_min <= req_min < close_min
    else:
        # Wraps past midnight (e.g. 17:00-02:00)
        return req_min >= open_min or req_min < close_min


def _extract_coords(result: dict) -> tuple[float, float]:
    """Extract lat/lng from either compass or poidata format."""
    loc = result.get("location")
    if isinstance(loc, dict):
        return float(loc.get("lat", 0.0)), float(loc.get("lng", 0.0))
    return float(result.get("latitude", 0.0)), float(result.get("longitude", 0.0))


def transform_apify_result(
    result: dict, user_lat: float, user_lng: float
) -> dict:
    """Convert a single Apify result dict to our Provider-compatible dict.

    Handles both compass/crawler-google-places and poidata formats.
    """
    store_lat, store_lng = _extract_coords(result)

    categories = result.get("categories") or []
    category = categories[0] if categories else result.get("categoryName", "general")

    name = result.get("title") or result.get("name") or ""
    rating = result.get("totalScore") or result.get("rating") or 0.0
    review_count = result.get("reviewsCount") or result.get("reviewCount") or 0
    price_range = (
        result.get("price")
        or result.get("priceRange")
        or result.get("priceRangeText")
        or ""
    )
    url = result.get("url") or result.get("searchPageLoadedUrl") or ""

    # Optional enrichment fields directly mirroring Apify Google Maps scraper output
    social_profiles: dict[str, str] = {}
    for source_key, label in [
        ("facebookUrl", "facebook"),
        ("instagramUrl", "instagram"),
        ("twitterUrl", "twitter"),
        ("tiktokUrl", "tiktok"),
        ("youtubeUrl", "youtube"),
        ("linkedinUrl", "linkedin"),
    ]:
        val = result.get(source_key)
        if val:
            social_profiles[label] = val

    social_media_obj = result.get("socialMedia")
    if isinstance(social_media_obj, dict):
        for key, val in social_media_obj.items():
            if val and key not in social_profiles:
                social_profiles[key] = val

    raw_distribution = result.get("reviewsPerRating") or result.get(
        "reviewsPerScore"
    )
    review_distribution: dict[str, int] | None = None
    if isinstance(raw_distribution, dict):
        review_distribution = {
            str(k): int(v) for k, v in raw_distribution.items()
        }
    elif isinstance(raw_distribution, list):
        tmp: dict[str, int] = {}
        for entry in raw_distribution:
            if not isinstance(entry, dict):
                continue
            stars = entry.get("stars") or entry.get("rating")
            count = entry.get("count") or entry.get("reviewsCount")
            if stars is None or count is None:
                continue
            tmp[str(stars)] = int(count)
        if tmp:
            review_distribution = tmp

    popular_times = result.get("popularTimesHistogram") or result.get(
        "popularTimes"
    )
    questions_and_answers = result.get("questionsAndAnswers")
    detailed_characteristics = result.get("detailedCharacteristics")
    customer_updates = result.get("updatesFromCustomers")

    return {
        "id": result.get("placeId") or str(uuid.uuid4()),
        "name": name,
        "category": category,
        "location": {"lat": store_lat, "lng": store_lng},
        "address": result.get("address", ""),
        "rating": float(rating),
        "review_count": int(review_count),
        "price_range": price_range,
        "average_rating": float(rating),
        "opening_hours": parse_apify_hours(result.get("openingHours")),
        "website_url": result.get("website"),
        "google_maps_url": url,
        "distance_km": round(
            haversine_km(user_lat, user_lng, store_lat, store_lng), 2
        ),
        "social_profiles": social_profiles,
        "review_distribution": review_distribution,
        "popular_times": popular_times,
        "questions_and_answers": questions_and_answers,
        "customer_updates": customer_updates,
        "detailed_characteristics": detailed_characteristics,
        "reviews": result.get("reviews") or [],
    }


def filter_by_opening_hours(
    providers: list[dict], requested_dt: datetime
) -> list[dict]:
    """Keep only providers that are open at the requested datetime."""
    return [p for p in providers if is_open_at(p["opening_hours"], requested_dt)]


def run(state: PlannerState) -> PlannerState:
    """Agent entry point — search via Apify, transform, filter by hours."""
    start = time.time() * 1000
    req = state["structured_request"]
    loc = req["location"]
    radius = req.get("radius_km", 5.0)
    category = req.get("category", "")
    keywords = req.get("keywords", "")

    search_term = keywords if keywords else category

    retry = state.get("retry_count", 0)
    if retry > 0:
        radius *= 1 + 0.5 * retry

    raw_results = search_places(
        term=search_term,
        lat=loc["lat"],
        lng=loc["lng"],
        radius_km=radius,
    )

    providers = [
        transform_apify_result(r, loc["lat"], loc["lng"]) for r in raw_results
    ]

    requested_dt = datetime.fromisoformat(req["requested_time"])
    candidates = filter_by_opening_hours(providers, requested_dt)
    candidates.sort(key=lambda p: p["distance_km"])

    state["candidate_providers"] = candidates
    state["trace"] = add_step(
        state["trace"],
        agent="crawling_search",
        input_data={
            "category": category,
            "keywords": keywords,
            "search_term": search_term,
            "location": loc,
            "radius_km": radius,
            "apify_results": len(raw_results),
        },
        output_data={
            "after_transform": len(providers),
            "after_hours_filter": len(candidates),
        },
        start_ms=start,
    )
    return state
