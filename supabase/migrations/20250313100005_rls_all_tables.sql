-- Migration: Row Level Security for all new tables
-- Backend uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- These policies apply when using anon/authenticated keys (e.g. frontend).

-- ---------------------------------------------------------------------------
-- user_profiles RLS
-- ---------------------------------------------------------------------------
alter table public.user_profiles enable row level security;

-- Users can only access their own profile
create policy "Users can view own profile"
  on public.user_profiles for select
  to authenticated
  using (user_id = auth.uid()::text);

create policy "Users can update own profile"
  on public.user_profiles for update
  to authenticated
  using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  to authenticated
  with check (user_id = auth.uid()::text);

-- Service role (backend) has full access via bypass

-- ---------------------------------------------------------------------------
-- stores RLS (public read, service-only write)
-- ---------------------------------------------------------------------------
alter table public.stores enable row level security;

-- Anyone can read stores (public data)
create policy "Public read access to stores"
  on public.stores for select
  to anon, authenticated
  using (true);

-- Only service role can insert/update/delete (via bypass)

-- ---------------------------------------------------------------------------
-- reviews RLS (public read, service-only write)
-- ---------------------------------------------------------------------------
alter table public.reviews enable row level security;

create policy "Public read access to reviews"
  on public.reviews for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- review_summaries RLS (public read, service-only write)
-- ---------------------------------------------------------------------------
alter table public.review_summaries enable row level security;

create policy "Public read access to review summaries"
  on public.review_summaries for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- transit_routes RLS (public read, service-only write)
-- ---------------------------------------------------------------------------
alter table public.transit_routes enable row level security;

create policy "Public read access to transit routes"
  on public.transit_routes for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- agent_traces RLS (authenticated read for debug panel)
-- ---------------------------------------------------------------------------
alter table public.agent_traces enable row level security;

-- Authenticated users can read traces (for debug panel)
create policy "Authenticated read access to traces"
  on public.agent_traces for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- agent_trace_nodes RLS
-- ---------------------------------------------------------------------------
alter table public.agent_trace_nodes enable row level security;

create policy "Authenticated read access to trace nodes"
  on public.agent_trace_nodes for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- agent_trace_events RLS
-- ---------------------------------------------------------------------------
alter table public.agent_trace_events enable row level security;

create policy "Authenticated read access to trace events"
  on public.agent_trace_events for select
  to authenticated
  using (true);
