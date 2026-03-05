"""
Intent Parser Agent  (Backend-1 — yours to implement)
------------------------------------------------------
Input:  state["raw_input"], state["location"]
Output: state["structured_request"]  (see StructuredRequest in schemas.py)

TODO:
  1. Call Claude with a system prompt that instructs it to return structured JSON
  2. Parse the JSON response into a StructuredRequest dict
  3. Handle edge cases: missing time → default to now+1h, missing radius → 5km
  4. Call add_step() to log the trace
"""
import time
import uuid
from datetime import datetime

from app.agents.state import PlannerState
from app.agents.trace import add_step
# from app.config import ANTHROPIC_API_KEY, DEFAULT_MODEL
# import anthropic


def run(state: PlannerState) -> PlannerState:
    start = time.time() * 1000

    # TODO: build prompt and call Claude API
    # client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    # response = client.messages.create(...)
    # parsed = json.loads(response.content[0].text)

    # Stub — replace with real LLM output
    parsed = {
        "category": "general",
        "requested_time": datetime.now().isoformat(),
        "radius_km": 5.0,
        "constraints": {},
    }

    structured = {
        "id": str(uuid.uuid4()),
        "raw_input": state["raw_input"],
        "category": parsed["category"],
        "requested_time": parsed["requested_time"],
        "location": state["location"],
        "radius_km": parsed["radius_km"],
        "constraints": parsed["constraints"],
        "status": "open",
        "created_at": datetime.now().isoformat(),
    }

    state["structured_request"] = structured
    state["trace"] = add_step(
        state["trace"],
        agent="intent_parser",
        input_data={"raw_input": state["raw_input"]},
        output_data={"structured_request": structured},
        start_ms=start,
    )
    return state
