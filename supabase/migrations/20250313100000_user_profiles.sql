-- Migration: User profiles for personalization
-- Supports US-09 (cold-start preferences), US-10 (weight customization), US-11 (persona classification)
-- Follows Supabase/Postgres best practices: lowercase, timestamptz, jsonb, indexes.

-- ---------------------------------------------------------------------------
-- user_profiles
-- ---------------------------------------------------------------------------
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id text unique not null,
  
  -- Persona classification (US-11): student, parent, professional, accessibility
  persona text not null default 'general'
    check (persona in ('general', 'student', 'parent', 'professional', 'accessibility')),
  
  -- Cold-start questionnaire answers (US-09)
  budget_level text not null default 'medium'
    check (budget_level in ('budget', 'medium', 'premium')),
  travel_purpose text,
  special_needs text[],
  
  -- Preference weights (US-10): 0.0 to 1.0, must sum to ~1.0
  weight_price double precision not null default 0.25
    check (weight_price >= 0 and weight_price <= 1),
  weight_distance double precision not null default 0.25
    check (weight_distance >= 0 and weight_distance <= 1),
  weight_rating double precision not null default 0.25
    check (weight_rating >= 0 and weight_rating <= 1),
  weight_transit double precision not null default 0.25
    check (weight_transit >= 0 and weight_transit <= 1),
  
  -- Brand/category preferences
  preferred_categories text[],
  avoided_categories text[],
  
  -- Language preference for LLM outputs
  language text not null default 'en'
    check (language in ('en', 'zh', 'de', 'fr', 'it')),
  
  -- Questionnaire completion flag
  onboarding_completed boolean not null default false,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.user_profiles is 'User preferences and persona for personalized recommendations';
comment on column public.user_profiles.persona is 'User persona: student (budget), parent (family), professional (quality), accessibility (special needs)';
comment on column public.user_profiles.weight_price is 'Importance weight for price factor (0-1)';
comment on column public.user_profiles.weight_distance is 'Importance weight for distance factor (0-1)';
comment on column public.user_profiles.weight_rating is 'Importance weight for rating factor (0-1)';
comment on column public.user_profiles.weight_transit is 'Importance weight for transit time factor (0-1)';

-- Index for fast lookup by user_id
create index if not exists user_profiles_user_id_idx on public.user_profiles (user_id);

-- ---------------------------------------------------------------------------
-- Function to auto-update updated_at timestamp
-- ---------------------------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Trigger for user_profiles
drop trigger if exists user_profiles_updated_at on public.user_profiles;
create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.update_updated_at_column();
