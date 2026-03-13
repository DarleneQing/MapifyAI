-- ============================================================================
-- COMBINED MIGRATIONS FOR TOURAGENT / INTELLIGENTLOCALBID
-- Run this entire file in Supabase Dashboard SQL Editor
-- ============================================================================

-- ============================================================================
-- MIGRATION 1: requests and offers tables (20250307100000)
-- ============================================================================

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

create index if not exists requests_status_created_at_idx
  on public.requests (status, created_at desc);

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

create index if not exists offers_request_id_idx on public.offers (request_id);
create index if not exists offers_request_id_score_idx
  on public.offers (request_id, score desc nulls last);

-- ============================================================================
-- MIGRATION 2: RLS for requests and offers (20250307100001)
-- ============================================================================

alter table public.requests enable row level security;
alter table public.offers enable row level security;

create policy "Authenticated full access to requests"
  on public.requests for all
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated full access to offers"
  on public.offers for all
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- MIGRATION 3: User profiles (20250313100000)
-- ============================================================================

create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null,
  persona text not null default 'general'
    check (persona in ('general', 'student', 'parent', 'professional', 'accessibility')),
  budget_level text not null default 'medium'
    check (budget_level in ('budget', 'medium', 'premium')),
  travel_purpose text,
  special_needs text[],
  weight_price double precision not null default 0.25
    check (weight_price >= 0 and weight_price <= 1),
  weight_distance double precision not null default 0.25
    check (weight_distance >= 0 and weight_distance <= 1),
  weight_rating double precision not null default 0.25
    check (weight_rating >= 0 and weight_rating <= 1),
  weight_transit double precision not null default 0.25
    check (weight_transit >= 0 and weight_transit <= 1),
  preferred_categories text[],
  avoided_categories text[],
  language text not null default 'en'
    check (language in ('en', 'zh', 'de', 'fr', 'it')),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_profiles is 'User preferences and persona for personalized recommendations';

create index if not exists user_profiles_user_id_idx on public.user_profiles (user_id);

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- MIGRATION 4: Stores cache with PostGIS (20250313100001)
-- ============================================================================

create extension if not exists postgis;

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  place_id text unique not null,
  apify_source_id text,
  name text not null,
  category text not null,
  subcategories text[],
  location geography(point, 4326) not null,
  address text,
  city text,
  country text default 'Switzerland',
  phone text,
  website text,
  google_maps_url text,
  rating double precision check (rating >= 0 and rating <= 5),
  review_count int default 0,
  price_level int check (price_level >= 1 and price_level <= 4),
  opening_hours jsonb,
  is_open_now boolean,
  temporarily_closed boolean default false,
  permanently_closed boolean default false,
  attributes jsonb,
  crawled_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  is_seed_data boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stores is 'Cached store/place data from Apify Google Maps scraper';

create index if not exists stores_location_gist_idx on public.stores using gist (location);
create index if not exists stores_category_idx on public.stores (category);
create index if not exists stores_rating_idx on public.stores (rating desc nulls last);
create index if not exists stores_active_idx on public.stores (category, rating desc)
  where permanently_closed = false and temporarily_closed = false;
create index if not exists stores_expires_at_idx on public.stores (expires_at)
  where is_seed_data = false;

drop trigger if exists stores_updated_at on public.stores;
create trigger stores_updated_at
  before update on public.stores
  for each row execute function public.update_updated_at_column();

create or replace function public.find_stores_within_radius(
  lat double precision,
  lng double precision,
  radius_km double precision,
  category_filter text default null,
  limit_count int default 50
)
returns table (
  id uuid,
  place_id text,
  name text,
  category text,
  lat double precision,
  lng double precision,
  distance_km double precision,
  rating double precision,
  review_count int,
  price_level int,
  opening_hours jsonb,
  is_open_now boolean
) as $$
begin
  return query
  select
    s.id,
    s.place_id,
    s.name,
    s.category,
    st_y(s.location::geometry) as lat,
    st_x(s.location::geometry) as lng,
    st_distance(s.location, st_makepoint(lng, lat)::geography) / 1000 as distance_km,
    s.rating,
    s.review_count,
    s.price_level,
    s.opening_hours,
    s.is_open_now
  from public.stores s
  where
    st_dwithin(s.location, st_makepoint(lng, lat)::geography, radius_km * 1000)
    and s.permanently_closed = false
    and s.temporarily_closed = false
    and (s.expires_at > now() or s.is_seed_data = true)
    and (category_filter is null or s.category = category_filter)
  order by distance_km
  limit limit_count;
