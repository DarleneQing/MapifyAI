"""
Apify Google Maps Scraper client.

Uses the compass/crawler-google-places actor to search for businesses
by keyword near given coordinates within a radius.  scrapePlaceDetailPage
is enabled so that openingHours are included in the results.
"""
from apify_client import ApifyClient

from app.config import APIFY_API_TOKEN

ACTOR_ID = "compass/crawler-google-places"
DEFAULT_MAX_RESULTS = 10


def search_places(
    term: str,
    lat: float,
    lng: float,
    radius_km: float,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> list[dict]:
    """Call Apify Google Maps scraper and return raw result dicts."""
    client = ApifyClient(APIFY_API_TOKEN)

    run_input = {
        "searchStringsArray": [term] if isinstance(term, str) else term,
        "maxCrawledPlacesPerSearch": max_results,
        "language": "en",
        "scrapePlaceDetailPage": True,
        "skipClosedPlaces": True,
        "maxImages": 1,
        "maxReviews": 0,
        "customGeolocation": {
            "type": "Point",
            "coordinates": [str(lng), str(lat)],
            "radiusKm": radius_km,
        },
    }

    run = client.actor(ACTOR_ID).call(run_input=run_input)
    dataset_items = client.dataset(run["defaultDatasetId"]).list_items().items
    return dataset_items
