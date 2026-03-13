"""
Unit tests for services/review_analysis.
Run with: pytest tests/test_review_analysis.py
"""

from datetime import datetime, timezone
import sys
import os

# Allow running from repo root or from backend/
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.services.review_analysis import (
    ReviewItem,
    ReviewAnalysisRequest,
    analyze_reviews,
    compute_stats,
    remove_duplicates,
    select_top_k,
    sort_negative,
    sort_positive,
    split_reviews,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_review(
    stars: float,
    text: str | None = "some text",
    date: datetime | None = None,
    id: str | None = None,
) -> ReviewItem:
    return ReviewItem(
        id=id,
        stars=stars,
        text=text,
        date=date or datetime(2025, 1, 1, tzinfo=timezone.utc),
    )


# ---------------------------------------------------------------------------
# remove_duplicates
# ---------------------------------------------------------------------------

class TestRemoveDuplicates:
    def test_removes_by_id(self):
        reviews = [
            make_review(4.0, id="r1"),
            make_review(3.0, id="r1"),  # duplicate id
            make_review(5.0, id="r2"),
        ]
        result = remove_duplicates(reviews)
        assert len(result) == 2
        ids = [r.id for r in result]
        assert ids == ["r1", "r2"]

    def test_removes_identical_content_without_id(self):
        date = datetime(2025, 6, 1, tzinfo=timezone.utc)
        reviews = [
            ReviewItem(stars=4.0, text="great", date=date),
            ReviewItem(stars=4.0, text="great", date=date),  # duplicate content
            ReviewItem(stars=3.0, text="ok", date=date),
        ]
        result = remove_duplicates(reviews)
        assert len(result) == 2

    def test_keeps_different_content(self):
        date = datetime(2025, 6, 1, tzinfo=timezone.utc)
        reviews = [
            ReviewItem(stars=4.0, text="great", date=date),
            ReviewItem(stars=4.0, text="very great", date=date),
        ]
        assert len(remove_duplicates(reviews)) == 2

    def test_empty_list(self):
        assert remove_duplicates([]) == []


# ---------------------------------------------------------------------------
# split_reviews
# ---------------------------------------------------------------------------

class TestSplitReviews:
    def test_skip_empty_text_true(self):
        reviews = [
            make_review(4.0, text="nice"),
            make_review(3.0, text=None),
            make_review(5.0, text="  "),  # blank
        ]
        all_r, text_r = split_reviews(reviews, skip_empty_text=True)
        assert len(all_r) == 3
        assert len(text_r) == 1
        assert text_r[0].text == "nice"

    def test_skip_empty_text_false(self):
        reviews = [
            make_review(4.0, text="nice"),
            make_review(3.0, text=None),
        ]
        all_r, text_r = split_reviews(reviews, skip_empty_text=False)
        assert len(all_r) == len(text_r) == 2


# ---------------------------------------------------------------------------
# sort_positive / sort_negative
# ---------------------------------------------------------------------------

class TestSorting:
    def _reviews(self):
        return [
            ReviewItem(stars=3.0, text="ok", date=datetime(2025, 3, 1, tzinfo=timezone.utc)),
            ReviewItem(stars=5.0, text="great", date=datetime(2025, 1, 1, tzinfo=timezone.utc)),
            ReviewItem(stars=5.0, text="amazing", date=datetime(2025, 6, 1, tzinfo=timezone.utc)),
            ReviewItem(stars=2.0, text="bad", date=datetime(2025, 4, 1, tzinfo=timezone.utc)),
        ]

    def test_sort_positive_stars_desc_date_desc(self):
        result = sort_positive(self._reviews())
        assert result[0].stars == 5.0
        assert result[0].text == "amazing"   # more recent 5-star first
        assert result[1].stars == 5.0
        assert result[1].text == "great"

    def test_sort_negative_stars_asc_date_desc(self):
        result = sort_negative(self._reviews())
        assert result[0].stars == 2.0        # lowest stars first
        assert result[-1].stars == 5.0


# ---------------------------------------------------------------------------
# select_top_k
# ---------------------------------------------------------------------------

class TestSelectTopK:
    def test_selects_first_k(self):
        reviews = [make_review(float(i)) for i in range(1, 6)]
        assert len(select_top_k(reviews, 3)) == 3

    def test_k_larger_than_list(self):
        reviews = [make_review(4.0)]
        assert len(select_top_k(reviews, 10)) == 1


# ---------------------------------------------------------------------------
# compute_stats
# ---------------------------------------------------------------------------

class TestComputeStats:
    def test_avg_rating(self):
        reviews = [make_review(4.0), make_review(2.0)]
        stats = compute_stats(reviews)
        assert stats.avg_rating_recent == 3.0

    def test_rating_distribution_keys(self):
        reviews = [make_review(1.0), make_review(3.0), make_review(5.0)]
        stats = compute_stats(reviews)
        assert set(stats.rating_distribution.keys()) == {1, 2, 3, 4, 5}
        assert stats.rating_distribution[1] == 1
        assert stats.rating_distribution[3] == 1
        assert stats.rating_distribution[5] == 1

    def test_empty_text_review_count(self):
        reviews = [
            make_review(4.0, text="nice"),
            make_review(3.0, text=None),
            make_review(5.0, text="  "),
        ]
        stats = compute_stats(reviews)
        assert stats.empty_text_review_count == 2

    def test_empty_list(self):
        stats = compute_stats([])
        assert stats.avg_rating_recent == 0.0
        assert stats.empty_text_review_count == 0


# ---------------------------------------------------------------------------
# analyze_reviews (integration)
# ---------------------------------------------------------------------------

class TestAnalyzeReviews:
    def _base_reviews(self):
        return [
            ReviewItem(stars=5.0, text="excellent", date=datetime(2025, 6, 1, tzinfo=timezone.utc), id="r1"),
            ReviewItem(stars=4.5, text="very good", date=datetime(2025, 5, 1, tzinfo=timezone.utc), id="r2"),
            ReviewItem(stars=4.0, text="good", date=datetime(2025, 4, 1, tzinfo=timezone.utc), id="r3"),
            ReviewItem(stars=2.0, text="bad", date=datetime(2025, 3, 1, tzinfo=timezone.utc), id="r4"),
            ReviewItem(stars=1.0, text="terrible", date=datetime(2025, 2, 1, tzinfo=timezone.utc), id="r5"),
            ReviewItem(stars=5.0, text="excellent", date=datetime(2025, 6, 1, tzinfo=timezone.utc), id="r1"),  # dup
        ]

    def test_deduplication_applied(self):
        req = ReviewAnalysisRequest(reviews=self._base_reviews(), top_k_positive=10, top_k_negative=10)
        result = analyze_reviews(req)
        all_ids = [r.id for r in result.all_reviews_with_rating]
        assert len(all_ids) == len(set(all_ids))

    def test_positive_negative_split(self):
        req = ReviewAnalysisRequest(reviews=self._base_reviews(), positive_threshold=4.0)
        result = analyze_reviews(req)
        assert all(r.stars >= 4.0 for r in result.positive_reviews)
        assert all(r.stars < 4.0 for r in result.negative_reviews)

    def test_top_k_respected(self):
        req = ReviewAnalysisRequest(
            reviews=self._base_reviews(),
            top_k_positive=2,
            top_k_negative=1,
        )
        result = analyze_reviews(req)
        assert len(result.positive_reviews) <= 2
        assert len(result.negative_reviews) <= 1

    def test_text_reviews_exclude_empty(self):
        reviews = [
            ReviewItem(stars=4.0, text="nice", date=datetime(2025, 1, 1, tzinfo=timezone.utc)),
            ReviewItem(stars=3.0, text=None, date=datetime(2025, 1, 1, tzinfo=timezone.utc)),
        ]
        req = ReviewAnalysisRequest(reviews=reviews, skip_empty_text_for_summarization=True)
        result = analyze_reviews(req)
        assert len(result.text_reviews) == 1

    def test_stats_present(self):
        req = ReviewAnalysisRequest(reviews=self._base_reviews())
        result = analyze_reviews(req)
        assert result.stats.avg_rating_recent > 0
        assert sum(result.stats.rating_distribution.values()) > 0

    def test_default_top_k_is_30(self):
        req = ReviewAnalysisRequest(reviews=self._base_reviews())
        assert req.top_k_positive == 30
        assert req.top_k_negative == 30

    def test_summarization_selection_uses_text_reviews_when_skip_empty_true(self):
        reviews = [
            ReviewItem(stars=5.0, text=None, date=datetime(2025, 6, 1, tzinfo=timezone.utc), id="r1"),
            ReviewItem(stars=4.5, text="great", date=datetime(2025, 5, 1, tzinfo=timezone.utc), id="r2"),
            ReviewItem(stars=1.0, text="", date=datetime(2025, 4, 1, tzinfo=timezone.utc), id="r3"),
            ReviewItem(stars=2.0, text="bad", date=datetime(2025, 3, 1, tzinfo=timezone.utc), id="r4"),
        ]
        req = ReviewAnalysisRequest(
            reviews=reviews,
            skip_empty_text_for_summarization=True,
            top_k_positive=10,
            top_k_negative=10,
        )

        result = analyze_reviews(req)

        # Summarization candidates should only include non-empty text reviews.
        assert len(result.text_reviews) == 2
        assert all(r.text and r.text.strip() for r in result.positive_reviews)
        assert all(r.text and r.text.strip() for r in result.negative_reviews)

        # Stats still include all reviews with rating (including empty text).
        assert len(result.all_reviews_with_rating) == 4
        assert result.stats.empty_text_review_count == 2