end;
$$ language plpgsql stable;

-- ============================================================================
-- MIGRATION 5: Reviews cache (20250313100002)
-- ============================================================================

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  review_id text,
  author_name text,
  author_url text,
  rating int not null check (rating >= 1 and rating <= 5),
  text_content text,
  language text,
  published_at timestamptz,
  crawled_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists reviews_store_id_idx on public.reviews (store_id);
create index if not exists reviews_store_rating_idx on public.reviews (store_id, rating);
create index if not exists reviews_high_rating_idx on public.reviews (store_id, published_at desc)
  where rating >= 4;
create index if not exists reviews_low_rating_idx on public.reviews (store_id, published_at desc)
  where rating <= 2;

create table if not exists public.review_summaries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid unique not null references public.stores (id) on delete cascade,
  advantages text[] not null default '{}',
  disadvantages text[] not null default '{}',
  star_reasons jsonb not null default '{}',
  overall_summary text,
  recommended_items text[],
  sentiment_score double precision check (sentiment_score >= -1 and sentiment_score <= 1),
  review_count_processed int not null default 0,
  model_used text,
  language text not null default 'en',
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists review_summaries_expires_at_idx on public.review_summaries (expires_at);

drop trigger if exists review_summaries_updated_at on public.review_summaries;
create trigger review_summaries_updated_at
  before update on public.review_summaries
  for each row execute function public.update_updated_at_column();

-- ============================================================================
-- MIGRATION 6: Transit cache (20250313100003)
-- ============================================================================

create table if not exists public.transit_routes (
  id uuid primary key default gen_random_uuid(),
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  store_id uuid references public.stores (id) on delete set null,
  departure_time timestamptz not null,
  duration_minutes int not null,
  transport_types text[] not null default '{}',
  arrival_time timestamptz,
  connections jsonb,
  time_label text check (time_label in ('open', 'closing_soon', 'closed', 'opens_later')),
  walking_meters int,
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);

create index if not exists transit_routes_lookup_idx on public.transit_routes (
  origin_lat, origin_lng, destination_lat, destination_lng, departure_time
);
create index if not exists transit_routes_store_id_idx on public.transit_routes (store_id)
  where store_id is not null;
create index if not exists transit_routes_expires_at_idx on public.transit_routes (expires_at);

create or replace function public.get_cached_transit_route(
  p_origin_lat double precision,
  p_origin_lng double precision,
  p_dest_lat double precision,
  p_dest_lng double precision,
  p_departure_time timestamptz,
  p_tolerance_minutes int default 5
)
returns table (
  id uuid,
  duration_minutes int,
  transport_types text[],
  arrival_time timestamptz,
  connections jsonb,
  time_label text
) as $$
begin
  return query
  select
    tr.id,
    tr.duration_minutes,
    tr.transport_types,
    tr.arrival_time,
    tr.connections,
    tr.time_label
  from public.transit_routes tr
  where
    abs(tr.origin_lat - p_origin_lat) < 0.001
    and abs(tr.origin_lng - p_origin_lng) < 0.001
    and abs(tr.destination_lat - p_dest_lat) < 0.001
    and abs(tr.destination_lng - p_dest_lng) < 0.001
    and tr.departure_time between 
        p_departure_time - (p_tolerance_minutes || ' minutes')::interval
        and p_departure_time + (p_tolerance_minutes || ' minutes')::interval
    and tr.expires_at > now()
  order by abs(extract(epoch from (tr.departure_time - p_departure_time)))
  limit 1;
end;
$$ language plpgsql stable;

-- ============================================================================
-- MIGRATION 7: Agent traces (20250313100004)
-- ============================================================================

create table if not exists public.agent_traces (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests (id) on delete cascade,
  trace_id text unique not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'timeout')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_duration_ms int,
  error_message text,
  error_agent text,
  stores_found int default 0,
  offers_generated int default 0,
  created_at timestamptz not null default now()
);

