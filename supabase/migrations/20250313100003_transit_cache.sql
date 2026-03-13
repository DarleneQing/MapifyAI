-- Migration: Transit/SBB API results cache
-- Caches public transit calculations from Crawling Agent Sub-2 (SBB API)
-- Supports US-07 (real-time ETA), US-17 (Transit Calculator Agent)

-- ---------------------------------------------------------------------------
-- transit_routes (cached SBB API responses)
-- ---------------------------------------------------------------------------
create table if not exists public.transit_routes (
  id uuid primary key default gen_random_uuid(),
  
  -- Route endpoints
  origin_lat double precision not null,
  origin_lng double precision not null,
  destination_lat double precision not null,
  destination_lng double precision not null,
  store_id uuid references public.stores (id) on delete set null,
  
  -- Query time context
  departure_time timestamptz not null,
  
  -- Route summary (TransitInfo)
  duration_minutes int not null,
  transport_types text[] not null default '{}',
  arrival_time timestamptz,
  
  -- Detailed connections for mixed transit
  -- Format: [{"transport_type": "train", "line": "S3", "from_stop": "...", "to_stop": "...", "duration_minutes": 15}, ...]
  connections jsonb,
  
  -- Time-based labels
  time_label text check (time_label in ('open', 'closing_soon', 'closed', 'opens_later')),
  
  -- Walking distance if applicable
  walking_meters int,
  
  -- Cache metadata
  cached_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  
  created_at timestamptz not null default now()
);

comment on table public.transit_routes is 'Cached SBB public transit route calculations';
comment on column public.transit_routes.transport_types is 'Array of transport modes: train, bus, tram, walk';
comment on column public.transit_routes.connections is 'Detailed route segments for multi-leg journeys';
comment on column public.transit_routes.time_label is 'Store availability based on arrival time';

-- Composite index for route lookups (origin -> destination at specific time)
create index if not exists transit_routes_lookup_idx
  on public.transit_routes (
    origin_lat, origin_lng,
    destination_lat, destination_lng,
    departure_time
  );

-- Index for store-based lookups
create index if not exists transit_routes_store_id_idx
  on public.transit_routes (store_id)
  where store_id is not null;

-- Index for cache cleanup
create index if not exists transit_routes_expires_at_idx
  on public.transit_routes (expires_at);

-- ---------------------------------------------------------------------------
-- Helper function: Check if cached transit route exists and is valid
-- ---------------------------------------------------------------------------
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
    -- Match origin (within ~100m tolerance)
    abs(tr.origin_lat - p_origin_lat) < 0.001
    and abs(tr.origin_lng - p_origin_lng) < 0.001
    -- Match destination (within ~100m tolerance)
    and abs(tr.destination_lat - p_dest_lat) < 0.001
    and abs(tr.destination_lng - p_dest_lng) < 0.001
    -- Match departure time (within tolerance)
    and tr.departure_time between 
        p_departure_time - (p_tolerance_minutes || ' minutes')::interval
        and p_departure_time + (p_tolerance_minutes || ' minutes')::interval
    -- Not expired
    and tr.expires_at > now()
  order by abs(extract(epoch from (tr.departure_time - p_departure_time)))
  limit 1;
end;
$$ language plpgsql stable;
