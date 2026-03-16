"""
Context selection and enrichment for the synthesis_agent.

Responsible for:
- Selecting which results to include in synthesis (budget-aware in future)
- Building enriched context items with all available signals
- Normalizing data from multiple sources (ranked_offers, review_summaries)
"""


def build_context_item(
    result_item: dict,
    ranked_item: dict | None,
    review_item: dict | None,
    config: dict | None = None,
) -> dict:
    """Build a single contextual item for synthesis.
    
    Combines data from result (final_results), ranked (ranked_offers),
    and review (review_summaries) into a unified context object.
    
    Args:
        result_item: Item from final_results (has: place_id, name, rating, distance_km, 
                     recommendation_score, reason_tags, one_sentence_recommendation,
                     review_summary_text, transit, etc.)
        ranked_item: Item from ranked_offers map {place_id -> ranked_offer}
                     (has: id, rating, distance_km, score, etc.)
        review_item: Item from review_summaries map {place_id -> review_summary}
                     (has: place_id, advantages, disadvantages, summary, etc.)
        config: Dict with signal toggles (ENABLE_REVIEW_SIGNALS, ENABLE_REVIEW_DISADVANTAGES, etc.)
    
    Returns:
        Dict with: name, rating, distance_km, recommendation_score, transit_summary,
                   one_sentence_recommendation, review_advantages, review_disadvantages,
                   review_summary_text, reason_tags, etc.
    """
    if config is None:
        config = {}
    
    # Unpack signal toggles with defaults (Phase-1 compat)
    enable_review = config.get("ENABLE_REVIEW_SIGNALS", True)
    enable_review_disadvantages = config.get("ENABLE_REVIEW_DISADVANTAGES", False)
    enable_ranking = config.get("ENABLE_RANKING_SIGNALS", True)
    
    ranked_item = ranked_item or {}
    review_item = review_item or {}
    
    # Build base context item
    context_item = {
        "name": result_item.get("name", ""),
        "rating": ranked_item.get("rating", result_item.get("rating")),
        "distance_km": ranked_item.get("distance_km", result_item.get("distance_km")),
        "recommendation_score": result_item.get("recommendation_score"),
        "transit_summary": (result_item.get("transit") or {}).get("summary", ""),
        "one_sentence_recommendation": result_item.get("one_sentence_recommendation", ""),
        "review_summary_text": result_item.get("review_summary_text", ""),
    }
    
    # Add review signals if enabled
    if enable_review:
        advantages = review_item.get("advantages", [])
        if not isinstance(advantages, list):
            advantages = []
        context_item["review_advantages"] = advantages
        
        # Include disadvantages if explicitly enabled (Phase-2+)
        if enable_review_disadvantages:
            disadvantages = review_item.get("disadvantages", [])
            if not isinstance(disadvantages, list):
                disadvantages = []
            context_item["review_disadvantages"] = disadvantages
    else:
        context_item["review_advantages"] = []
    
    # Add ranking signals if enabled
    if enable_ranking:
        reason_tags = result_item.get("reason_tags", [])
        if not isinstance(reason_tags, list):
            reason_tags = []
        context_item["reason_tags"] = reason_tags
    
    return context_item


def select_synthesis_context(
    final_results: list[dict],
    ranked_offers: list[dict],
    review_summaries: list[dict],
    config: dict | None = None,
) -> list[dict]:
    """Select and enrich top results for synthesis context.
    
    Phase-1 behavior: Simple top-N selection without budget calculation.
    Future (Phase-2+): Token budget-aware selection with early truncation.
    
    Args:
        final_results: List from state["final_results"] (already ranked and limited to ~10)
        ranked_offers: List from state["ranked_offers"] (for score/metadata lookup)
        review_summaries: List from state["review_summaries"] (for advantages/disadvantages)
        config: Dict with MAX_PLACES_IN_CONTEXT, signal toggles, budget_tokens, etc.
    
    Returns:
        List of enriched context items, up to MAX_PLACES_IN_CONTEXT in size
    """
    if config is None:
        config = {}
    
    max_places = config.get("MAX_PLACES_IN_CONTEXT", 3)
    
    # Build lookup maps for O(1) joins
    ranked_map = {p.get("id", ""): p for p in ranked_offers if isinstance(p, dict)}
    review_map = {r.get("place_id", ""): r for r in review_summaries if isinstance(r, dict)}
    
    # Select and enrich top N results
    top_context = []
    for item in final_results[:max_places]:
        place_id = item.get("place_id", "")
        ranked_item = ranked_map.get(place_id)
        review_item = review_map.get(place_id)
        
        context_item = build_context_item(item, ranked_item, review_item, config)
        top_context.append(context_item)
    
    return top_context
