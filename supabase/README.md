# Supabase Database Setup

Database migrations for the TourAgent/IntelligentLocalBid multi-agent system.

## Quick Start

### Option 1: Supabase Cloud (Recommended for Production)

1. Create a project at [supabase.com](https://supabase.com)
2. Link and push migrations:

```bash
cd supabase
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

### Option 2: Local Development with Docker

```bash
# Start local Supabase (requires Docker)
supabase start

# Apply migrations
supabase db reset

# View local Studio UI
# Open http://127.0.0.1:54323
```

### Option 3: Manual SQL Execution

Run migrations in order via Supabase Dashboard SQL Editor or `psql`:

```bash
# Connect to your database
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT.supabase.co:5432/postgres"

# Run migrations in order
\i migrations/20250307100000_requests_and_offers.sql
\i migrations/20250307100001_rls_requests_offers.sql
\i migrations/20250313100000_user_profiles.sql
\i migrations/20250313100001_stores_cache.sql
\i migrations/20250313100002_reviews_cache.sql
\i migrations/20250313100003_transit_cache.sql
\i migrations/20250313100004_agent_traces.sql
\i migrations/20250313100005_rls_all_tables.sql
\i migrations/20250313100006_seed_demo_data.sql
```

## Environment Variables

Add to your backend `.env`:

```bash
# Supabase connection
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_KEY=your_service_role_key_here

# For local development
# SUPABASE_URL=http://127.0.0.1:54321
# SUPABASE_KEY=eyJhbGc... (from supabase start output)
```

> **Important:** Use the **service role key** (not anon key) for the FastAPI backend to bypass RLS policies.

## Migration Files

| Order | File | Description |
|-------|------|-------------|
| 1 | `20250307100000_requests_and_offers.sql` | Core marketplace: requests & offers tables |
| 2 | `20250307100001_rls_requests_offers.sql` | RLS policies for requests/offers |
| 3 | `20250313100000_user_profiles.sql` | User preferences, weights, personas |
| 4 | `20250313100001_stores_cache.sql` | Cached Apify store data with PostGIS |
| 5 | `20250313100002_reviews_cache.sql` | Reviews & LLM summaries cache |
| 6 | `20250313100003_transit_cache.sql` | SBB transit route cache |
| 7 | `20250313100004_agent_traces.sql` | Agent execution traces for debugging |
| 8 | `20250313100005_rls_all_tables.sql` | RLS policies for all new tables |
| 9 | `20250313100006_seed_demo_data.sql` | Demo data (20 Zurich stores) |

## Database Schema

### Core Tables

#### `requests`
User search requests from natural language input.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| raw_input | text | Original user query |
| category | text | Service category (hair_salon, restaurant, etc.) |
| requested_time | timestamptz | When user wants the service |
| location | jsonb | `{"lat": 47.37, "lng": 8.54}` |
| radius_km | float | Search radius |
| constraints | jsonb | Filters (max_price, language, etc.) |
| preferences | jsonb | User preference weights |
| status | text | pending → open → closed |

#### `offers`
Ranked recommendations per request.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| request_id | uuid | FK to requests |
| provider_id | text | Store/place identifier |
| price | numeric | Estimated price |
| eta_minutes | int | Transit time via SBB |
| score | float | Composite recommendation score |
| score_breakdown | jsonb | `{"price": 0.4, "distance": 0.3, ...}` |
| reasons | text[] | Recommendation reasons |

### Personalization Tables

#### `user_profiles`
User preferences for personalized recommendations (US-09, US-10, US-11).

| Column | Type | Description |
|--------|------|-------------|
| user_id | text | Unique user identifier |
| persona | text | student, parent, professional, accessibility |
| budget_level | text | budget, medium, premium |
| weight_* | float | Price/distance/rating/transit weights (0-1) |
| preferred_categories | text[] | Favorite service types |
| language | text | Output language preference |

### Cache Tables

#### `stores`
Cached Apify Google Maps scraper results with PostGIS for geo queries.

| Column | Type | Description |
|--------|------|-------------|
| place_id | text | Google Maps place_id (unique) |
| name | text | Business name |
| category | text | Service category |
| location | geography | PostGIS point for radius queries |
| rating | float | Google rating (0-5) |
| opening_hours | jsonb | Weekly schedule |
| is_seed_data | bool | Demo data flag (never expires) |

**Helper Function:**
```sql
SELECT * FROM find_stores_within_radius(47.37, 8.54, 5.0, 'restaurant', 20);
```

#### `reviews` & `review_summaries`
Raw reviews and LLM-generated summaries from Review Agent.

| Column (summaries) | Type | Description |
|--------------------|------|-------------|
| advantages | text[] | Top positive points |
| disadvantages | text[] | Top negative points |
| star_reasons | jsonb | `{"5": [...], "1": [...]}` |
| sentiment_score | float | -1 to 1 sentiment |

#### `transit_routes`
Cached SBB API transit calculations.

| Column | Type | Description |
|--------|------|-------------|
| duration_minutes | int | Total transit time |
| transport_types | text[] | [train, bus, tram, walk] |
| connections | jsonb | Multi-leg journey details |
| time_label | text | open, closing_soon, closed |

### Observability Tables

#### `agent_traces`, `agent_trace_nodes`, `agent_trace_events`
Full execution traces for the 6-Agent DAG (US-27 Debug Panel).

**Trace Summary Function:**
```sql
SELECT get_trace_summary('trace-id-here');
```

Returns JSON with all 8 agent nodes, timing, inputs/outputs, and SSE events.

## Demo Data

The seed migration provides 20 stores in Zurich for testing:
- 3 hair salons (budget to premium)
- 2 car washes
- 3 restaurants (traditional, vegetarian, fine dining)
- 2 cafes
- 2 gyms
- 1 pharmacy (24h)
- 2 supermarkets
- 1 dentist, 1 bank, 1 vet, 1 repair shop, 1 laundry

**Test geo query:**
```sql
SELECT * FROM find_stores_within_radius(
  47.3769,  -- Zurich HB latitude
  8.5417,   -- Zurich HB longitude  
  3.0,      -- 3km radius
  'restaurant'
);
```

## Row Level Security

- **Backend (service role key):** Bypasses all RLS
- **Frontend (anon/authenticated):**
  - `stores`, `reviews`, `review_summaries`, `transit_routes`: Public read
  - `user_profiles`: Users can only access their own profile
  - `agent_traces`: Authenticated read (for debug panel)
  - `requests`, `offers`: Authenticated full access

## Testing the Setup

After applying migrations, verify with:

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' ORDER BY table_name;

-- Check seed data
SELECT name, category, rating FROM stores WHERE is_seed_data = true;

-- Test geo function
SELECT * FROM find_stores_within_radius(47.37, 8.54, 5.0) LIMIT 5;

-- Check PostGIS
SELECT PostGIS_Version();
```

## Troubleshooting

### PostGIS not available
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### Permission errors
Make sure you're using the service role key, not anon key.

### Migration order errors
Run migrations in numerical order. Use `supabase db reset` to start fresh.
