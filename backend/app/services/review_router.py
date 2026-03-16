"""Service-layer router for review summary generation.

This module keeps mode selection out of the graph layer.
It routes provider review summarization to one of three modes:

- simple:   existing Daisy/simple implementation
- advanced: existing review_analysis implementation, one provider at a time
- fallback: try advanced first, then fall back to simple per provider

All public outputs are normalized to this schema:
    {"place_id": str, "advantages": list[str], "disadvantages": list[str]}
"""

from __future__ import annotations

from typing import Any, Literal

from app.services.review_analysis.service import analyze_and_summarize_reviews
from app.services.reviews import summarise_providers

ReviewMode = Literal["simple", "advanced", "fallback"]
NormalizedReviewSummary = dict[str, str | list[str]]


def route_review_summaries(
    providers: list[dict],
    review_mode: str = "simple",
) -> list[dict]:
    """Route provider review summarization and return normalized summaries.

    Args:
        providers: Candidate provider dicts from the graph state.
        review_mode: One of "simple", "advanced", or "fallback".

    Returns:
        A list of normalized review summaries with keys:
        - place_id
        - advantages
        - disadvantages
    """
    if not providers:
        return []

    mode = _normalize_mode(review_mode)
    if mode == "simple":
        return _route_simple(providers)
    if mode == "advanced":
        return _route_advanced(providers)
    return _route_fallback(providers)


def _normalize_mode(review_mode: str | None) -> ReviewMode:
    """Return a supported mode, defaulting to simple for unknown values."""
    if review_mode in {"simple", "advanced", "fallback"}:
        return review_mode
    return "simple"


def _route_simple(providers: list[dict]) -> list[dict]:
    """Use the existing Daisy/simple implementation for all providers at once."""
    raw_summaries = summarise_providers(providers)
    return [
        _normalize_summary_item(summary, provider)
        for provider, summary in zip(providers, raw_summaries)
    ]


def _route_advanced(providers: list[dict]) -> list[dict]:
    """Use the advanced review pipeline one provider at a time."""
    summaries: list[dict] = []
    for provider in providers:
        summaries.append(_summarize_provider_advanced(provider))
    return summaries


def _route_fallback(providers: list[dict]) -> list[dict]:
    """Try advanced first, then fall back to simple per provider on failure."""
    summaries: list[dict] = []
    for provider in providers:
        advanced_summary = _try_summarize_provider_advanced(provider)
        if advanced_summary is not None:
            summaries.append(advanced_summary)
            continue

        try:
            simple_summary = summarise_providers([provider])
            if simple_summary:
                summaries.append(_normalize_summary_item(simple_summary[0], provider))
                continue
        except Exception:
            pass

        summaries.append(_empty_summary(provider))
    return summaries


def _summarize_provider_advanced(provider: dict) -> dict:
    """Run advanced summarization for one provider and return normalized output.

    In advanced mode, failures do not raise into callers. They return an empty
    normalized summary so the graph can continue.
    """
    summary = _try_summarize_provider_advanced(provider)
    if summary is not None:
        return summary
    return _empty_summary(provider)


def _try_summarize_provider_advanced(provider: dict) -> dict | None:
    """Return normalized advanced summary for one provider, or None on failure."""
    place_url = str(provider.get("google_maps_url") or "").strip()
    if not place_url:
        return None

    try:
        result = analyze_and_summarize_reviews(place_url=place_url)
    except Exception:
        return None

    return _normalize_advanced_result(result, provider)


def _normalize_advanced_result(result: dict[str, Any], provider: dict) -> dict:
    """Map advanced review_analysis output to the graph-compatible schema."""
    payload = result.get("orchestrator_payload") or {}
    summary = payload.get("summary")
    out: dict[str, Any] = {
        "place_id": _provider_place_id(provider),
        "advantages": _coerce_string_list(payload.get("strengths")),
        "disadvantages": _coerce_string_list(payload.get("weaknesses")),
        "summary": str(summary).strip() if summary else "",
    }
    # Frontend expects string keys "1"-"5" for rating distribution
    raw_dist = payload.get("rating_distribution")
    if isinstance(raw_dist, dict) and raw_dist:
        out["rating_distribution"] = {str(k): int(v) for k, v in raw_dist.items()}
    return out


def _normalize_summary_item(summary: dict[str, Any] | None, provider: dict) -> dict:
    """Normalize any simple-style summary dict to the public router schema."""
    summary = summary or {}
    place_id = str(summary.get("place_id") or _provider_place_id(provider))
    s = summary.get("summary")
    out: dict[str, Any] = {
        "place_id": place_id,
        "advantages": _coerce_string_list(summary.get("advantages")),
        "disadvantages": _coerce_string_list(summary.get("disadvantages")),
        "summary": str(s).strip() if s else "",
    }
    raw_dist = summary.get("rating_distribution")
    if isinstance(raw_dist, dict) and raw_dist:
        out["rating_distribution"] = {str(k): int(v) for k, v in raw_dist.items()}
    return out


def _empty_summary(provider: dict) -> dict:
    """Return a safe empty summary for one provider."""
    return {
        "place_id": _provider_place_id(provider),
        "advantages": [],
        "disadvantages": [],
        "summary": "",
    }


def _provider_place_id(provider: dict) -> str:
    """Return provider id as the canonical place_id join key."""
    return str(provider.get("id") or "")


def _coerce_string_list(value: Any) -> list[str]:
    """Convert a loose value into a clean list of strings."""
    if not isinstance(value, list):
        return []

    cleaned: list[str] = []
    for item in value:
        if item is None:
            continue
        text = str(item).strip()
        if text:
            cleaned.append(text)
    return cleaned