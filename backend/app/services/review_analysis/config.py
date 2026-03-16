"""
Centralized tunable hyperparameters for the ``review_analysis`` module.

Edit the values in this file to change default behavior without touching
the rest of the pipeline code.
"""

from __future__ import annotations

# ---------------------------------------------------------------------------
# Filtering / selection defaults
# ---------------------------------------------------------------------------

TOP_K_POSITIVE_DEFAULT: int = 20
TOP_K_NEGATIVE_DEFAULT: int = 20

# Stars >= this threshold → "positive"; strictly below → "negative"
POSITIVE_THRESHOLD_DEFAULT: float = 4.0

# When True, reviews with empty / blank text are excluded from summarization
SKIP_EMPTY_TEXT_FOR_SUMMARIZATION_DEFAULT: bool = True


# ---------------------------------------------------------------------------
# Scraper / dataset defaults
# ---------------------------------------------------------------------------

# Maximum number of reviews that the Apify actor should fetch
MAX_REVIEWS_DEFAULT: int = 50

# Relative time range for reviews, passed through to the scraper
REVIEWS_START_DATE_DEFAULT: str = "1 year"

# Review language code understood by the scraper (e.g. "en", "de")
LANGUAGE_DEFAULT: str = "en"

# Whether to allow personal data collection in the scraper
PERSONAL_DATA_DEFAULT: bool = False


# ---------------------------------------------------------------------------
# Debugging / observability defaults
# ---------------------------------------------------------------------------

DEBUG_INCLUDE_SELECTED_REVIEWS_DEFAULT: bool = False

