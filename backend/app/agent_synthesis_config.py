"""Configuration knobs for backend synthesis_agent generation.

This file is intentionally separate so synthesis hyperparameters can be tuned
without touching ranking/review/orchestrator logic.

Grouped by functionality:
- Context Selection: budget and result limits
- Signal Toggles: which data to include in synthesis context
- Reply Style: tone and length guidance for LLM
- Fallback: error handling behavior
"""

# ─────────────────────────────────────────────────────────────────────────
# Context Selection & Budget
# ─────────────────────────────────────────────────────────────────────────
# Maximum places to include in synthesis context (fallback/safety limit)
MAX_PLACES_IN_CONTEXT = 3

# Token budget for synthesis context + reply (rough estimate)
# Used for intelligent selection; if calculation fails, falls back to MAX_PLACES_IN_CONTEXT
SYNTHESIS_BUDGET_TOKENS = 2000

# ─────────────────────────────────────────────────────────────────────────
# Signal Toggles: which data to include in synthesis context
# ─────────────────────────────────────────────────────────────────────────
# Include review advantages in context (from review_router output)
ENABLE_REVIEW_SIGNALS = True

# Include review disadvantages (in addition to advantages)
# False = Phase-1 behavior (no disadvantages); True = expanded context
ENABLE_REVIEW_DISADVANTAGES = False

# Include ranking signals: recommendation_score and reason_tags
ENABLE_RANKING_SIGNALS = True

# Include structured constraints in context (e.g., time, price, accessibility)
ENABLE_CONSTRAINT_SIGNALS = True

# ─────────────────────────────────────────────────────────────────────────
# Reply Style & Generation
# ─────────────────────────────────────────────────────────────────────────
# Desired reply length: 'short' (1-2 sentences), 'medium' (2-3), 'long' (4+)
# Used as a hint in the system prompt to guide LLM conciseness
SYNTHESIS_REPLY_LENGTH = "medium"

# Tone for the reply: 'helpful', 'neutral', 'enthusiastic'
# Used as a style hint in the system prompt
SYNTHESIS_TONE = "helpful"

# ─────────────────────────────────────────────────────────────────────────
# Fallback & Error Handling
# ─────────────────────────────────────────────────────────────────────────
# If LLM call fails or returns empty, use template-based fallback
SYNTHESIS_FALLBACK_ENABLED = True
