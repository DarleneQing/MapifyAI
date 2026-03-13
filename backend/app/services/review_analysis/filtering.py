"""
Filtering, sorting, selection, and stats functions for review_analysis.

All functions are pure (no I/O, no side-effects) and operate on lists of
ReviewItem so they are easy to test in isolation.
"""

from __future__ import annotations

from collections import Counter

from .schemas import (
    ReviewAnalysisRequest,
    ReviewAnalysisResult,
    ReviewItem,
    ReviewStats,
)


# ---------------------------------------------------------------------------
# 1. De-duplication
# ---------------------------------------------------------------------------

def remove_duplicates(reviews: list[ReviewItem]) -> list[ReviewItem]:
    """Return a new list with duplicate reviews removed.

    Primary key: ``id`` when present.
    Fallback key: (stars, date, text) — catches reviews without an id that
    share identical content.
    """
    seen: set[tuple] = set()
    unique: list[ReviewItem] = []
    for review in reviews:
        if review.id is not None:
            key: tuple = ("id", review.id)
        else:
            key = ("content", review.stars, review.date, review.text or "")
        if key not in seen:
            seen.add(key)
            unique.append(review)
    return unique


# ---------------------------------------------------------------------------
# 2. Split reviews
# ---------------------------------------------------------------------------

def split_reviews(
    reviews: list[ReviewItem],
    skip_empty_text: bool = True,
) -> tuple[list[ReviewItem], list[ReviewItem]]:
    """Separate reviews into two groups.

    Returns:
        (all_reviews_with_rating, text_reviews)

        * ``all_reviews_with_rating``: every review (stars is always present).
        * ``text_reviews``: reviews suitable for summarization.
          If ``skip_empty_text`` is True, reviews with None / blank text are
          excluded.
    """
    all_with_rating = list(reviews)  # every review has a stars field
    if skip_empty_text:
        text_reviews = [r for r in reviews if r.text and r.text.strip()]
    else:
        text_reviews = list(reviews)
    return all_with_rating, text_reviews


# ---------------------------------------------------------------------------
# 3 & 4. Sorting helpers
# ---------------------------------------------------------------------------

def sort_positive(reviews: list[ReviewItem]) -> list[ReviewItem]:
    """Sort by stars descending, then date descending."""
    return sorted(reviews, key=lambda r: (-r.stars, -r.date.timestamp()))


def sort_negative(reviews: list[ReviewItem]) -> list[ReviewItem]:
    """Sort by stars ascending, then date descending."""
    return sorted(reviews, key=lambda r: (r.stars, -r.date.timestamp()))


# ---------------------------------------------------------------------------
# 5. Top-k selection
# ---------------------------------------------------------------------------

def select_top_k(reviews: list[ReviewItem], k: int) -> list[ReviewItem]:
    """Return the first *k* reviews (assumes the list is already sorted)."""
    return reviews[:k]


# ---------------------------------------------------------------------------
# 6. Stats
# ---------------------------------------------------------------------------

def compute_stats(reviews: list[ReviewItem]) -> ReviewStats:
    """Compute aggregate statistics over a list of reviews.

    * ``avg_rating_recent``: mean star rating across all provided reviews.
      Callers may pre-filter for recency before calling this function.
    * ``rating_distribution``: count per integer star bucket (1–5).
    * ``empty_text_review_count``: reviews with no / blank text.
    """
    if not reviews:
        return ReviewStats(
            avg_rating_recent=0.0,
            rating_distribution={1: 0, 2: 0, 3: 0, 4: 0, 5: 0},
            empty_text_review_count=0,
        )

    avg = sum(r.stars for r in reviews) / len(reviews)

    bucket_counts: Counter[int] = Counter()
    for r in reviews:
        bucket = max(1, min(5, round(r.stars)))
        bucket_counts[bucket] += 1
    distribution = {b: bucket_counts.get(b, 0) for b in range(1, 6)}

    empty_count = sum(1 for r in reviews if not r.text or not r.text.strip())

    return ReviewStats(
        avg_rating_recent=round(avg, 2),
        rating_distribution=distribution,
        empty_text_review_count=empty_count,
    )


# ---------------------------------------------------------------------------
# 7. Main entry point
# ---------------------------------------------------------------------------

def analyze_reviews(request: ReviewAnalysisRequest) -> ReviewAnalysisResult:
    """Run the full review analysis pipeline.

    Steps:
        1. De-duplicate
        2. Split into (all_with_rating, text_reviews)
        3. Partition into positive / negative by threshold
        4. Sort each partition
        5. Select top-k from each
        6. Compute stats over all de-duplicated reviews
    """
    deduped = remove_duplicates(request.reviews)

    all_with_rating, text_reviews = split_reviews(
        deduped, skip_empty_text=request.skip_empty_text_for_summarization
    )

    # Summarization candidates come from text_reviews when empty text is skipped.
    summarization_pool = (
        text_reviews if request.skip_empty_text_for_summarization else all_with_rating
    )

    positive_pool = [
        r for r in summarization_pool if r.stars >= request.positive_threshold
    ]
    negative_pool = [
        r for r in summarization_pool if r.stars < request.positive_threshold
    ]

    positive_sorted = sort_positive(positive_pool)
    negative_sorted = sort_negative(negative_pool)

    positive_reviews = select_top_k(positive_sorted, request.top_k_positive)
    negative_reviews = select_top_k(negative_sorted, request.top_k_negative)

    stats = compute_stats(all_with_rating)

    return ReviewAnalysisResult(
        positive_reviews=positive_reviews,
        negative_reviews=negative_reviews,
        all_reviews_with_rating=all_with_rating,
        text_reviews=text_reviews,
        stats=stats,
    )
