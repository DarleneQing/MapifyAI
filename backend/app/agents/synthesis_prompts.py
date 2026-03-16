"""
Synthesis prompt builder for the synthesis_agent node.

Responsible for:
- Building the complete LLM prompt from structured inputs
- Applying style/tone configuration
- Managing context length guidance
"""

import json


def _build_system_prompt(tone: str) -> str:
    """Build the system prompt with tone guidance.
    
    Args:
        tone: 'helpful', 'neutral', or 'enthusiastic'
    
    Returns:
        System prompt instruction string
    """
    base = "You are a local recommendations assistant in Zurich."
    
    tone_guidance = {
        "helpful": "Be warm and genuinely helpful, highlighting why each place fits the user's needs.",
        "neutral": "Provide a balanced, factual summary without embellishment.",
        "enthusiastic": "Be engaging and convey genuine enthusiasm about the recommendations.",
    }
    
    guidance = tone_guidance.get(tone, tone_guidance["helpful"])
    
    return (
        f"{base}\n"
        f"{guidance}\n"
        f"You return only valid JSON."
    )


def _build_length_constraint(length: str) -> str:
    """Build the text constraint based on desired reply length.
    
    Args:
        length: 'short' (1-2 sentences), 'medium' (2-3), 'long' (4+)
    
    Returns:
        Constraint string for inclusion in prompt
    """
    constraints = {
        "short": "1-2 sentences, max 40 words",
        "medium": "2-3 sentences, max 70 words",
        "long": "3-4 sentences, max 100 words",
    }
    return constraints.get(length, constraints["medium"])


def build_synthesis_prompt(
    structured_request: dict | None,
    top_context: list[dict],
    result_count: int,
    config: dict | None = None,
) -> str:
    """Build the complete synthesis prompt for the LLM.
    
    Args:
        structured_request: dict with raw_input, category, constraints from intent_parser
        top_context: list of context_item dicts (already filtered by context selection)
        result_count: total number of results from pipeline
        config: dict with config values (SYNTHESIS_REPLY_LENGTH, SYNTHESIS_TONE, etc.)
                If None, uses hardcoded defaults
    
    Returns:
        Complete prompt string ready for LLM
    """
    if config is None:
        config = {}
    
    # Unpack config with fallback defaults
    reply_length = config.get("SYNTHESIS_REPLY_LENGTH", "medium")
    tone = config.get("SYNTHESIS_TONE", "helpful")
    
    req = structured_request or {}
    raw_input = (req.get("raw_input") or "").strip()
    category = (req.get("category") or "").strip()
    constraints = req.get("constraints") or {}
    
    # Build system message
    system_msg = _build_system_prompt(tone)
    
    # Build constraints text
    length_constraint = _build_length_constraint(reply_length)
    
    # Build user prompt with all context
    user_prompt = f"""Write a concise conversational reply ({length_constraint}) that summarizes the recommendation outcome.
Mention how results fit the user's intent and reflect ranking, review, and travel feasibility signals.

User query: {raw_input}
Category: {category}
Constraints: {json.dumps(constraints, ensure_ascii=False)}
Result count: {result_count}

Top places:
{json.dumps(top_context, ensure_ascii=False)}

Return JSON only:
{{
  "agent_reply": "<final conversational reply>"
}}"""
    
    return {
        "system": system_msg,
        "user": user_prompt,
    }
