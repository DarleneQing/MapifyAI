"""
Typed schemas for the review_analysis module.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .config import (
    POSITIVE_THRESHOLD_DEFAULT,
    SKIP_EMPTY_TEXT_FOR_SUMMARIZATION_DEFAULT,
    TOP_K_NEGATIVE_DEFAULT,
    TOP_K_POSITIVE_DEFAULT,
)


class ReviewItem(BaseModel):
    id: Optional[str] = None
    provider_id: Optional[str] = None
    stars: float = Field(..., ge=1.0, le=5.0, description="Star rating 1–5")
    text: Optional[str] = None
    date: datetime


class ReviewAnalysisRequest(BaseModel):
    reviews: list[ReviewItem]
    top_k_positive: int = Field(default=TOP_K_POSITIVE_DEFAULT, ge=1)
    top_k_negative: int = Field(default=TOP_K_NEGATIVE_DEFAULT, ge=1)
    skip_empty_text_for_summarization: bool = SKIP_EMPTY_TEXT_FOR_SUMMARIZATION_DEFAULT
    # Stars >= this threshold → "positive"; strictly below → "negative"
    positive_threshold: float = Field(
        default=POSITIVE_THRESHOLD_DEFAULT, ge=1.0, le=5.0
    )


class ReviewStats(BaseModel):
    avg_rating_recent: float
    # Maps star bucket (1–5) to count
    rating_distribution: dict[int, int]
    empty_text_review_count: int


class ReviewAnalysisResult(BaseModel):
    positive_reviews: list[ReviewItem]
    negative_reviews: list[ReviewItem]
    # All de-duplicated reviews that carry a numeric rating (used for stats)
    all_reviews_with_rating: list[ReviewItem]
    # Reviews kept for summarization (non-empty text, after optional filtering)
    text_reviews: list[ReviewItem]
    stats: ReviewStats


class ReviewSummary(BaseModel):
    """Structured LLM summary of positive and negative reviews."""
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    positive_aspects: list[str] = Field(default_factory=list)
    negative_aspects: list[str] = Field(default_factory=list)
    summary: str
    confidence: float = Field(..., ge=0.0, le=1.0)
