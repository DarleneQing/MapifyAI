# Backend — LocalBid

Multi-agent service marketplace backend. Three devs, parallel tracks.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | FastAPI (Python 3.11+) |
| Agent orchestration | LangGraph |
| LLM | OpenAI GPT-4o |
| Database + Realtime | Supabase (PostgreSQL) |

---

## Setup (everyone does this)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env            # then fill in your values
uvicorn app.main:app --reload
```

Open http://localhost:8000/docs to verify the server is running.

**.env values needed** — ask Backend-2 for Supabase keys once they set up the project:
```
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Directory Structure

```
backend/
├── app/
│   ├── main.py                      # FastAPI entry point — do not edit
│   ├── config.py                    # Env vars — do not edit
│   │
│   ├── models/
│   │   ├── schemas.py               # ⚠️ Shared contracts — read before coding
│   │   └── db.py                    # Supabase client singleton
│   │
│   ├── agents/                      # ← Backend-1
│   │   ├── state.py                 # LangGraph state schema
│   │   ├── trace.py                 # Agent trace logger utility
│   │   ├── intent_parser.py         # NL → structured request (TODO)
│   │   ├── retrieval.py             # Geo + category DB query (TODO)
│   │   ├── feasibility.py           # Opening hours + ETA filter (TODO)
│   │   ├── planner.py               # Pipeline order (TODO)
│   │   └── graph.py                 # LangGraph wiring (TODO)
│   │
│   ├── api/                         # ← Backend-2
│   │   ├── requests.py              # POST /api/requests, GET /api/requests/{id}
│   │   ├── offers.py                # POST /api/offers
│   │   ├── providers.py             # GET /api/providers/{id}
│   │   └── users.py                 # GET/PUT /api/users/me
│   │
│   ├── services/
│   │   ├── geo.py                   # ✅ Complete — haversine + ETA utils
│   │   ├── marketplace.py           # ← Backend-2: DB CRUD logic
│   │   ├── ranking.py               # ← Backend-3: score formula
│   │   ├── explanation.py           # ← Backend-3: top-3 reasons per offer
│   │   └── reviews.py               # ← Backend-3: review summariser (stretch)
│   │
│   └── realtime/
│       └── events.py                # ← Backend-2: Supabase broadcast
│
├── seed/
│   ├── zurich_providers.json        # ← Backend-3: expand to 20+ providers
│   └── seed.py                      # Load script (run once after DB is ready)
│
├── tests/
│   ├── test_agents.py               # Backend-1 tests
│   └── test_ranking.py              # Backend-3 tests
│
├── requirements.txt
└── .env                             # ← never commit this
```

---

## Shared Contract — read `app/models/schemas.py` first

Key types everyone passes around:

| Type | Description |
|---|---|
| `StructuredRequest` | Parsed user intent (category, time, location, radius, constraints) |
| `Provider` | A service provider with location, hours, rating, price range |
| `Offer` | A provider bid on a request — has price, ETA, score, reasons |
| `UserPreferences` | Weight sliders (price / distance / rating) |
| `AgentTrace` | Full agent execution log for the debug panel |

Do not change `schemas.py` without telling the other two devs.

---

## Backend-1 — Agent Orchestration (Qing)

**Goal:** user types a sentence → pipeline runs → ranked offers come out.

**Priority order:**

