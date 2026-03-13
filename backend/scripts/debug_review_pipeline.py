"""
Manual debug script for Step 4 end-to-end review_analysis pipeline.

Examples:
  python scripts/debug_review_pipeline.py --dataset-id <DATASET_ID>
  python scripts/debug_review_pipeline.py --place-url "https://maps.google.com/..."
  python scripts/debug_review_pipeline.py --place-url "https://maps.google.com/..." --debug-include-selected-reviews --output seed/debug_pipeline.json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.review_analysis import analyze_and_summarize_reviews


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Debug end-to-end review pipeline")
    parser.add_argument("--place-url", default=None, help="Google Maps place URL")
    parser.add_argument("--dataset-id", default=None, help="Existing Apify dataset ID")
    parser.add_argument("--top-k-positive", type=int, default=30)
    parser.add_argument("--top-k-negative", type=int, default=30)
    parser.add_argument(
        "--skip-empty-text-for-summarization",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Whether to ignore empty review text during summarization selection",
    )
    parser.add_argument("--output", default=None, help="Optional output JSON path")
    parser.add_argument(
        "--debug-include-selected-reviews",
        action="store_true",
        help="Include selected reviews in debug output",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()

    result = analyze_and_summarize_reviews(
        dataset_id=args.dataset_id,
        place_url=args.place_url,
        top_k_positive=args.top_k_positive,
        top_k_negative=args.top_k_negative,
        skip_empty_text_for_summarization=args.skip_empty_text_for_summarization,
        debug_include_selected_reviews=args.debug_include_selected_reviews,
    )

    payload = result["orchestrator_payload"]
    debug = result["debug"]

    print("=== Review Pipeline Debug Report ===")
    print(f"mode: {debug['mode']}")
    print(f"dataset_id: {result['dataset_id']}")
    print(f"strengths: {payload['strengths']}")
    print(f"weaknesses: {payload['weaknesses']}")
    print(f"positive_aspects: {payload['positive_aspects']}")
    print(f"negative_aspects: {payload['negative_aspects']}")
    print(f"confidence: {payload['confidence']}")
    print(f"summary: {payload['summary']}")
    print(f"avg_rating_recent: {payload['avg_rating_recent']}")
    print(f"rating_distribution: {payload['rating_distribution']}")
    print(f"text_review_count: {payload['text_review_count']}")
    print(f"empty_text_review_count: {payload['empty_text_review_count']}")
    print(f"selected_positive_review_count: {payload['selected_positive_review_count']}")
    print(f"selected_negative_review_count: {payload['selected_negative_review_count']}")

    print("\n=== Timing ===")
    print(f"actor_runtime_seconds: {debug['actor_runtime_seconds']:.3f}")
    print(f"filtering_seconds: {debug['filtering_seconds']:.3f}")
    print(f"summarization_seconds: {debug['summarization_seconds']:.3f}")
    print(f"total_runtime_seconds: {debug['total_runtime_seconds']:.3f}")

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"saved output: {output_path}")


if __name__ == "__main__":
    main()
