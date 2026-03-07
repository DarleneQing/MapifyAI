"""
Marketplace service — business logic for request/offer lifecycle.
Persists to Supabase `requests` and `offers` tables.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

from app.models.schemas import StructuredRequest, Offer
from app.models.db import get_db


def _serialize_request(request: StructuredRequest | dict) -> dict[str, Any]:
    """Build a DB row dict from StructuredRequest or record dict."""
    if hasattr(request, "model_dump"):
        data = request.model_dump()
    else:
        data = dict(request)

    row: dict[str, Any] = {
        "id": data["id"],
        "raw_input": data["raw_input"],
        "category": data.get("category", "general"),
        "radius_km": data.get("radius_km", 5.0),
        "constraints": data.get("constraints") or {},
        "preferences": data.get("preferences"),
        "status": data.get("status", "pending"),
    }

    loc = data.get("location")
    if isinstance(loc, dict):
        row["location"] = loc
    else:
        row["location"] = {"lat": getattr(loc, "lat", 0), "lng": getattr(loc, "lng", 0)}

    for key in ("requested_time", "created_at"):
        val = data.get(key)
        if val is None and key == "created_at":
            continue
        if hasattr(val, "isoformat"):
            row[key] = val.isoformat()
        else:
            row[key] = val

    if "created_at" not in row:
        row["created_at"] = datetime.utcnow().isoformat() + "Z"
    return row


def _serialize_offer(offer: Offer | dict) -> dict[str, Any]:
    """Build a DB row dict from Offer or offer dict."""
    if hasattr(offer, "model_dump"):
        data = offer.model_dump()
    else:
        data = dict(offer)

    row: dict[str, Any] = {
        "id": data.get("id"),
        "request_id": data["request_id"],
        "provider_id": data["provider_id"],
        "price": float(data["price"]),
        "eta_minutes": int(data["eta_minutes"]),
        "notes": data.get("notes"),
        "score": data.get("score"),
        "score_breakdown": data.get("score_breakdown"),
        "reasons": data.get("reasons"),
        "time_label": data.get("time_label"),
    }

    for key in ("slot_time", "created_at"):
        val = data.get(key)
        if val is not None:
            row[key] = val.isoformat() if hasattr(val, "isoformat") else val
    if "created_at" not in row:
        row["created_at"] = datetime.utcnow().isoformat() + "Z"
    return row


def persist_request(request: StructuredRequest | dict) -> str:
    """Insert request into DB. Returns the request id."""
    row = _serialize_request(request)
    db = get_db()
    db.table("requests").insert(row).execute()
    return str(row["id"])


def persist_offers(offers: list[Offer] | list[dict]) -> None:
    """Bulk insert offers into DB. Skips rows without id; generates id if missing."""
    if not offers:
        return
    import uuid
    rows = []
    for o in offers:
        row = _serialize_offer(o)
        if not row.get("id"):
            row["id"] = str(uuid.uuid4())
        rows.append(row)
    db = get_db()
    db.table("offers").insert(rows).execute()


def get_request(request_id: str) -> dict | None:
    """Fetch request row from DB."""
    db = get_db()
    r = db.table("requests").select("*").eq("id", request_id).maybe_single().execute()
    data = r.data
    if isinstance(data, list):
        return data[0] if data else None
    return data


def get_offers(request_id: str) -> list[dict]:
    """Fetch offers for a request, ordered by score desc."""
    db = get_db()
    r = (
        db.table("offers")
        .select("*")
        .eq("request_id", request_id)
        .order("score", desc=True)
        .execute()
    )
    return list(r.data) if r.data else []


def close_request(request_id: str) -> None:
    """Mark request as closed."""
    db = get_db()
    db.table("requests").update({"status": "closed"}).eq("id", request_id).execute()
