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

SYSTEM_PROMPT = """You are an intent parser for a local places discovery app in Zurich.
Extract structured information from the user's request and return ONLY a JSON object with:
- category: string, one of:
  * food_drink: restaurant, cafe, coffee, bar, pub, bakery, brunch, lunch, dinner
  * personal_care: haircut, barber, salon, spa, massage, nails, beauty, skincare
  * health: dentist, doctor, physiotherapy, pharmacy, clinic, hospital, optician
  * fitness: gym, fitness, yoga, pilates, swimming, sports
  * shopping: grocery, supermarket, clothing, electronics, bookstore, mall
  * services: repair, laundry, dry cleaning, tailor, bank, post office
  * entertainment: cinema, museum, theater, park, nightclub, bowling
  * accommodation: hotel, hostel, airbnb
  * transport: parking, gas station, car wash, bike rental
  * general: anything else
- keywords: string, the specific search terms, that suitable for google maps, extracted from user input (e.g. "coffee", "italian restaurant", "vegan brunch"). This is the actual query to search for.
- requested_time: ISO 8601 datetime string (if vague like "this afternoon" use today 15:00, "now" use current time, "tomorrow" use tomorrow 10:00)
- radius_km: float (default 5.0, use smaller like 2.0 if user says "nearby" or "walking distance")
- constraints: object with optional keys: max_price (number), language (string), cuisine (string), amenities (array of strings), notes (string)

Today is {today}. Current time is {now}. User location: lat={lat}, lng={lng}.
Respond with ONLY the JSON object."""


def run(state: PlannerState) -> PlannerState:
    start = time.time() * 1000
    now = datetime.now()
    loc = state["location"]

    raw_input = state["raw_input"]
    print(f"Intent Parser received raw_input: '{raw_input}'")

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
            {"role": "user", "content": raw_input},
        ],
    )
    parsed = json.loads(response.choices[0].message.content)

    print(f"Intent Parser output: {parsed}")

    # Fallback for missing time
    if not parsed.get("requested_time"):
        parsed["requested_time"] = (now + timedelta(hours=1)).isoformat()

    structured = {
        "id": str(uuid.uuid4()),
        "raw_input": state["raw_input"],
        "category": parsed.get("category", "general"),
        "keywords": parsed.get("keywords", ""),
        "requested_time": parsed["requested_time"],
        "location": state["location"],
        "radius_km": parsed.get("radius_km", 5.0),
        "constraints": parsed.get("constraints", {}),
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


if __name__ == "__main__":
    # Quick local test
    from app.agents.trace import make_trace
    test_state = {
        "raw_input": "I need a haircut tomorrow afternoon, preferably nearby and under 50 CHF.",
        "location": {"lat": 47.3769, "lng": 8.5417},
        "preferences": None,
        "structured_request": None,
        "candidate_providers": [],
        "feasible_providers": [],
        "ranked_offers": [],
        "trace": make_trace("test"),
        "error": None,
    }
    result = run(test_state)
    print(json.dumps(result["structured_request"], indent=2))
