# `review_analysis` module overview

This package implements the end-to-end pipeline that:

1. Loads reviews either by running an Apify Google Maps scraper (`place_url` mode) or by reusing an existing dataset (`dataset_id` mode).
2. Runs a pure, in-memory analysis/selection step over the reviews.
3. Sends the selected reviews to an LLM-based summarizer and prepares an orchestrator-ready payload.

It is designed to be deterministic and side-effect free except for the initial scraping step.

## Main entry point

The primary public API is the function `analyze_and_summarize_reviews` in `service.py`:

- **Location**: `service.py`
- **Signature (simplified)**:
  - `dataset_id: Optional[str] = None`
  - `place_url: Optional[str] = None`
  - `top_k_positive: int`
  - `top_k_negative: int`
  - `skip_empty_text_for_summarization: bool`
  - `max_reviews: int`
  - `reviews_start_date: str`
  - `language: str`
  - `personal_data: bool`
  - `debug_include_selected_reviews: bool`
- **Return value**: `dict[str, Any]` with:
  - `dataset_id`: the dataset used for analysis
  - `orchestrator_payload`: payload ready for the orchestrator
  - `summary_result`: structured LLM summary (`ReviewSummary`) as JSON
  - `review_stats`: aggregate stats over the analyzed reviews (`ReviewStats`)
  - `debug`: diagnostic metadata (timings, counts, mode, etc.)

Exactly one of `dataset_id` or `place_url` must be provided.

## Internal submodules

### `filtering.py`

Pure functions that implement the review analysis pipeline:

- Deduplication (`remove_duplicates`)
- Splitting reviews into:
  - all reviews with ratings
  - reviews suitable for summarization
- Partitioning reviews into positive/negative using a configurable threshold
- Sorting positive and negative reviews
- Selecting top-k positive and negative reviews
- Computing aggregate statistics (`compute_stats`)
- Main orchestration function:
  - `analyze_reviews(request: ReviewAnalysisRequest) -> ReviewAnalysisResult`

This module has no side effects and operates only on Pydantic models.

### `schemas.py`

Typed Pydantic models for the module:

- `ReviewItem`: single review with id/provider_id/stars/text/date
- `ReviewAnalysisRequest`: input payload for the analysis step
- `ReviewStats`: aggregated metrics over reviews
- `ReviewAnalysisResult`: structured output from `analyze_reviews`
- `ReviewSummary`: structured LLM summary (strengths, weaknesses, etc.)

Defaults for analysis-related parameters in `ReviewAnalysisRequest` are defined via the shared config in `config.py`.

### `config.py` (tunable hyperparameters)

To **manually tune behavior**, edit the constants in `config.py`. This file centralizes all default hyperparameters used by `review_analysis`:

- **Filtering / selection defaults**
  - `TOP_K_POSITIVE_DEFAULT`
  - `TOP_K_NEGATIVE_DEFAULT`
  - `POSITIVE_THRESHOLD_DEFAULT`
  - `SKIP_EMPTY_TEXT_FOR_SUMMARIZATION_DEFAULT`
- **Scraper / dataset defaults**
  - `MAX_REVIEWS_DEFAULT`
  - `REVIEWS_START_DATE_DEFAULT`
  - `LANGUAGE_DEFAULT`
  - `PERSONAL_DATA_DEFAULT`
- **Debug / observability defaults**
  - `DEBUG_INCLUDE_SELECTED_REVIEWS_DEFAULT`

These constants are wired into:

- `service.py`:
  - Function parameters of `analyze_and_summarize_reviews` use these as defaults.
- `schemas.py`:
  - `ReviewAnalysisRequest` uses the same constants for its Pydantic field defaults.

Changing a default in `config.py` updates both the service entry point and the underlying analysis without requiring structural changes elsewhere.

