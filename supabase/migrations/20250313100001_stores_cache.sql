-- Migration: Stores/Places cache for Apify Google Maps scraper results
-- Caches crawled store data to reduce API calls and enable demo/seed data mode
-- Follows Supabase/Postgres best practices: GiST for geo, jsonb, partial indexes

-- Enable PostGIS extension for geographic queries (if not already enabled)
create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  
  -- External identifiers
  place_id text unique not null,
  apify_source_id text,
  
  -- Basic info
  name text not null,
  category text not null,
  subcategories text[],
  
  -- Location (PostGIS point for geo queries)
  location geography(point, 4326) not null,
  address text,
  city text,
  country text default 'Switzerland',
  
  -- Contact & links
  phone text,
  website text,
  google_maps_url text,
  
  -- Ratings & reviews summary
  rating double precision check (rating >= 0 and rating <= 5),
  review_count int default 0,
  price_level int check (price_level >= 1 and price_level <= 4),
  
  -- Operating hours (jsonb for flexibility)
  -- Format: {"monday": {"open": "09:00", "close": "18:00"}, ...}
  opening_hours jsonb,
  
  -- Business attributes
  is_open_now boolean,
  temporarily_closed boolean default false,
  permanently_closed boolean default false,
  
  -- Additional attributes from Apify
  attributes jsonb,
  
  -- Cache metadata
  crawled_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  is_seed_data boolean not null default false,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.stores is 'Cached store/place data from Apify Google Maps scraper';
comment on column public.stores.place_id is 'Google Maps place_id for deduplication';
comment on column public.stores.location is 'PostGIS geography point (SRID 4326) for geo queries';
comment on column public.stores.price_level is '1=budget, 2=moderate, 3=expensive, 4=very expensive';
comment on column public.stores.is_seed_data is 'True if this is demo/seed data (never expires)';

-- Spatial index for location-based queries (find stores within radius)
create index if not exists stores_location_gist_idx
  on public.stores using gist (location);

-- Index for category filtering
create index if not exists stores_category_idx on public.stores (category);

-- Index for rating sorting
create index if not exists stores_rating_idx on public.stores (rating desc nulls last);

-- Partial index for active stores only (exclude closed)
create index if not exists stores_active_idx
  on public.stores (category, rating desc)
  where permanently_closed = false and temporarily_closed = false;

-- Index for cache expiration checks
create index if not exists stores_expires_at_idx
  on public.stores (expires_at)
  where is_seed_data = false;

-- Trigger for updated_at
drop trigger if exists stores_updated_at on public.stores;
create trigger stores_updated_at
  before update on public.stores
  for each row execute function public.update_updated_at_column();

-- ---------------------------------------------------------------------------
-- Helper function: Find stores within radius (km) of a point
-- ---------------------------------------------------------------------------
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
