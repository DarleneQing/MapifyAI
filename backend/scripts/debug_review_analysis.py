"""
Manual debug script for review_analysis with local exported Apify JSON.

Example:
    python scripts/debug_review_analysis.py \
      --json-file seed/dataset_Google-Maps-Reviews-Scraper_2026-03-10_18-07-20-965.json \
      --debug \
      --output debug_review_result.json
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.review_analysis import (
    ReviewAnalysisRequest,
    analyze_reviews,
    load_reviews_from_exported_json,
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Debug review_analysis with local Apify JSON")
    parser.add_argument("--json-file", required=True, help="Path to exported Apify JSON file")
    parser.add_argument("--output", default=None, help="Optional output JSON file path")
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Print extra debugging info (including first raw item keys)",
    )
    parser.add_argument("--provider-id", default=None, help="Optional provider ID")
    parser.add_argument("--limit", type=int, default=None, help="Optional max raw items to process")
    parser.add_argument("--top-k-positive", type=int, default=30)
    parser.add_argument("--top-k-negative", type=int, default=30)
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    json_path = Path(args.json_file)
    with json_path.open("r", encoding="utf-8") as f:
        raw_payload = json.load(f)

    if not isinstance(raw_payload, list):
        raise ValueError("Input JSON must be an array of raw Apify items")

    raw_items = [item for item in raw_payload if isinstance(item, dict)]
    if args.limit is not None:
        raw_items = raw_items[: args.limit]

    if args.debug:
        first_keys = sorted(raw_items[0].keys()) if raw_items else []
        print(f"first raw item keys: {first_keys}")

    reviews = load_reviews_from_exported_json(
        json_file_path=str(json_path),
        provider_id=args.provider_id,
        limit=args.limit,
    )

    result = analyze_reviews(
        ReviewAnalysisRequest(
            reviews=reviews,
            top_k_positive=args.top_k_positive,
            top_k_negative=args.top_k_negative,
            skip_empty_text_for_summarization=True,
        )
    )

    print(f"raw item count: {len(raw_items)}")
    print(f"mapped review count: {len(reviews)}")
    print(f"deduplicated count: {len(result.all_reviews_with_rating)}")
    print(f"text review count: {len(result.text_reviews)}")
    print(f"empty text review count: {result.stats.empty_text_review_count}")
    print(f"avg rating: {result.stats.avg_rating_recent}")
    print(f"rating distribution: {result.stats.rating_distribution}")

    print("first 5 positive reviews:")
    for review in result.positive_reviews[:5]:
        text_preview = (review.text or "").replace("\n", " ")[:120]
        print(f"- stars={review.stars}, date={review.date.isoformat()}, text={text_preview}")

    print("first 5 negative reviews:")
    for review in result.negative_reviews[:5]:
        text_preview = (review.text or "").replace("\n", " ")[:120]
        print(f"- stars={review.stars}, date={review.date.isoformat()}, text={text_preview}")

    if args.output:
        output_payload = {
            "raw_item_count": len(raw_items),
            "mapped_review_count": len(reviews),
            "deduplicated_count": len(result.all_reviews_with_rating),
            "text_review_count": len(result.text_reviews),
            "stats": result.stats.model_dump(mode="json"),
            "positive_reviews": [r.model_dump(mode="json") for r in result.positive_reviews],
            "negative_reviews": [r.model_dump(mode="json") for r in result.negative_reviews],
        }
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(output_payload, f, ensure_ascii=False, indent=2)
        print(f"saved output: {output_path}")


if __name__ == "__main__":
    main()
