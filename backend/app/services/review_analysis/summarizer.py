"""
Featherless-backed LLM summarizer for review_analysis.

Uses the OpenAI Python SDK (OpenAI-compatible) with Featherless as the
base_url to turn selected positive / negative ReviewItems into a structured
ReviewSummary.  Retries once on malformed JSON; returns a safe fallback on
any failure.
"""

from __future__ import annotations

import json
import logging
import re
import time
from typing import Any, Optional

from openai import OpenAI
from pydantic import ValidationError

from app.config import FEATHERLESS_API_KEY
from app.services.review_analysis.schemas import ReviewItem, ReviewSummary

logger = logging.getLogger(__name__)

FEATHERLESS_BASE_URL = "https://api.featherless.ai/v1"
DEFAULT_SUMMARIZER_MODEL = "Qwen/Qwen2.5-7B-Instruct"

_SYSTEM_PROMPT = """\
You are an expert review analyst for a local services marketplace.
Analyse the provided customer reviews and return structured insights as strict JSON.
No markdown fences. No text outside the JSON object.

You may use review evidence in any language, but your final JSON output MUST be in English only.
Only include patterns that are recurring across multiple reviews.
Do not hallucinate facts that are not supported by the provided reviews.
Avoid promotional or vague wording (e.g. "highly recommended", "great experience")
unless it maps to a concrete, recurring aspect.

Required JSON structure:
{
    "strengths": ["<short user-facing phrase>", ...],
    "weaknesses": ["<short user-facing phrase>", ...],
    "positive_aspects": ["<normalized recurring aspect label>", ...],
    "negative_aspects": ["<normalized recurring aspect label>", ...],
  "summary": "<one concise paragraph summarising the overall customer experience>",
  "confidence": <float 0.0-1.0 reflecting how consistent the reviews are>
}

Field semantics:
- strengths / weaknesses: short user-facing summary phrases.
- positive_aspects / negative_aspects: normalized system-friendly aspect labels,
    concise noun phrases or snake_case concepts where appropriate.

Example aspect labels: taste, service, waiting_time, price,
menu_availability, portion_size, atmosphere.
"""


# ---------------------------------------------------------------------------
# Prompt helpers
# ---------------------------------------------------------------------------

def _format_reviews_for_prompt(reviews: list[ReviewItem]) -> str:
    lines: list[str] = []
    for i, r in enumerate(reviews, 1):
        text = (r.text or "").replace("\n", " ").strip()
        lines.append(f"{i}. [★{r.stars:.0f}] {text}")
    return "\n".join(lines)


def _build_user_prompt(
    positive_reviews: list[ReviewItem],
    negative_reviews: list[ReviewItem],
) -> str:
    parts: list[str] = []
    if positive_reviews:
        parts.append(f"POSITIVE REVIEWS ({len(positive_reviews)}):")
        parts.append(_format_reviews_for_prompt(positive_reviews))
    if negative_reviews:
        parts.append(f"\nNEGATIVE REVIEWS ({len(negative_reviews)}):")
        parts.append(_format_reviews_for_prompt(negative_reviews))
    parts.append("\nOutput rules:")
    parts.append("- Output must be English only.")
    parts.append("- Use recurring patterns only; skip one-off outliers.")
    parts.append("- Keep strengths/weaknesses short and user-facing.")
    parts.append("- Keep aspect labels normalized and concise.")
    parts.append("Respond with ONLY a valid JSON object matching the required schema.")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# JSON extraction / validation
# ---------------------------------------------------------------------------

