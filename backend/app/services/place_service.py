"""
Place service for retrieving place details and reviews.

Hybrid approach:
  1. Primary: In-memory cache populated during recommendation pipeline
  2. Fallback: Fresh Apify fetch for uncached places
  3. Transit: Computed via transport.opendata.ch
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from app.services.swiss_transit import get_transit_eta, TransitResult

logger = logging.getLogger(__name__)


class PlaceService:
    """
    Service for place details and reviews with caching.
    
    The cache is populated by the orchestrator after crawling.
    Uncached places trigger a fresh Apify fetch.
    """

    def __init__(
        self,
        location_service: Any = None,
        marketplace: Any = None,
    ):
        self._location_service = location_service
        self._marketplace = marketplace
        self._place_cache: dict[str, dict] = {}

    def cache_places(
        self,
        providers: list[dict],
        review_summaries: list[dict] | None = None,
    ) -> None:
        """
        Populate the cache with provider data from crawling results.
        Called by the orchestrator after the pipeline completes.
        If review_summaries (from pipeline review_agent) is provided, each
        cached place is enriched with review_summary so get_place_detail
        returns pipeline advantages/disadvantages (e.g. advanced mode).
        """
        review_map: dict[str, dict] = {}
        if review_summaries:
            for r in review_summaries:
                pid = r.get("place_id")
                if pid:
                    review_map[pid] = {
                        "advantages": r.get("advantages", []) or [],
                        "disadvantages": r.get("disadvantages", []) or [],
                        "star_reasons": r.get("star_reasons") or {},
                        "summary": (r.get("summary") or "").strip(),
                    }
                    if r.get("rating_distribution") is not None:
                        review_map[pid]["rating_distribution"] = r["rating_distribution"]
        for provider in providers:
            place_id = provider.get("id")
            if place_id:
                entry = dict(provider)
                if place_id in review_map:
                    entry["review_summary"] = review_map[place_id]
                    if review_map[place_id].get("rating_distribution") is not None:
                        entry["review_distribution"] = review_map[place_id]["rating_distribution"]
                self._place_cache[place_id] = entry
                logger.debug("Cached place: %s", place_id)

    def get_place_detail(
        self, place_id: str, request_id: str | None = None
    ) -> dict[str, Any]:
        """
        Return aggregated place detail with transit and review summary.
        
        Lookup order:
          1. In-memory cache
          2. Fallback: Apify fetch (if not cached)
        """
        place = self._place_cache.get(place_id)
        
        if not place:
            place = self._fetch_place_from_apify(place_id)
        
        if not place:
            return {
                "id": place_id,
                "name": "Unknown Place",
                "error": "Place not found in cache and Apify fetch failed",
            }

        transit = self._compute_transit(place)
        # Use pipeline review summary (simple/advanced/fallback) when cached
        cached_review = place.get("review_summary")
        if (
            isinstance(cached_review, dict)
            and ("advantages" in cached_review or "disadvantages" in cached_review)
        ):
            review_summary = {
                "advantages": cached_review.get("advantages", []) or [],
                "disadvantages": cached_review.get("disadvantages", []) or [],
                "star_reasons": cached_review.get("star_reasons") or {},
                "summary": (cached_review.get("summary") or "").strip(),
            }
        else:
            gen = self._generate_review_summary(place.get("reviews") or [])
            review_summary = {**gen, "summary": gen.get("summary", "").strip()}
        recommendation = self._generate_one_sentence_recommendation(
            place, transit, review_summary
        )

        # Use cached distribution, or compute from reviews when missing (e.g. seed data)
        review_distribution = place.get("review_distribution")
        if not review_distribution and place.get("reviews"):
            review_distribution = self._distribution_from_reviews(place["reviews"])

        return {
            "id": place.get("id", place_id),
            "name": place.get("name", ""),
            "category": place.get("category", ""),
            "address": place.get("address", ""),
            "location": place.get("location", {}),
            "rating": place.get("rating", 0.0),
            "review_count": place.get("review_count", 0),
            "price_range": place.get("price_range", ""),
            "opening_hours": place.get("opening_hours", {}),
            "website_url": place.get("website_url"),
            "google_maps_url": place.get("google_maps_url"),
            "distance_km": place.get("distance_km"),
            "social_profiles": place.get("social_profiles", {}),
            "review_distribution": review_distribution,
            "popular_times": place.get("popular_times"),
            "images": place.get("images", []),
            "review_summary": review_summary,
            "transit": transit,
            "one_sentence_recommendation": recommendation,
        }

    def list_reviews(
        self,
        place_id: str,
        page: int = 1,
        page_size: int = 20,
        sort: str = "relevance",
    ) -> dict[str, Any]:
        """
        Return paginated reviews for a place.
        """
        place = self._place_cache.get(place_id)
        reviews = (place.get("reviews") or []) if place else []

        if sort == "recent":
            reviews = sorted(
                reviews,
                key=lambda r: r.get("publishedAtDate", ""),
                reverse=True,
            )
        elif sort == "rating_high":
            reviews = sorted(
                reviews,
                key=lambda r: r.get("stars", 0),
                reverse=True,
            )
        elif sort == "rating_low":
            reviews = sorted(
                reviews,
                key=lambda r: r.get("stars", 0),
            )

        total = len(reviews)
        start = (page - 1) * page_size
        end = start + page_size
        items = reviews[start:end]

        return {
            "page": page,
            "page_size": page_size,
            "total": total,
            "items": items,
        }

    def _fetch_place_from_apify(self, place_id: str) -> dict | None:
        """
        Fetch a single place from Apify by place_id.
        This is the fallback when the place is not in cache.
        """
        try:
            from app.services.apify_search import search_places
            from app.agents.crawling_search import transform_apify_result

            results = search_places(
                term=place_id,
                lat=47.3769,  # Default to Zurich center
                lng=8.5417,
                radius_km=50,
                max_results=1,
            )

            if results:
                provider = transform_apify_result(results[0], 47.3769, 8.5417)
                self._place_cache[place_id] = provider
                return provider
            return None
        except Exception:
            logger.warning("Failed to fetch place %s from Apify", place_id, exc_info=True)
            return None

    def _compute_transit(self, place: dict) -> dict[str, Any] | None:
        """
        Compute transit info from user's current location to the place.
        Uses transport.opendata.ch via swiss_transit module.
        """
        if not self._location_service:
            return None

        try:
            device_location = None
            if hasattr(self._location_service, "get_device_location"):
                device_location = self._location_service.get_device_location("default")
            
            if not device_location:
                return None

            place_loc = place.get("location", {})
            dest_lat = place_loc.get("lat")
            dest_lng = place_loc.get("lng")
            
            if not dest_lat or not dest_lng:
                return None

            result: TransitResult | None = get_transit_eta(
                origin_lat=device_location.lat,
                origin_lng=device_location.lng,
                dest_lat=dest_lat,
                dest_lng=dest_lng,
                departure_time=datetime.now(),
            )

            if not result:
                return None

            transport_str = ", ".join(result.transport_types) if result.transport_types else "transit"
            summary = f"{result.duration_minutes} min by {transport_str}"
            if result.num_transfers > 0:
                summary += f" ({result.num_transfers} transfer{'s' if result.num_transfers > 1 else ''})"

            return {
                "duration_minutes": result.duration_minutes,
                "transport_types": result.transport_types,
                "departure_time": result.departure_time,
                "arrival_time": result.arrival_time,
                "num_transfers": result.num_transfers,
                "summary": summary,
            }
        except Exception:
            logger.warning("Failed to compute transit for place", exc_info=True)
            return None

    def _distribution_from_reviews(self, reviews: list[dict]) -> dict[str, int]:
        """Build rating distribution (keys '1'-'5') from a list of reviews with stars/rating."""
        dist: dict[str, int] = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}
        for r in reviews:
            star = r.get("stars") or r.get("rating")
            if star is not None:
                key = str(int(star)) if 1 <= int(star) <= 5 else str(max(1, min(5, int(star))))
                dist[key] = dist.get(key, 0) + 1
        return dist

    def _generate_review_summary(self, reviews: list[dict]) -> dict[str, Any]:
        """
        Generate a summary from reviews: advantages, disadvantages, star reasons.
        
        For MVP, extracts key phrases from review text.
        In production, this could use LLM summarization.
        """
        advantages: list[str] = []
        disadvantages: list[str] = []
        five_star_reasons: list[str] = []
        one_star_reasons: list[str] = []

        positive_keywords = ["great", "excellent", "amazing", "best", "friendly", "clean", "fast", "professional"]
        negative_keywords = ["bad", "slow", "rude", "dirty", "expensive", "wait", "poor", "disappointing"]

        for review in reviews:
            text = (review.get("text") or review.get("textTranslated") or "").lower()
            stars = review.get("stars", 0)

            for keyword in positive_keywords:
                if keyword in text and len(advantages) < 3:
                    snippet = self._extract_snippet(text, keyword)
                    if snippet and snippet not in advantages:
                        advantages.append(snippet.capitalize())
                        if stars >= 4:
                            five_star_reasons.append(snippet.capitalize())
                        break

            for keyword in negative_keywords:
                if keyword in text and len(disadvantages) < 3:
                    snippet = self._extract_snippet(text, keyword)
                    if snippet and snippet not in disadvantages:
                        disadvantages.append(snippet.capitalize())
                        if stars <= 2:
                            one_star_reasons.append(snippet.capitalize())
                        break

        if not advantages and reviews:
            advantages = ["Well-reviewed by customers"]
        if not disadvantages:
            disadvantages = []

        return {
            "advantages": advantages[:3],
            "disadvantages": disadvantages[:3],
            "star_reasons": {
                "five_star": five_star_reasons[:2],
                "one_star": one_star_reasons[:2],
            },
        }

    def _extract_snippet(self, text: str, keyword: str) -> str | None:
        """Extract a short phrase around a keyword from review text."""
        idx = text.find(keyword)
        if idx == -1:
            return None
        
        start = max(0, idx - 20)
        end = min(len(text), idx + len(keyword) + 30)
        
        snippet = text[start:end].strip()
        if start > 0:
            space_idx = snippet.find(" ")
            if space_idx > 0:
                snippet = snippet[space_idx + 1:]
        if end < len(text):
            space_idx = snippet.rfind(" ")
            if space_idx > 0:
                snippet = snippet[:space_idx]
        
        return snippet.strip(".,!? ") if snippet else None

    def _generate_one_sentence_recommendation(
        self,
        place: dict,
        transit: dict | None,
        review_summary: dict,
    ) -> str:
        """
        Generate a one-sentence recommendation for the place.
        """
        name = place.get("name", "This place")
        rating = place.get("rating", 0)
        advantages = review_summary.get("advantages", [])
        
        parts = []
        
        if rating >= 4.5:
            parts.append(f"{name} is highly rated ({rating}★)")
        elif rating >= 4.0:
            parts.append(f"{name} has good reviews ({rating}★)")
        else:
            parts.append(f"{name}")

        if advantages:
            parts.append(f"known for being {advantages[0].lower()}")

        if transit:
            parts.append(f"reachable in {transit['summary']}")

        return ", ".join(parts) + "."