| # | File | Task | Unblocks |
|---|---|---|---|
| 1 | `agents/intent_parser.py` | Uncomment OpenAI call, replace stub | Everything |
| 2 | `agents/graph.py` | Verify LangGraph compiles and runs end-to-end | API layer |
| 3 | `api/requests.py` | Call `run_pipeline()`, return `RankedOffersResponse` | Frontend |
| 4 | `agents/retrieval.py` | Real DB query (needs Backend-2's Supabase schema first) | Real data |
| 5 | `agents/feasibility.py` | Implement `_check_provider()` opening hours logic | Filtering |
| 6 | `agents/graph.py` | Swap ranking/explanation stubs for Backend-3's real functions | Scores |

**How to test intent_parser without DB:**
```python
# run from backend/
python -c "
from app.agents.graph import run_pipeline
state = run_pipeline('I need a haircut near Zurich HB in 2 hours', {'lat': 47.378, 'lng': 8.540})
print(state['structured_request'])
"
```

---

## Backend-2 — Marketplace + Realtime

**Goal:** database is set up, API endpoints work, new offers appear in real-time.

**Priority order:**

| # | File | Task | Unblocks |
|---|---|---|---|
| 1 | Supabase dashboard | Create project, run SQL schema below, share `.env` values | Everyone |
| 2 | `seed/seed.py` | Run seed script after schema is created | Real data |
| 3 | `services/marketplace.py` | Implement all 5 functions (`persist_request`, `get_offers`, etc.) | API layer |
| 4 | `api/requests.py` | Wire GET endpoints to `marketplace.py` | Frontend |
| 5 | `api/offers.py` | Provider bid submission endpoint | Provider UI |
| 6 | `api/providers.py` | Provider detail endpoint | Detail page |
| 7 | `realtime/events.py` | Supabase broadcast on new offer | Real-time UI |
| 8 | `api/users.py` | Preferences save/load | Stretch |

**Supabase SQL schema — run this in the Supabase SQL editor:**

```sql
create table providers (
  id text primary key,
  name text not null,
  category text not null,
  location jsonb not null,
  address text,
  rating float default 0,
  review_count int default 0,
  price_range text,
  opening_hours jsonb,
  website_url text,
  google_maps_url text,
  reviews jsonb
);

create table requests (
  id text primary key,
  raw_input text,
  category text,
  requested_time timestamptz,
  location jsonb,
  radius_km float default 5,
  constraints jsonb default '{}',
  status text default 'open',
  trace jsonb,
  created_at timestamptz default now()
);

create table offers (
  id text primary key,
  request_id text references requests(id),
  provider_id text references providers(id),
  price float,
  eta_minutes int,
  slot_time timestamptz,
  notes text,
  score float,
  score_breakdown jsonb,
  reasons jsonb,
  time_label text,
  created_at timestamptz default now()
);

create table users (
  id text primary key,
  weight_price float default 0.33,
  weight_distance float default 0.33,
  weight_rating float default 0.34
);
```

**After creating the schema**, share with teammates:
- `SUPABASE_URL`
- `SUPABASE_KEY` (anon)
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Backend-3 — Ranking + Explainability + Seed Data

**Goal:** offers are scored and sorted with human-readable reasons; rich seed data for demo.

**Priority order:**

| # | File | Task | Unblocks |
|---|---|---|---|
| 1 | `seed/zurich_providers.json` | Expand to 20+ providers across categories (haircut, massage, dentist, repair, etc.) | Realistic demo |
| 2 | `services/ranking.py` | Implement `normalise()` + `rank_offers()` | Sorted list (US-04) |
| 3 | `services/explanation.py` | Implement `explain_offer()` → top-3 reasons | Explanations (US-05) |
| 4 | `agents/graph.py` | Tell Backend-1 to swap stubs once ranking + explanation are ready | Pipeline complete |
| 5 | `services/ranking.py` | Accept `UserPreferences` weights for personalisation | Stretch (US-08) |
| 6 | `services/reviews.py` | OpenAI review summariser | Stretch (US-10) |

**Ranking formula (implement this):**
```
score = w_price    * (1 - normalise(price, min, max))
      + w_distance * (1 - normalise(distance, min, max))
      + w_rating   * normalise(rating - 1, 0, 4)
```
Default weights: `w_price = w_distance = w_rating = 0.33`

**Seed data format** — follow the existing 5 providers in `zurich_providers.json`.
Categories needed: `haircut`, `massage`, `dentist`, `repair`, `nails`, `physiotherapy`.
Use real Zurich street names and realistic lat/lng (Zurich centre ≈ `47.376, 8.541`).

---

## Integration Checklist

Use this to track when things are ready to connect:

- [ ] Backend-2: Supabase schema created + `.env` values shared
- [ ] Backend-3: seed data expanded + `seed.py` run
- [ ] Backend-1: `intent_parser.py` real LLM call working
- [ ] Backend-1: `retrieval.py` querying real DB
- [ ] Backend-3: `rank_offers()` implemented
- [ ] Backend-1: ranking stub in `graph.py` swapped for real call
- [ ] Backend-2: `POST /api/requests` end-to-end working
- [ ] All: `GET /api/requests/{id}/offers` returns ranked list to frontend

---

## Running Tests

```bash
pytest tests/
```
