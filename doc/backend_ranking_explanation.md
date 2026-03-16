# Backend Ranking and Explanation

## 1. Overview

This document describes the current deterministic ranking and explanation behavior implemented in:

- backend/app/services/ranking.py
- backend/app/services/explanation.py
- backend/app/models/schemas.py
- backend/app/ranking_config.py
- backend/tests/test_ranking.py

The code is the source of truth. This document mirrors current behavior and avoids redesign.

## 2. Ranking Algorithm

### Input Data Structure

`rank_offers(providers, prefs)` expects:

- `providers`: list of dictionaries, each typically containing:
  - `id`
  - `price` (optional)
  - `price_range` (optional, e.g. `CHF 30-60` or `CHF 30–60`)
  - `commute_time_minutes` (optional, primary travel signal)
  - `distance_km` (optional, fallback travel signal)
  - `rating` (optional)
- `prefs`: `UserPreferences` from `backend/app/models/schemas.py`:
  - `weight_price`
  - `weight_travel`
  - `weight_rating`

### Normalization Logic

For each provider:

- Price resolution:
  - Use `price` if present and numeric.
  - Otherwise parse midpoint from `price_range` using numeric extraction.
  - If neither exists: no fabricated fallback. `price_score` is set to `PRICE_MISSING_SCORE = 0.0` (hard penalty). Output `price` field will be `None`.
  - Min/max for price normalization is computed only from providers with a known price signal (`known_prices`). Providers with no price signal skip min/max entirely.
- Travel signal resolution (via `_safe_travel`):
  - Primary: `commute_time_minutes` when `TRAVEL_MODE = "commute_time"` (default).
  - Fallback: `distance_km` when `commute_time_minutes` is absent.
  - Final fallback: `DEFAULT_TRAVEL_FALLBACK = 50.0` when both are missing.
  - `TRAVEL_MODE = "distance"` forces distance-only mode (backend debug switch via `RANKING_TRAVEL_MODE` env var, not user-facing).
- Rating resolution:
  - Prefer provider `rating`, then offer `rating`.
  - Fallback default: `3.0`.

Global min/max for travel are computed across the full candidate set.

Dimension score normalization:

- Generic function: clamp to `[0, 1]` after min-max scaling.
- If `max == min`, return `1.0` (safe divide-by-zero handling).
- Price score: inverted min-max (lower price -> higher score).
- Distance score: inverted min-max (shorter distance -> higher score).
- Rating score: direct normalization from fixed range `[1.0, 5.0]`.

### Scoring Formula

Let:

- `P = price_score`
- `D = travel_score`
- `R = rating_score`
- `wp, wd, wr = normalized preference weights`

Then:

`total_score = wp * P + wd * D + wr * R`

Stored outputs are rounded to 4 decimals:

- `score`
- `score_breakdown.price_score`
- `score_breakdown.travel_score`
- `score_breakdown.rating_score`

### Weight Usage

Weights are normalized by sum.

Current behavior:

- Negative preference values are treated as `0.0` before normalization.
- If effective total is `<= 0`, fallback to equal weights `(1/3, 1/3, 1/3)`.

This keeps ranking consistent with explanation weight handling and avoids out-of-range scores under invalid negative inputs.

### Sorting Logic

Rows are sorted by `score` descending.

Implementation uses Python list sort with key `score`, `reverse=True`.

### Output Format

Each returned row is a shallow copy of the provider dict, enriched with:

- `price` (resolved from price signal; `None` when no price information exists — no fabricated value substituted)
- `score` (float, rounded)
- `score_breakdown`:
  - `price_score` (`0.0` when price is unknown)
  - `travel_score`
  - `rating_score`

## 3. Scoring Formula

Per provider:

1. Resolve raw signals: price → `float | None`; travel → `float` (commute_time or distance); rating → `float` with 3.0 fallback.
2. Compute dimension scores: price absent → `PRICE_MISSING_SCORE = 0.0`; otherwise min-max normalization to `[0,1]`.
3. Normalize user weights.
4. Compute weighted sum.
5. Round to 4 decimals.

This is deterministic and data-driven; no model inference is involved.

## 4. Preference Weight Handling

Both ranking and explanation use the same effective interpretation:

- non-negative weights only
- normalized by total
- equal fallback when total is non-positive

Practical effect:

- users can emphasize one dimension by raising its weight
- all-zero (or effectively zero) preferences produce neutral equal weighting

## 5. Explanation Generation

`attach_explanations(ranked_offers, prefs)` calls `explain_offer` per row.

### How Explanation Text Is Derived

Reasons are generated from existing factual fields only:

- Price reason:
  - `Price: CHF <value>` from numeric `price`
  - else `Price range: <price_range>`
- Distance reason:
  - `Distance: <km> km` and optional ETA if `eta_minutes` exists
  - else formatted `time_label` if available (including numeric conversion to minutes)
- Rating reason:
  - `Rating: <value>/5`

If a dimension has no factual signal, explanation can include:

- `Price details are currently unavailable`
- `Distance details are currently unavailable`
- `Rating details are currently unavailable`

### Which Fields Are Used

