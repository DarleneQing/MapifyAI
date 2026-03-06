"""
Intent Parser Agent  (Backend-1 — yours to implement)
------------------------------------------------------
Input:  state["raw_input"], state["location"]
Output: state["structured_request"]  (see StructuredRequest in schemas.py)

TODO:
  1. Call OpenAI with a system prompt that instructs it to return structured JSON
  2. Parse the JSON response into a StructuredRequest dict
  3. Handle edge cases: missing time → default to now+1h, missing radius → 5km
  4. Call add_step() to log the trace
"""
import json
import time
import uuid
from datetime import datetime, timedelta

from openai import OpenAI

from app.agents.state import PlannerState
from app.agents.trace import add_step
from app.config import OPENAI_API_KEY, DEFAULT_MODEL

client = OpenAI(api_key=OPENAI_API_KEY)

SYSTEM_PROMPT = """You are an intent parser for a local services marketplace in Zurich.
Extract structured information from the user's request and return ONLY a JSON object with:
- category: string, one of: haircut, massage, dentist, repair, nails, physiotherapy, general
- requested_time: ISO 8601 datetime string (if vague like "this afternoon" use today 15:00, "now" use current time, "tomorrow" use tomorrow 10:00)
- radius_km: float (default 5.0, use smaller like 2.0 if user says "nearby" or "walking distance")
- constraints: object with optional keys: max_price (number), language (string), notes (string)

Today is {today}. Current time is {now}. User location: lat={lat}, lng={lng}.
Respond with ONLY the JSON object."""


def run(state: PlannerState) -> PlannerState:
    start = time.time() * 1000
    now = datetime.now()
    loc = state["location"]

    prompt = SYSTEM_PROMPT.format(
        today=now.strftime("%Y-%m-%d"),
        now=now.strftime("%H:%M"),
        lat=loc["lat"],
        lng=loc["lng"],
    )

    response = client.chat.completions.create(
        model=DEFAULT_MODEL,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": state["raw_input"]},
        ],
    )
    parsed = json.loads(response.choices[0].message.content)

    # Fallback for missing time
    if not parsed.get("requested_time"):
        parsed["requested_time"] = (now + timedelta(hours=1)).isoformat()

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