create index if not exists agent_traces_request_id_idx on public.agent_traces (request_id);
create index if not exists agent_traces_trace_id_idx on public.agent_traces (trace_id);
create index if not exists agent_traces_started_at_idx on public.agent_traces (started_at desc);

create table if not exists public.agent_trace_nodes (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.agent_traces (id) on delete cascade,
  agent_name text not null
    check (agent_name in (
      'input_agent', 'crawling_store_search', 'crawling_transit_calculator', 
      'review_agent', 'evaluation_agent', 'orchestrator_agent',
      'output_ranking', 'output_recommendation'
    )),
  execution_order int not null,
  depends_on text[],
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms int,
  input_summary jsonb,
  output_summary jsonb,
  input_full jsonb,
  output_full jsonb,
  error_message text,
  error_type text,
  llm_model text,
  llm_tokens_input int,
  llm_tokens_output int,
  llm_cost_usd numeric(10, 6),
  api_calls jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agent_trace_nodes_trace_id_idx on public.agent_trace_nodes (trace_id, execution_order);
create index if not exists agent_trace_nodes_duration_idx on public.agent_trace_nodes (agent_name, duration_ms desc)
  where status = 'completed';

create table if not exists public.agent_trace_events (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.agent_traces (id) on delete cascade,
  event_type text not null
    check (event_type in (
      'intent_parsed', 'stores_crawled', 'transit_computed', 'reviews_fetched',
      'scores_computed', 'recommendations_ready', 'completed', 'error'
    )),
  sequence_number int not null,
  payload jsonb,
  emitted_at timestamptz not null default now()
);

create index if not exists agent_trace_events_trace_seq_idx on public.agent_trace_events (trace_id, sequence_number);

create or replace function public.get_trace_summary(p_trace_id text)
returns jsonb as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'trace_id', t.trace_id,
    'status', t.status,
    'started_at', t.started_at,
    'completed_at', t.completed_at,
    'total_duration_ms', t.total_duration_ms,
    'stores_found', t.stores_found,
    'offers_generated', t.offers_generated,
    'error', case when t.error_message is not null then
      jsonb_build_object('message', t.error_message, 'agent', t.error_agent)
    else null end,
    'nodes', (
      select jsonb_agg(
        jsonb_build_object(
          'agent_name', n.agent_name,
          'status', n.status,
          'duration_ms', n.duration_ms,
          'depends_on', n.depends_on,
          'input_summary', n.input_summary,
          'output_summary', n.output_summary,
          'llm_model', n.llm_model,
          'llm_tokens', n.llm_tokens_input + coalesce(n.llm_tokens_output, 0),
          'error', n.error_message
        ) order by n.execution_order
      )
      from public.agent_trace_nodes n
      where n.trace_id = t.id
    ),
    'events', (
      select jsonb_agg(
        jsonb_build_object(
          'type', e.event_type,
          'sequence', e.sequence_number,
          'emitted_at', e.emitted_at
        ) order by e.sequence_number
      )
      from public.agent_trace_events e
      where e.trace_id = t.id
    )
  ) into result
  from public.agent_traces t
  where t.trace_id = p_trace_id;
  
  return result;
end;
$$ language plpgsql stable;

-- ============================================================================
-- MIGRATION 8: RLS for all tables (20250313100005)
-- ============================================================================

alter table public.user_profiles enable row level security;

create policy "Users can view own profile" on public.user_profiles for select
  to authenticated using (user_id = auth.uid()::text);
create policy "Users can update own profile" on public.user_profiles for update
  to authenticated using (user_id = auth.uid()::text) with check (user_id = auth.uid()::text);
create policy "Users can insert own profile" on public.user_profiles for insert
  to authenticated with check (user_id = auth.uid()::text);

alter table public.stores enable row level security;
create policy "Public read access to stores" on public.stores for select
  to anon, authenticated using (true);

alter table public.reviews enable row level security;
create policy "Public read access to reviews" on public.reviews for select
  to anon, authenticated using (true);

alter table public.review_summaries enable row level security;
create policy "Public read access to review summaries" on public.review_summaries for select
  to anon, authenticated using (true);