def _extract_json(raw: str) -> str:
    """Strip optional markdown code fences the model may wrap around JSON."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


def _try_parse_summary(raw: str) -> Optional[ReviewSummary]:
    """Parse and Pydantic-validate a raw LLM string into ReviewSummary."""
    try:
        data = json.loads(_extract_json(raw))
        return ReviewSummary.model_validate(data)
    except (json.JSONDecodeError, ValidationError, TypeError, ValueError) as exc:
        logger.debug("ReviewSummary parse failed: %s | raw=%r", exc, raw[:300])
        return None


def _make_fallback() -> ReviewSummary:
    return ReviewSummary(
        strengths=[],
        weaknesses=[],
        positive_aspects=[],
        negative_aspects=[],
        summary="Summary unavailable due to a processing error.",
        confidence=0.0,
    )


def _summarize_reviews_internal(
    positive_reviews: list[ReviewItem],
    negative_reviews: list[ReviewItem],
    model: str,
    provider_label: str,
    include_raw_output: bool,
) -> tuple[ReviewSummary, dict[str, Any]]:
    """Internal implementation with debug metadata and timing."""
    started_at = time.perf_counter()
    total_api_latency = 0.0
    attempts = 0
    malformed_json_retries = 0
    raw_outputs: list[str] = []

    if not positive_reviews and not negative_reviews:
        fallback = _make_fallback()
        return fallback, {
            "total_api_latency_seconds": 0.0,
            "total_end_to_end_seconds": round(time.perf_counter() - started_at, 6),
            "attempts": 0,
            "malformed_json_retries": 0,
            "used_fallback": True,
            "raw_llm_output": [] if include_raw_output else None,
        }

    client = OpenAI(
        api_key=FEATHERLESS_API_KEY or "no-key",
        base_url=FEATHERLESS_BASE_URL,
    )
    user_prompt = _build_user_prompt(positive_reviews, negative_reviews)

    used_fallback = True
    summary = _make_fallback()

    for attempt in range(2):
        attempts += 1
        try:
            api_started_at = time.perf_counter()
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                temperature=0.2,
                max_tokens=1024,
            )
            api_elapsed = time.perf_counter() - api_started_at
            total_api_latency += api_elapsed

            raw_content = response.choices[0].message.content or ""
            if include_raw_output:
                raw_outputs.append(raw_content)

            parsed = _try_parse_summary(raw_content)
            if parsed is not None:
                summary = parsed
                used_fallback = False
                break

            malformed_json_retries += 1
            logger.warning(
                "Malformed JSON from summarizer (attempt %d/2): %r",
                attempt + 1,
                raw_content[:300],
            )
        except Exception as exc:
            logger.error(
                "Summarizer API call failed (attempt %d/2): %s",
                attempt + 1,
                exc,
            )
            break  # no point retrying on transport/auth errors

    if used_fallback:
        logger.warning(
            "Returning fallback summary%s",
            f" for {provider_label!r}" if provider_label else "",
        )

    metadata: dict[str, Any] = {
        "total_api_latency_seconds": round(total_api_latency, 6),
        "total_end_to_end_seconds": round(time.perf_counter() - started_at, 6),
        "attempts": attempts,
        "malformed_json_retries": malformed_json_retries,
        "used_fallback": used_fallback,
    }
    if include_raw_output:
        metadata["raw_llm_output"] = raw_outputs

    return summary, metadata


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def summarize_reviews(
    positive_reviews: list[ReviewItem],
    negative_reviews: list[ReviewItem],
    model: str = DEFAULT_SUMMARIZER_MODEL,
    provider_label: str = "",
) -> ReviewSummary:
    """Summarize selected positive and negative reviews via Featherless LLM.

    Retries once on malformed JSON.  Returns a safe fallback ReviewSummary on
    any failure so callers never have to handle exceptions.

    Args:
        positive_reviews: Top-k positive reviews (text already filtered).
        negative_reviews: Top-k negative reviews (text already filtered).
        model:            Featherless model identifier.
        provider_label:   Optional name used only for log messages.
    """
    result, metadata = _summarize_reviews_internal(
        positive_reviews=positive_reviews,
        negative_reviews=negative_reviews,
        model=model,
        provider_label=provider_label,
        include_raw_output=False,
    )
    logger.info(
        "Summarization timing api=%.3fs end_to_end=%.3fs attempts=%d",
        metadata["total_api_latency_seconds"],
        metadata["total_end_to_end_seconds"],
        metadata["attempts"],
    )
    return result


def summarize_reviews_with_debug(
    positive_reviews: list[ReviewItem],
    negative_reviews: list[ReviewItem],
    model: str = DEFAULT_SUMMARIZER_MODEL,
    provider_label: str = "",
    show_raw_llm: bool = False,
) -> tuple[ReviewSummary, dict[str, Any]]:
    """Debug path that also returns timing and optional raw LLM outputs."""
    return _summarize_reviews_internal(
        positive_reviews=positive_reviews,
        negative_reviews=negative_reviews,
        model=model,
        provider_label=provider_label,
        include_raw_output=show_raw_llm,
    )


def build_orchestrator_summary_payload(summary: ReviewSummary) -> dict[str, Any]:
    """Return compact downstream payload without raw review evidence lists."""
    return {
        "strengths": summary.strengths,
        "weaknesses": summary.weaknesses,
        "positive_aspects": summary.positive_aspects,
        "negative_aspects": summary.negative_aspects,
        "summary": summary.summary,
        "confidence": summary.confidence,
    }
