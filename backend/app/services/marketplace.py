"""
Marketplace service — business logic for request/offer lifecycle.
Backend-2 owns this file.

TODO:
  1. persist_request()  — insert StructuredRequest into Supabase `requests` table
  2. persist_offers()   — bulk insert ranked Offer list into `offers` table
  3. get_request()      — fetch request row by id
  4. get_offers()       — fetch offers ordered by score desc
  5. close_request()    — mark request status = "closed" when user accepts an offer
"""
from app.models.schemas import StructuredRequest, Offer
# from app.models.db import get_db


def persist_request(request: StructuredRequest) -> str:
    """Insert request into DB. Returns the request id."""
    # TODO
    raise NotImplementedError


def persist_offers(offers: list[Offer]) -> None:
    """Bulk upsert offers into DB."""
    # TODO
    raise NotImplementedError


def get_request(request_id: str) -> dict:
    """Fetch request row from DB."""
    # TODO
    raise NotImplementedError


def get_offers(request_id: str) -> list[dict]:
    """Fetch offers for a request, ordered by score desc."""
    # TODO
    raise NotImplementedError


def close_request(request_id: str) -> None:
    """Mark request as closed."""
    # TODO
    raise NotImplementedError
