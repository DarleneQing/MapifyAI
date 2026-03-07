-- Migration: Row Level Security for requests and offers
-- Backend uses SUPABASE_SERVICE_ROLE_KEY which bypasses RLS.
-- These policies apply when using anon/authenticated keys (e.g. future frontend).

alter table public.requests enable row level security;
alter table public.offers enable row level security;

-- Allow authenticated users full access to requests (e.g. via auth.uid() later)
-- For now: allow all for authenticated so API can be used with JWT.
create policy "Authenticated full access to requests"
  on public.requests for all
  to authenticated
  using (true)
  with check (true);

-- Allow authenticated users full access to offers
create policy "Authenticated full access to offers"
  on public.offers for all
  to authenticated
  using (true)
  with check (true);

-- Optional: allow anon read-only for public request/offer display (adjust as needed)
-- create policy "Anon read requests" on public.requests for select to anon using (true);
-- create policy "Anon read offers"  on public.offers for select to anon using (true);
