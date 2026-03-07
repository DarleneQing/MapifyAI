-- Migration: requests and offers tables for LocalBid marketplace
-- Aligns with app.models.schemas.StructuredRequest and Offer.
-- Follows Supabase/Postgres best practices: lowercase, timestamptz, jsonb, FK indexes.

-- ---------------------------------------------------------------------------
-- requests
-- ---------------------------------------------------------------------------
create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  raw_input text not null,
  category text not null default 'general',
  requested_time timestamptz not null,
  location jsonb not null,
  radius_km double precision not null default 5.0,
  constraints jsonb not null default '{}',
  preferences jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'open', 'closed')),
  created_at timestamptz not null default now()
);

comment on table public.requests is 'Structured requests from users (StructuredRequest)';
comment on column public.requests.location is 'JSON: {"lat": number, "lng": number}';
comment on column public.requests.constraints is 'Optional filters: max_price, language, user_id, etc.';

-- Index for listing/filtering by status and time
create index if not exists requests_status_created_at_idx
  on public.requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- offers
-- ---------------------------------------------------------------------------
create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.requests (id) on delete cascade,
  provider_id text not null,
  price numeric(10, 2) not null,
  eta_minutes int not null,
  slot_time timestamptz not null,
  notes text,
  score double precision,
  score_breakdown jsonb,
  reasons text[],
  time_label text,
  created_at timestamptz not null default now()
);

comment on table public.offers is 'Ranked offers per request (Offer)';
comment on column public.offers.score_breakdown is 'JSON: {"price": 0.4, "distance": 0.3, ...}';

-- Index FK for get_offers(request_id) and cascade deletes (schema-foreign-key-indexes)
create index if not exists offers_request_id_idx on public.offers (request_id);

-- Index for ordering by score when fetching offers for a request
create index if not exists offers_request_id_score_idx
  on public.offers (request_id, score desc nulls last);
