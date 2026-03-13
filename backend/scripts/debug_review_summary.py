"""
Manual debug script for review_analysis summarization with local Apify JSON.

Examples:
  python scripts/debug_review_summary.py
  python scripts/debug_review_summary.py --show-raw-llm
  python scripts/debug_review_summary.py --output seed/debug_review_summary_result.json
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.services.review_analysis import (
    ReviewAnalysisRequest,
    analyze_reviews,
    build_orchestrator_summary_payload,
    load_reviews_from_exported_json,
    summarize_reviews_with_debug,
)

DEFAULT_JSON_FILE = (
    BACKEND_ROOT
    / "seed"
    / "dataset_Google-Maps-Reviews-Scraper_2026-03-10_18-07-20-965.json"
)


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Debug review summary with local JSON")
    parser.add_argument("--json-file", default=str(DEFAULT_JSON_FILE), help="Path to local Apify exported JSON")
    parser.add_argument("--top-k-positive", type=int, default=30)
    parser.add_argument("--top-k-negative", type=int, default=30)
    parser.add_argument(
        "--skip-empty-text-for-summarization",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Whether to ignore empty review text during summarization selection",
    )
    parser.add_argument("--output", default=None, help="Optional output JSON file path")
    parser.add_argument(
        "--show-raw-llm",
        action="store_true",
        help="Print and save raw LLM output(s) for debugging",
    )
    return parser.parse_args()


def _load_raw_items(path: Path) -> list[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        payload = json.load(f)
    if not isinstance(payload, list):
        raise ValueError(f"Expected JSON array in {str(path)!r}")
    return [item for item in payload if isinstance(item, dict)]


def _print_samples(title: str, reviews: list[Any], n: int = 3) -> None:
    print(title)
    if not reviews:
        print("  (none)")
        return
    for r in reviews[:n]:
        text_preview = (r.text or "").replace("\n", " ")[:120]
        print(f"  - [★{r.stars:.1f}] {text_preview}")


def _sample_quotes(reviews: list[Any], n: int = 3, max_chars: int = 140) -> list[str]:
    quotes: list[str] = []
    for r in reviews:
        text = (r.text or "").replace("\n", " ").strip()
        if not text:
            continue
        quotes.append(text[:max_chars])
        if len(quotes) >= n:
            break
    return quotes


def main() -> None:
    started_at = time.perf_counter()
    args = _parse_args()

    json_path = Path(args.json_file)

    raw_items = _load_raw_items(json_path)
    first_keys = sorted(raw_items[0].keys()) if raw_items else []
    print(f"first raw item keys: {first_keys}")

    reviews = load_reviews_from_exported_json(str(json_path))

    filtering_started_at = time.perf_counter()
    analysis = analyze_reviews(
        ReviewAnalysisRequest(
            reviews=reviews,
            top_k_positive=args.top_k_positive,
            top_k_negative=args.top_k_negative,
            skip_empty_text_for_summarization=args.skip_empty_text_for_summarization,
        )
    )
    filtering_seconds = time.perf_counter() - filtering_started_at

    summary_result, summary_debug = summarize_reviews_with_debug(
        positive_reviews=analysis.positive_reviews,
        negative_reviews=analysis.negative_reviews,
        show_raw_llm=args.show_raw_llm,
    )

    summarization_api_seconds = float(summary_debug.get("total_api_latency_seconds", 0.0))
    total_runtime_seconds = time.perf_counter() - started_at

    print("\n=== Review Summary Debug Report ===")
    print(f"raw item count: {len(raw_items)}")
    print(f"mapped review count: {len(reviews)}")
    print(f"deduplicated count: {len(analysis.all_reviews_with_rating)}")
    print(f"text review count: {len(analysis.text_reviews)}")
    print(f"empty text review count: {analysis.stats.empty_text_review_count}")
    print(f"selected positive review count: {len(analysis.positive_reviews)}")
    print(f"selected negative review count: {len(analysis.negative_reviews)}")
    print(f"average rating: {analysis.stats.avg_rating_recent}")
    print(f"rating distribution: {analysis.stats.rating_distribution}")
    print("strengths:", summary_result.strengths)
    print("weaknesses:", summary_result.weaknesses)
    print("positive_aspects:", summary_result.positive_aspects)
    print("negative_aspects:", summary_result.negative_aspects)
    print(f"confidence: {summary_result.confidence}")
    print(f"summary: {summary_result.summary}")
    print(f"filtering time (s): {filtering_seconds:.3f}")
    print(f"summarization API time (s): {summarization_api_seconds:.3f}")
    print(f"total script runtime (s): {total_runtime_seconds:.3f}")

    _print_samples("sample positive reviews:", analysis.positive_reviews, n=3)
    _print_samples("sample negative reviews:", analysis.negative_reviews, n=3)

    positive_sample_quotes = _sample_quotes(analysis.positive_reviews, n=3)
    negative_sample_quotes = _sample_quotes(analysis.negative_reviews, n=3)
    print("positive_sample_quotes:", positive_sample_quotes)
    print("negative_sample_quotes:", negative_sample_quotes)

    if args.show_raw_llm:
        raw_outputs = summary_debug.get("raw_llm_output", [])
        print("raw llm output:")
        if not raw_outputs:
            print("  (none)")
        for i, raw in enumerate(raw_outputs, 1):
            print(f"  attempt {i}: {raw[:1000]}")

    if args.output:
        output_payload = {
            "input": {
                "json_file": str(json_path),
                "top_k_positive": args.top_k_positive,
                "top_k_negative": args.top_k_negative,
                "skip_empty_text_for_summarization": args.skip_empty_text_for_summarization,
                "raw_item_count": len(raw_items),
                "mapped_review_count": len(reviews),
                "first_raw_item_keys": first_keys,
            },
            "stats": {
                "deduplicated_count": len(analysis.all_reviews_with_rating),
                "text_review_count": len(analysis.text_reviews),
                "empty_text_review_count": analysis.stats.empty_text_review_count,
                "selected_positive_review_count": len(analysis.positive_reviews),
                "selected_negative_review_count": len(analysis.negative_reviews),
                "avg_rating_recent": analysis.stats.avg_rating_recent,
                "rating_distribution": analysis.stats.rating_distribution,
            },
            "selected_reviews": {
                "positive": [r.model_dump(mode="json") for r in analysis.positive_reviews],
                "negative": [r.model_dump(mode="json") for r in analysis.negative_reviews],
            },
            "summary_result": summary_result.model_dump(mode="json"),
            "orchestrator_payload": build_orchestrator_summary_payload(summary_result),
            "evidence": {
                "positive_sample_quotes": positive_sample_quotes,
                "negative_sample_quotes": negative_sample_quotes,
            },
            "timing": {
                "filtering_seconds": round(filtering_seconds, 6),
                "summarization_seconds": round(summarization_api_seconds, 6),
                "total_runtime_seconds": round(total_runtime_seconds, 6),
            },
        }
        if args.show_raw_llm:
            output_payload["summary_result"]["raw_llm_output"] = summary_debug.get(
                "raw_llm_output", []
            )

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("w", encoding="utf-8") as f:
            json.dump(output_payload, f, ensure_ascii=False, indent=2)
        print(f"saved output: {output_path}")


if __name__ == "__main__":
    main()