Potential input fields used by explanation logic:

- `price`, `price_range`
- `distance_km`, `eta_minutes`, `time_label`
- `rating`
- `score_breakdown` (`price_score`, `travel_score`, `rating_score`)
- optional `prefs`

### Ordering and Priority Signal

Reason order is contribution-based:

- with prefs: `contribution = normalized_weight * dimension_score`
- without prefs: `contribution = dimension_score`

Optional preference line:

- `Matches your priority: <dimension>`

This line is added only when:

- a user priority exists,
- that priority dimension is available for this offer,
- and it is also the offer's strongest contributing dimension,
- with contribution threshold `>= 0.2`.

Final output is capped at top 3 lines.

### Guarantee: No Hallucinated Facts

Explanation strings are composed from existing offer/provider fields and fixed templates only.
No LLM call or generated external fact is used.

## 6. Example Flow

Input providers:

- A: `price=80`, `distance_km=1.0`, `rating=4.6`
- B: `price_range=CHF 20-40`, `distance_km=2.5`, `rating=4.4`

Prefs:

- `weight_price=0.6`, `weight_travel=0.2`, `weight_rating=0.2`

Flow:

1. Resolve B price midpoint as `30.0` from `price_range`.
2. Price min/max from known prices only: `[30.0, 80.0]`. Travel min/max from all providers via `_safe_travel` (falls back to `distance_km` since neither has `commute_time_minutes`).
3. Normalize dimension scores. `travel_score` is inverted (shorter travel = higher score).
4. Normalize weights: `(0.6, 0.2, 0.2)` already sum to 1.0.
5. Compute weighted scores and sort descending.
6. Attach reasons from factual fields ordered by contribution.

## 7. Known Limitations

- Min-max scaling is dataset-relative; adding/removing candidates can shift all normalized scores.
- When all candidates share the same value in one dimension, that dimension score becomes `1.0` for all.
- Tie-breaking is implicit through Python stable sort by score (input order preserved for equal scores).
- Missing factual fields produce explicit unavailable reasons instead of inferred substitutes.
- Explanation quality depends on available structured fields (price/distance/rating/time labels).
- Providers with no price signal receive `price_score = 0.0` (hard penalty); they will rank below comparably-rated and located priced providers whenever price weight is non-zero.
- `commute_time_minutes` and `distance_km` use different units (minutes vs km). When both coexist in the same candidate list under fallback conditions, the shared min/max pool may introduce a relative scale bias.

## Hyperparameter Config Location

All ranking tunable constants are centralized in `backend/app/ranking_config.py`:

| Constant | Value | Purpose |
|---|---|---|
| `PRICE_MISSING_SCORE` | `0.0` | Hard penalty score when no price signal exists |
| `TRAVEL_MODE` | `"commute_time"` (default via env) | Primary travel signal selection |
| `DEFAULT_TRAVEL_FALLBACK` | `50.0` | Used when all travel signals absent |
| `RATING_MIN` | `1.0` | Lower bound for rating normalization |
| `RATING_MAX` | `5.0` | Upper bound for rating normalization |

The env var `RANKING_TRAVEL_MODE` overrides `TRAVEL_MODE` at startup. This is a backend-only debug switch.

Follow-up item (not yet moved): `explanation.py` priority contribution threshold `>= 0.2` is a fixed inline constant; it should be migrated to `ranking_config.py` in the next config-consolidation round.

## Design Constraints Summary

Current design satisfies:

- deterministic behavior
- explainable score decomposition (`score_breakdown` + textual reasons)
- no LLM usage in ranking/explanation modules
- lightweight computation (simple parsing, normalization, weighted sum, sorting)
- provider-first ranked entity; `Offer` is reserved as a future optional price-override hook

## Consistency Verification Log

### Round 1 (2026-03-16)

- Audited `ranking.py`, `explanation.py`, `schemas.py`, `test_ranking.py`.
- Fixed: `ranking._normalised_weights` now clamps negative weights to `0.0`, matching `explanation` semantics.
- Added: `test_rank_clamps_negative_weights_to_zero_semantics`.
- Backward compatible for all valid (non-negative) inputs.

### Round 2 (2026-03-16)

Changes implemented:

- `distance_score` renamed to `travel_score` in all ranking outputs, explanation reads, and tests.
- Travel signal abstracted via `_safe_travel()`: `commute_time_minutes` → fallback `distance_km` → fallback `DEFAULT_TRAVEL_FALLBACK`.
- Price fabricated fallback (`50.0`) removed. Missing price → `price_score = PRICE_MISSING_SCORE = 0.0` (hard penalty). Output `price` field may be `None`.
- Price min/max computed only from providers with known price signals; unknown-price providers excluded from min/max pool.
- `_effective_price(provider, offer=None)` hook added as future Offer-based price override extension point.
- All tunable constants moved to `backend/app/ranking_config.py`.
- `Provider.price_range` made optional (`str | None = None`) in schemas.
- `Provider.commute_time_minutes: int | None = None` added to schemas.
- 4 new tests added: missing-price hard penalty, price normalization isolation, commute-time preference, distance fallback.

All 15 tests pass.