alter table public.transit_routes enable row level security;
create policy "Public read access to transit routes" on public.transit_routes for select
  to anon, authenticated using (true);

alter table public.agent_traces enable row level security;
create policy "Authenticated read access to traces" on public.agent_traces for select
  to authenticated using (true);

alter table public.agent_trace_nodes enable row level security;
create policy "Authenticated read access to trace nodes" on public.agent_trace_nodes for select
  to authenticated using (true);

alter table public.agent_trace_events enable row level security;
create policy "Authenticated read access to trace events" on public.agent_trace_events for select
  to authenticated using (true);

-- ============================================================================
-- MIGRATION 9: Seed demo data (20250313100006)
-- ============================================================================

insert into public.stores (
  place_id, name, category, subcategories, location, address, city,
  rating, review_count, price_level, opening_hours, is_open_now,
  is_seed_data, crawled_at
) values
('ChIJ_demo_hair_01', 'Zurich Style Studio', 'hair_salon', array['haircut', 'coloring'], 
 st_makepoint(8.5417, 47.3769)::geography, 'Bahnhofstrasse 25', 'Zürich',
 4.7, 342, 3, '{"monday": {"open": "09:00", "close": "19:00"}, "tuesday": {"open": "09:00", "close": "19:00"}, "wednesday": {"open": "09:00", "close": "19:00"}, "thursday": {"open": "09:00", "close": "21:00"}, "friday": {"open": "09:00", "close": "19:00"}, "saturday": {"open": "10:00", "close": "17:00"}, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_hair_02', 'Coiffeur Bellevue', 'hair_salon', array['haircut', 'styling'],
 st_makepoint(8.5450, 47.3667)::geography, 'Bellevueplatz 3', 'Zürich',
 4.5, 218, 2, '{"monday": {"open": "08:30", "close": "18:30"}, "tuesday": {"open": "08:30", "close": "18:30"}, "wednesday": {"open": "08:30", "close": "18:30"}, "thursday": {"open": "08:30", "close": "20:00"}, "friday": {"open": "08:30", "close": "18:30"}, "saturday": {"open": "09:00", "close": "16:00"}, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_hair_03', 'Budget Cuts Express', 'hair_salon', array['haircut'],
 st_makepoint(8.5300, 47.3780)::geography, 'Langstrasse 45', 'Zürich',
 4.1, 567, 1, '{"monday": {"open": "10:00", "close": "20:00"}, "tuesday": {"open": "10:00", "close": "20:00"}, "wednesday": {"open": "10:00", "close": "20:00"}, "thursday": {"open": "10:00", "close": "20:00"}, "friday": {"open": "10:00", "close": "20:00"}, "saturday": {"open": "10:00", "close": "18:00"}, "sunday": {"open": "12:00", "close": "17:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_carwash_01', 'SparkleWash Zurich', 'car_wash', array['hand_wash', 'detailing'],
 st_makepoint(8.5150, 47.3890)::geography, 'Industriestrasse 12', 'Zürich',
 4.6, 189, 2, '{"monday": {"open": "07:00", "close": "20:00"}, "tuesday": {"open": "07:00", "close": "20:00"}, "wednesday": {"open": "07:00", "close": "20:00"}, "thursday": {"open": "07:00", "close": "20:00"}, "friday": {"open": "07:00", "close": "20:00"}, "saturday": {"open": "08:00", "close": "18:00"}, "sunday": {"open": "09:00", "close": "16:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_carwash_02', 'AutoGlanz Premium', 'car_wash', array['automatic', 'premium_detail'],
 st_makepoint(8.5500, 47.4000)::geography, 'Thurgauerstrasse 88', 'Zürich',
 4.8, 456, 3, '{"monday": {"open": "06:00", "close": "22:00"}, "tuesday": {"open": "06:00", "close": "22:00"}, "wednesday": {"open": "06:00", "close": "22:00"}, "thursday": {"open": "06:00", "close": "22:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "07:00", "close": "20:00"}, "sunday": {"open": "08:00", "close": "18:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_restaurant_01', 'Zeughauskeller', 'restaurant', array['swiss', 'traditional'],
 st_makepoint(8.5395, 47.3725)::geography, 'Bahnhofstrasse 28a', 'Zürich',
 4.4, 2341, 2, '{"monday": {"open": "11:30", "close": "23:00"}, "tuesday": {"open": "11:30", "close": "23:00"}, "wednesday": {"open": "11:30", "close": "23:00"}, "thursday": {"open": "11:30", "close": "23:00"}, "friday": {"open": "11:30", "close": "23:30"}, "saturday": {"open": "11:30", "close": "23:30"}, "sunday": {"open": "11:30", "close": "22:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_restaurant_02', 'Hiltl Vegetarian', 'restaurant', array['vegetarian', 'buffet'],
 st_makepoint(8.5385, 47.3732)::geography, 'Sihlstrasse 28', 'Zürich',
 4.6, 1876, 2, '{"monday": {"open": "06:00", "close": "23:00"}, "tuesday": {"open": "06:00", "close": "23:00"}, "wednesday": {"open": "06:00", "close": "23:00"}, "thursday": {"open": "06:00", "close": "23:00"}, "friday": {"open": "06:00", "close": "24:00"}, "saturday": {"open": "08:00", "close": "24:00"}, "sunday": {"open": "08:00", "close": "23:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_restaurant_03', 'Clouds Restaurant', 'restaurant', array['fine_dining', 'international'],
 st_makepoint(8.5310, 47.3870)::geography, 'Maagplatz 5', 'Zürich',
 4.7, 892, 4, '{"monday": null, "tuesday": {"open": "18:00", "close": "23:00"}, "wednesday": {"open": "18:00", "close": "23:00"}, "thursday": {"open": "18:00", "close": "23:00"}, "friday": {"open": "18:00", "close": "24:00"}, "saturday": {"open": "18:00", "close": "24:00"}, "sunday": null}'::jsonb,
 false, true, now()),

