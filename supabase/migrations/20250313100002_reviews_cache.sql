-- Migration: Reviews and LLM summaries cache
-- Caches Apify review scraper results and Review Agent LLM summaries
-- Supports US-15 (Review Agent), US-03 (detail aggregation), US-04 (star rating reasons)

-- ---------------------------------------------------------------------------
-- reviews (raw reviews from Apify)
-- ---------------------------------------------------------------------------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores (id) on delete cascade,
  
  -- Review metadata
  review_id text,
  author_name text,
  author_url text,
  
  -- Review content
  rating int not null check (rating >= 1 and rating <= 5),
  text_content text,
  language text,
  
  -- Timestamps
  published_at timestamptz,
  crawled_at timestamptz not null default now(),
  
  created_at timestamptz not null default now()
);

comment on table public.reviews is 'Raw reviews from Apify Google Maps review scraper';

-- Index for fetching reviews by store
create index if not exists reviews_store_id_idx on public.reviews (store_id);

-- Index for filtering by rating (for star-specific analysis)
create index if not exists reviews_store_rating_idx on public.reviews (store_id, rating);

-- Partial index for high-rating reviews (5-star analysis)
create index if not exists reviews_high_rating_idx
  on public.reviews (store_id, published_at desc)
  where rating >= 4;

-- Partial index for low-rating reviews (1-2 star analysis)
create index if not exists reviews_low_rating_idx
  on public.reviews (store_id, published_at desc)
  where rating <= 2;

-- ---------------------------------------------------------------------------
-- review_summaries (LLM-generated summaries from Review Agent)
-- ---------------------------------------------------------------------------
create table if not exists public.review_summaries (
  id uuid primary key default gen_random_uuid(),
  store_id uuid unique not null references public.stores (id) on delete cascade,
  
  -- LLM-generated advantages/disadvantages (US-15)
  advantages text[] not null default '{}',
  disadvantages text[] not null default '{}',
  
  -- Star-specific reasons (US-04)
  -- Format: {"5": ["reason1", "reason2"], "4": [...], ...}
  star_reasons jsonb not null default '{}',
  
  -- Overall summary
  overall_summary text,
  
  -- Recommended products/services mentioned in reviews
  recommended_items text[],
  
  -- Sentiment scores (optional, from LLM analysis)
  sentiment_score double precision check (sentiment_score >= -1 and sentiment_score <= 1),
  
  -- Processing metadata
  review_count_processed int not null default 0,
  model_used text,
  language text not null default 'en',
  
  -- Cache control
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '3 days'),
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.review_summaries is 'LLM-generated review summaries from Review Agent';
comment on column public.review_summaries.advantages is 'Top 3-5 positive points from reviews';
comment on column public.review_summaries.disadvantages is 'Top 3-5 negative points from reviews';
comment on column public.review_summaries.star_reasons is 'Reasons grouped by star rating: {"5": [...], "1": [...]}';
comment on column public.review_summaries.sentiment_score is 'Overall sentiment: -1 (negative) to 1 (positive)';

-- Index for cache expiration
create index if not exists review_summaries_expires_at_idx
  on public.review_summaries (expires_at);

-- Trigger for updated_at
drop trigger if exists review_summaries_updated_at on public.review_summaries;
create trigger review_summaries_updated_at
  before update on public.review_summaries
  for each row execute function public.update_updated_at_column();
