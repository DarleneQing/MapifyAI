"""
Unit tests for review_analysis.summarizer.

All LLM calls are mocked — no network required.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from app.services.review_analysis.schemas import ReviewItem, ReviewSummary
from app.services.review_analysis.summarizer import (
    _build_user_prompt,
    _extract_json,
    _try_parse_summary,
    build_orchestrator_summary_payload,
    summarize_reviews,
    summarize_reviews_with_debug,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_review(stars: float, text: str, id: str | None = None) -> ReviewItem:
    return ReviewItem(
        id=id,
        stars=stars,
        text=text,
        date=datetime(2025, 6, 1, tzinfo=timezone.utc),
    )


def _mock_client_response(content: str) -> MagicMock:
    """Build a MagicMock that mimics openai.OpenAI().chat.completions.create()."""
    message = MagicMock()
    message.content = content

    choice = MagicMock()
    choice.message = message

    response = MagicMock()
    response.choices = [choice]

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = response
    return mock_client


_VALID_SUMMARY_JSON = json.dumps({
    "strengths": ["great atmosphere"],
    "weaknesses": ["slow service"],
    "positive_aspects": ["friendly staff"],
    "negative_aspects": ["long wait"],
    "summary": "Overall a decent experience.",
    "confidence": 0.8,
})

POSITIVE = [_make_review(5.0, "Excellent!", "p1"), _make_review(4.5, "Very good", "p2")]
NEGATIVE = [_make_review(2.0, "Disappointing", "n1")]


# ---------------------------------------------------------------------------
# _extract_json
# ---------------------------------------------------------------------------

class TestExtractJson:
    def test_strips_json_code_fence(self):
        wrapped = "```json\n{\"key\": 1}\n```"
        assert _extract_json(wrapped) == '{"key": 1}'

    def test_strips_plain_code_fence(self):
        wrapped = "```\n{\"key\": 1}\n```"
        assert _extract_json(wrapped) == '{"key": 1}'

    def test_passthrough_clean_json(self):
        raw = '{"key": 1}'
        assert _extract_json(raw) == raw


# ---------------------------------------------------------------------------
# _try_parse_summary
# ---------------------------------------------------------------------------

class TestTryParseSummary:
    def test_parses_valid_json(self):
        result = _try_parse_summary(_VALID_SUMMARY_JSON)
        assert isinstance(result, ReviewSummary)
        assert result.confidence == 0.8
        assert result.strengths == ["great atmosphere"]

    def test_returns_none_on_malformed_json(self):
        assert _try_parse_summary("not json at all") is None

    def test_returns_none_on_missing_required_field(self):
        incomplete = json.dumps({"strengths": [], "weaknesses": []})
        assert _try_parse_summary(incomplete) is None

    def test_strips_markdown_before_parsing(self):
        wrapped = f"```json\n{_VALID_SUMMARY_JSON}\n```"
        result = _try_parse_summary(wrapped)
        assert result is not None
        assert result.summary == "Overall a decent experience."

    def test_returns_none_on_confidence_out_of_range(self):
        bad = json.dumps({
            "strengths": [], "weaknesses": [],
            "positive_aspects": [], "negative_aspects": [],
            "summary": "ok", "confidence": 1.5,
        })
        assert _try_parse_summary(bad) is None


# ---------------------------------------------------------------------------
# _build_user_prompt
# ---------------------------------------------------------------------------

class TestBuildUserPrompt:
    def test_includes_positive_and_negative_sections(self):
        prompt = _build_user_prompt(POSITIVE, NEGATIVE)
        assert "POSITIVE REVIEWS" in prompt
        assert "NEGATIVE REVIEWS" in prompt

    def test_positive_only(self):
        prompt = _build_user_prompt(POSITIVE, [])
        assert "POSITIVE REVIEWS" in prompt
        assert "NEGATIVE REVIEWS" not in prompt

    def test_stars_shown_in_prompt(self):
        prompt = _build_user_prompt(POSITIVE, NEGATIVE)
        assert "★5" in prompt or "★4" in prompt

    def test_prompt_requires_english_output(self):
        prompt = _build_user_prompt(POSITIVE, NEGATIVE)
        assert "Output must be English only." in prompt

    def test_prompt_requires_recurring_patterns(self):
        prompt = _build_user_prompt(POSITIVE, NEGATIVE)
        assert "Use recurring patterns only" in prompt


# ---------------------------------------------------------------------------
# summarize_reviews — mocked OpenAI client
# ---------------------------------------------------------------------------

class TestSummarizeReviews:
    def test_returns_review_summary_on_valid_response(self):
        mock_client = _mock_client_response(_VALID_SUMMARY_JSON)

        with patch(
            "app.services.review_analysis.summarizer.OpenAI",
            return_value=mock_client,
        ):
            result = summarize_reviews(POSITIVE, NEGATIVE)

        assert isinstance(result, ReviewSummary)
        assert result.confidence == 0.8
        assert "great atmosphere" in result.strengths

    def test_retries_once_on_malformed_json(self):
        """First attempt returns garbage; second returns valid JSON."""
        message_bad = MagicMock(); message_bad.content = "oops not json"
        choice_bad = MagicMock(); choice_bad.message = message_bad
        resp_bad = MagicMock(); resp_bad.choices = [choice_bad]

        message_ok = MagicMock(); message_ok.content = _VALID_SUMMARY_JSON
        choice_ok = MagicMock(); choice_ok.message = message_ok
        resp_ok = MagicMock(); resp_ok.choices = [choice_ok]

        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = [resp_bad, resp_ok]

        with patch(
            "app.services.review_analysis.summarizer.OpenAI",
            return_value=mock_client,
        ):
            result = summarize_reviews(POSITIVE, NEGATIVE)

        assert mock_client.chat.completions.create.call_count == 2
        assert isinstance(result, ReviewSummary)
        assert result.confidence == 0.8

    def test_returns_fallback_when_both_attempts_fail(self):
        mock_client = _mock_client_response("totally invalid")

        with patch(
            "app.services.review_analysis.summarizer.OpenAI",
            return_value=mock_client,
        ):
            result = summarize_reviews(POSITIVE, NEGATIVE)

        assert result.confidence == 0.0
        assert result.summary == "Summary unavailable due to a processing error."

    def test_returns_fallback_on_api_exception(self):
        mock_client = MagicMock()
        mock_client.chat.completions.create.side_effect = RuntimeError("timeout")

        with patch(
            "app.services.review_analysis.summarizer.OpenAI",
            return_value=mock_client,
        ):
            result = summarize_reviews(POSITIVE, NEGATIVE)

        assert result.confidence == 0.0

    def test_returns_fallback_immediately_when_no_reviews(self):
        with patch(
            "app.services.review_analysis.summarizer.OpenAI"
        ) as mock_openai_cls:
            result = summarize_reviews([], [])

        mock_openai_cls.assert_not_called()
        assert result.confidence == 0.0

    def test_provider_label_in_log_does_not_crash(self):
        mock_client = _mock_client_response("bad json")

        with patch(
            "app.services.review_analysis.summarizer.OpenAI",
            return_value=mock_client,
        ):
            result = summarize_reviews(POSITIVE, NEGATIVE, provider_label="Salon ABC")

        assert isinstance(result, ReviewSummary)


class TestSummarizeReviewsWithDebug:
    def test_returns_debug_timing_metadata(self):
        mock_client = _mock_client_response(_VALID_SUMMARY_JSON)

        with patch(
            "app.services.review_analysis.summarizer.OpenAI",
            return_value=mock_client,
        ):
            result, debug = summarize_reviews_with_debug(POSITIVE, NEGATIVE)

        assert isinstance(result, ReviewSummary)
        assert debug["total_api_latency_seconds"] >= 0.0
        assert debug["total_end_to_end_seconds"] >= 0.0
        assert debug["attempts"] == 1
        assert debug["used_fallback"] is False

    def test_can_return_raw_llm_output_in_debug_mode(self):
        mock_client = _mock_client_response(_VALID_SUMMARY_JSON)

        with patch(
            "app.services.review_analysis.summarizer.OpenAI",
            return_value=mock_client,
        ):
            _result, debug = summarize_reviews_with_debug(
                POSITIVE,
                NEGATIVE,
                show_raw_llm=True,
            )

        assert "raw_llm_output" in debug
        assert isinstance(debug["raw_llm_output"], list)
        assert debug["raw_llm_output"]

    def test_fallback_contains_timing_metadata(self):
        mock_client = _mock_client_response("not-json")

        with patch(
            "app.services.review_analysis.summarizer.OpenAI",
            return_value=mock_client,
        ):
            result, debug = summarize_reviews_with_debug(POSITIVE, NEGATIVE)

        assert result.confidence == 0.0
        assert debug["used_fallback"] is True
        assert debug["attempts"] == 2
        assert debug["malformed_json_retries"] == 2


class TestBuildOrchestratorSummaryPayload:
    def test_returns_compact_payload_without_evidence_lists(self):
        summary = ReviewSummary(
            strengths=["rich broth"],
            weaknesses=["long wait"],
            positive_aspects=["taste"],
            negative_aspects=["waiting_time"],
            summary="Popular place with strong flavor and occasional waiting.",
            confidence=0.7,
        )

        payload = build_orchestrator_summary_payload(summary)
        assert set(payload.keys()) == {
            "strengths",
            "weaknesses",
            "positive_aspects",
            "negative_aspects",
            "summary",
            "confidence",
        }