('ChIJ_demo_cafe_01', 'Sprüngli Confiserie', 'cafe', array['chocolate', 'pastry'],
 st_makepoint(8.5397, 47.3695)::geography, 'Paradeplatz', 'Zürich',
 4.5, 3421, 3, '{"monday": {"open": "07:30", "close": "18:30"}, "tuesday": {"open": "07:30", "close": "18:30"}, "wednesday": {"open": "07:30", "close": "18:30"}, "thursday": {"open": "07:30", "close": "18:30"}, "friday": {"open": "07:30", "close": "18:30"}, "saturday": {"open": "08:00", "close": "17:00"}, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_cafe_02', 'Cafe Odeon', 'cafe', array['historic', 'coffee'],
 st_makepoint(8.5453, 47.3668)::geography, 'Limmatquai 2', 'Zürich',
 4.3, 1234, 2, '{"monday": {"open": "07:00", "close": "23:00"}, "tuesday": {"open": "07:00", "close": "23:00"}, "wednesday": {"open": "07:00", "close": "23:00"}, "thursday": {"open": "07:00", "close": "23:00"}, "friday": {"open": "07:00", "close": "24:00"}, "saturday": {"open": "08:00", "close": "24:00"}, "sunday": {"open": "09:00", "close": "22:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_gym_01', 'Migros Fitnesscenter', 'gym', array['fitness', 'group_classes'],
 st_makepoint(8.5350, 47.3750)::geography, 'Seidengasse 1', 'Zürich',
 4.2, 567, 1, '{"monday": {"open": "06:00", "close": "22:00"}, "tuesday": {"open": "06:00", "close": "22:00"}, "wednesday": {"open": "06:00", "close": "22:00"}, "thursday": {"open": "06:00", "close": "22:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "08:00", "close": "20:00"}, "sunday": {"open": "09:00", "close": "18:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_gym_02', 'Holmes Place Zurich', 'gym', array['premium', 'spa', 'personal_training'],
 st_makepoint(8.5480, 47.3720)::geography, 'Seefeldstrasse 123', 'Zürich',
 4.6, 345, 4, '{"monday": {"open": "06:00", "close": "23:00"}, "tuesday": {"open": "06:00", "close": "23:00"}, "wednesday": {"open": "06:00", "close": "23:00"}, "thursday": {"open": "06:00", "close": "23:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "08:00", "close": "20:00"}, "sunday": {"open": "08:00", "close": "20:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_pharmacy_01', 'Bellevue Apotheke', 'pharmacy', array['24h', 'prescription'],
 st_makepoint(8.5448, 47.3665)::geography, 'Theaterstrasse 14', 'Zürich',
 4.4, 234, 2, '{"monday": {"open": "00:00", "close": "24:00"}, "tuesday": {"open": "00:00", "close": "24:00"}, "wednesday": {"open": "00:00", "close": "24:00"}, "thursday": {"open": "00:00", "close": "24:00"}, "friday": {"open": "00:00", "close": "24:00"}, "saturday": {"open": "00:00", "close": "24:00"}, "sunday": {"open": "00:00", "close": "24:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_super_01', 'Coop City Bahnhofstrasse', 'supermarket', array['grocery', 'deli'],
 st_makepoint(8.5395, 47.3745)::geography, 'Bahnhofstrasse 57', 'Zürich',
 4.1, 1456, 2, '{"monday": {"open": "08:00", "close": "21:00"}, "tuesday": {"open": "08:00", "close": "21:00"}, "wednesday": {"open": "08:00", "close": "21:00"}, "thursday": {"open": "08:00", "close": "21:00"}, "friday": {"open": "08:00", "close": "21:00"}, "saturday": {"open": "08:00", "close": "20:00"}, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_super_02', 'Migros Hauptbahnhof', 'supermarket', array['grocery', 'convenience'],
 st_makepoint(8.5403, 47.3782)::geography, 'Bahnhofplatz 15', 'Zürich',
 4.0, 2134, 2, '{"monday": {"open": "06:00", "close": "22:00"}, "tuesday": {"open": "06:00", "close": "22:00"}, "wednesday": {"open": "06:00", "close": "22:00"}, "thursday": {"open": "06:00", "close": "22:00"}, "friday": {"open": "06:00", "close": "22:00"}, "saturday": {"open": "07:00", "close": "22:00"}, "sunday": {"open": "08:00", "close": "21:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_dentist_01', 'Zahnärztezentrum Zürich', 'dentist', array['general', 'cosmetic'],
 st_makepoint(8.5420, 47.3710)::geography, 'Talstrasse 58', 'Zürich',
 4.7, 189, 3, '{"monday": {"open": "08:00", "close": "18:00"}, "tuesday": {"open": "08:00", "close": "18:00"}, "wednesday": {"open": "08:00", "close": "18:00"}, "thursday": {"open": "08:00", "close": "20:00"}, "friday": {"open": "08:00", "close": "17:00"}, "saturday": null, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_bank_01', 'UBS Paradeplatz', 'bank', array['retail', 'wealth_management'],
 st_makepoint(8.5390, 47.3697)::geography, 'Bahnhofstrasse 45', 'Zürich',
 4.0, 567, null, '{"monday": {"open": "08:30", "close": "16:30"}, "tuesday": {"open": "08:30", "close": "16:30"}, "wednesday": {"open": "08:30", "close": "16:30"}, "thursday": {"open": "08:30", "close": "18:00"}, "friday": {"open": "08:30", "close": "16:30"}, "saturday": null, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_pet_01', 'Tierklinik Zürich', 'veterinarian', array['emergency', 'surgery'],
 st_makepoint(8.5250, 47.3650)::geography, 'Winterthurerstrasse 260', 'Zürich',
 4.8, 423, 3, '{"monday": {"open": "00:00", "close": "24:00"}, "tuesday": {"open": "00:00", "close": "24:00"}, "wednesday": {"open": "00:00", "close": "24:00"}, "thursday": {"open": "00:00", "close": "24:00"}, "friday": {"open": "00:00", "close": "24:00"}, "saturday": {"open": "00:00", "close": "24:00"}, "sunday": {"open": "00:00", "close": "24:00"}}'::jsonb,
 true, true, now()),

