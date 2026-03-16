import os

# ---------------------------------------------------------------------------
# Ranking hyperparameters — single source of truth for all tunable constants
# used by ranking.py and explanation.py.
# ---------------------------------------------------------------------------

# --- Price ---
# Hard penalty assigned when no price signal exists for a provider.
# 0.0 means the provider is ranked as if it had the worst possible price.
PRICE_MISSING_SCORE: float = 0.0

# --- Travel ---
# Backend-only debug switch. Not exposed to users.
# "commute_time"  — prefer commute_time_minutes; fallback to distance_km
# "distance"      — always use distance_km (reproduces pre-travel-abstraction behavior)
TRAVEL_MODE: str = os.getenv("RANKING_TRAVEL_MODE", "commute_time")

# Fallback travel value used when all travel signals are absent.
DEFAULT_TRAVEL_FALLBACK: float = 50.0

# --- Rating normalization bounds (fixed domain scale) ---
RATING_MIN: float = 1.0
RATING_MAX: float = 5.0

# ---------------------------------------------------------------------------
# Follow-up items (not changed this round):
# - explanation.py priority contribution threshold (>= 0.2) should be
#   moved here in a future round.
# ---------------------------------------------------------------------------
