from app.services.apify_search import search_places
from app.config import APIFY_API_TOKEN


def main() -> None:
    print("APIFY_API_TOKEN set:", bool(APIFY_API_TOKEN))
    if not APIFY_API_TOKEN:
        raise SystemExit(
            "APIFY_API_TOKEN is empty; set it in your .env or environment variables."
        )

    results = search_places(
        term="haircut",
        lat=47.3769,
        lng=8.5417,
        radius_km=2.0,
        max_results=5,
    )
    print(f"Fetched {len(results)} places")
    for place in results[:3]:
        name = place.get("name") or place.get("title")
        rating = place.get("rating") or place.get("totalScore")
        print("-", name, "| rating:", rating)


if __name__ == "__main__":
    main()