('ChIJ_demo_repair_01', 'iRepair Zurich', 'electronics_repair', array['phone', 'laptop'],
 st_makepoint(8.5380, 47.3760)::geography, 'Löwenstrasse 29', 'Zürich',
 4.5, 678, 2, '{"monday": {"open": "09:00", "close": "19:00"}, "tuesday": {"open": "09:00", "close": "19:00"}, "wednesday": {"open": "09:00", "close": "19:00"}, "thursday": {"open": "09:00", "close": "19:00"}, "friday": {"open": "09:00", "close": "19:00"}, "saturday": {"open": "10:00", "close": "17:00"}, "sunday": null}'::jsonb,
 true, true, now()),

('ChIJ_demo_laundry_01', 'Quick Wash Zurich', 'laundry', array['self_service', 'dry_cleaning'],
 st_makepoint(8.5320, 47.3800)::geography, 'Josefstrasse 102', 'Zürich',
 4.2, 234, 1, '{"monday": {"open": "07:00", "close": "22:00"}, "tuesday": {"open": "07:00", "close": "22:00"}, "wednesday": {"open": "07:00", "close": "22:00"}, "thursday": {"open": "07:00", "close": "22:00"}, "friday": {"open": "07:00", "close": "22:00"}, "saturday": {"open": "08:00", "close": "20:00"}, "sunday": {"open": "09:00", "close": "18:00"}}'::jsonb,
 true, true, now())
