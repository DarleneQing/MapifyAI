# Backend — LocalBid

Multi-agent recommendation pipeline for local services in Zurich. Built with FastAPI + LangGraph.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | FastAPI (Python 3.11+) |
| Agent orchestration | LangGraph |
| LLM | OpenAI GPT-4o |
| Web scraping | Apify (`compass/crawler-google-places`) |
| Transit | SBB OpenData API (`transport.opendata.ch`) |
| Database | Supabase (PostgreSQL) — optional, in-memory fallback |

---

## Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # then fill in your values
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs` to explore all endpoints via Swagger UI.

### .env values

```
OPENAI_API_KEY=sk-...                   # required — LLM calls
APIFY_API_TOKEN=apify_api_...           # optional — real Google Maps scraping (falls back to seed data)
SUPABASE_URL=https://xxxx.supabase.co   # optional — persistent storage (falls back to in-memory)
SUPABASE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Quick Test

```bash
curl -s -X POST http://127.0.0.1:8000/api/requests/ \
  -H "Content-Type: application/json" \
  -d '{"query": "find a good haircut near me", "location": {"lat": 47.3769, "lng": 8.5417}}' \
  | python3 -m json.tool
```

---

## Pipeline

```
intent_parser → crawling_search → transit_calculator
                                          │
                            ┌─────────────┴─────────────┐
                            ▼                           ▼
                    evaluation_agent            review_agent
                            │                           │
                            └─────────────┬─────────────┘
                                          ▼
                                 orchestrator_agent
                                          │
                                   output_ranking → END
```

`evaluation_agent` and `review_agent` run in parallel via LangGraph's fan-out.

| Agent | Role |
|---|---|
| **intent_parser** | NL → structured request (category, time, radius, constraints) via GPT-4o |
| **crawling_search** | Apify Google Maps scraper — finds real businesses, filters by opening hours |
| **transit_calculator** | SBB transit ETA per candidate — drops unreachable providers, retries with wider radius |
| **evaluation_agent** | Weighted score: price + distance + rating, normalised to [0,1] |
| **review_agent** | Summarises Google reviews (or generates from structured data) into advantages/disadvantages |
| **orchestrator_agent** | GPT-4o synthesises user intent + scores + reviews → `one_sentence_recommendation` |
| **output_ranking** | Formats top-10 into `PlaceSummary[]` for the API |

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                      # FastAPI entry point + service wiring
│   ├── config.py                    # Env vars
│   ├── wiring.py                    # Dependency injection at startup
│   │
│   ├── models/
│   │   ├── schemas.py               # Shared Pydantic models (read before coding)
│   │   └── db.py                    # Supabase client singleton
│   │
│   ├── agents/                      # LangGraph pipeline nodes
│   │   ├── state.py                 # PlannerState TypedDict
│   │   ├── trace.py                 # Agent trace logger
│   │   ├── graph.py                 # LangGraph wiring — pipeline entry point
│   │   ├── intent_parser.py         # NL → structured request (GPT-4o)
│   │   ├── crawling_search.py       # Apify Google Maps scraper
│   │   ├── transit_calculator.py    # SBB transit ETA + reachability filter
│   │   └── retrieval.py             # Seed-file fallback (used when no Apify token)
│   │
│   ├── api/
│   │   ├── requests.py              # POST /api/requests, GET /api/requests/{id}
│   │   ├── places.py                # GET /api/places/{id}
│   │   ├── offers.py                # POST /api/offers
│   │   ├── providers.py             # GET /api/providers/{id}
│   │   ├── users.py                 # GET/PUT /api/users/me
│   │   └── location.py              # GET /api/location
│   │
│   └── services/
│       ├── ranking.py               # Weighted score formula
│       ├── explanation.py           # Top-3 reason tags per offer
│       ├── reviews.py               # Review summariser (Apify reviews + GPT-4o)
│       ├── swiss_transit.py         # SBB API client
│       ├── apify_search.py          # Apify client wrapper
│       ├── geo.py                   # Haversine + ETA utils
│       ├── orchestrator_service.py  # Runs pipeline, formats response
│       ├── request_service.py       # Creates and persists requests
│       ├── marketplace.py           # Supabase CRUD
│       ├── marketplace_memory.py    # In-memory fallback (no Supabase needed)
│       └── trace.py                 # Agent trace store
│
├── seed/
│   ├── zurich_providers.json        # Seed data (used when no Apify token)
│   └── seed.py                      # Load script
│
├── tests/
│   ├── test_agents.py
│   └── test_ranking.py
│
├── requirements.txt
└── .env                             # never commit this
```

---

## API Response Format

`POST /api/requests/` returns:

```json
{
  "request": {
    "id": "uuid",
    "raw_input": "find a good haircut near me",
    "category": "haircut",
    "requested_time": "2026-03-11T15:00:00+01:00",
    "location": { "lat": 47.3769, "lng": 8.5417 },
    "radius_km": 2.0
  },
  "results": [
    {
      "place_id": "ChIJ...",
      "name": "Barber Studio Zürich",
      "address": "Langstrasse 12, 8004 Zürich",
      "distance_km": 0.55,
      "price_level": "medium",
      "rating": 4.9,
      "rating_count": 275,
      "recommendation_score": 0.99,
      "status": "open_now",
      "transit": { "duration_minutes": 3, "transport_types": ["tram"] },
      "reason_tags": ["Rating: 4.9/5", "Distance: 0.6 km"],
      "one_sentence_recommendation": "Highly rated and closest option, just 0.55 km away."
    }
  ]
}
```

---

## Running Tests

```bash
pytest tests/
```