on conflict (place_id) do nothing;

-- Demo review summaries
insert into public.review_summaries (store_id, advantages, disadvantages, star_reasons, overall_summary, sentiment_score)
select 
  s.id,
  case s.name
    when 'Zurich Style Studio' then array['Excellent stylists with international experience', 'Modern techniques and trendy cuts', 'Great atmosphere and service', 'Good coffee while waiting']
    when 'Budget Cuts Express' then array['Very affordable prices', 'No appointment needed', 'Quick service', 'Convenient location']
    when 'SparkleWash Zurich' then array['Thorough hand wash quality', 'Friendly staff', 'Good interior cleaning', 'Reasonable prices']
    when 'Hiltl Vegetarian' then array['Best vegetarian buffet in Zurich', 'Historic restaurant since 1898', 'Great variety of dishes', 'Excellent vegan options']
    else array['Good service', 'Convenient location', 'Fair prices']
  end,
  case s.name
    when 'Zurich Style Studio' then array['Expensive for basic cuts', 'Sometimes hard to get appointments', 'Parking is difficult']
    when 'Budget Cuts Express' then array['Basic styling only', 'Can be crowded on weekends', 'No fancy treatments available']
    when 'SparkleWash Zurich' then array['Can be busy on weekends', 'Premium services are pricey', 'Limited waiting area']
    when 'Hiltl Vegetarian' then array['Can be crowded at lunch', 'Buffet price is per weight', 'Service can be slow when busy']
    else array['Can be busy at peak times', 'Limited parking']
  end,
  '{"5": ["Exceptional quality", "Highly recommended"], "4": ["Good overall experience"], "3": ["Average service"], "2": ["Some issues"], "1": ["Major problems"]}'::jsonb,
  case s.name
    when 'Zurich Style Studio' then 'Premium hair salon known for skilled stylists and modern techniques.'
    when 'Budget Cuts Express' then 'No-frills haircuts at budget prices. Perfect for quick, simple cuts.'
    when 'SparkleWash Zurich' then 'Reliable hand car wash with attention to detail.'
    when 'Hiltl Vegetarian' then 'World''s oldest vegetarian restaurant. A must-visit.'
    else 'A reliable local business with good reviews.'
  end,
  case when s.rating >= 4.5 then 0.8 when s.rating >= 4.0 then 0.6 else 0.4 end
from public.stores s
where s.is_seed_data = true
  and s.name in ('Zurich Style Studio', 'Budget Cuts Express', 'SparkleWash Zurich', 'Hiltl Vegetarian')
on conflict (store_id) do nothing;

-- Demo user profile
insert into public.user_profiles (
  user_id, persona, budget_level, travel_purpose, special_needs,
  weight_price, weight_distance, weight_rating, weight_transit,
  preferred_categories, language, onboarding_completed
) values (
  'demo-user-001', 'student', 'budget', 'daily_errands', array['none'],
  0.35, 0.25, 0.20, 0.20,
  array['hair_salon', 'restaurant', 'cafe'], 'en', true
) on conflict (user_id) do nothing;

-- ============================================================================
-- DONE! Verify with:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT name, category, rating FROM stores WHERE is_seed_data = true;
-- SELECT * FROM find_stores_within_radius(47.37, 8.54, 5.0) LIMIT 5;
-- ============================================================================
