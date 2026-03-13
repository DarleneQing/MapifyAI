-- Migration: Agent execution traces for debugging and observability
-- Supports US-27 (Agent Trace Debug Panel)
-- Records 8-node DAG execution: input_agent, crawling_store_search, crawling_transit_calculator,
-- review_agent, evaluation_agent, orchestrator_agent, output_ranking, output_recommendation

-- ---------------------------------------------------------------------------
-- agent_traces (one per request)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_traces (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.requests (id) on delete cascade,
  
  -- Trace identification
  trace_id text unique not null,
  
  -- Overall status
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed', 'timeout')),
  
  -- Timing
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  total_duration_ms int,
  
  -- Error info if failed
  error_message text,
  error_agent text,
  
  -- Summary of results
  stores_found int default 0,
  offers_generated int default 0,
  
  created_at timestamptz not null default now()
);

comment on table public.agent_traces is 'Top-level trace records for 6-Agent DAG executions';

-- Index for request lookup
create index if not exists agent_traces_request_id_idx
  on public.agent_traces (request_id);

-- Index for trace_id lookup (for /traces/{trace_id} endpoint)
create index if not exists agent_traces_trace_id_idx
  on public.agent_traces (trace_id);

-- Index for recent traces
create index if not exists agent_traces_started_at_idx
  on public.agent_traces (started_at desc);

-- ---------------------------------------------------------------------------
-- agent_trace_nodes (individual agent execution records)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_trace_nodes (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.agent_traces (id) on delete cascade,
  
  -- Agent identification
  agent_name text not null
    check (agent_name in (
      'input_agent',
      'crawling_store_search',
      'crawling_transit_calculator', 
      'review_agent',
      'evaluation_agent',
      'orchestrator_agent',
      'output_ranking',
      'output_recommendation'
    )),
  
  -- Execution order and dependencies
  execution_order int not null,
  depends_on text[],
  
  -- Status
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'skipped')),
  
  -- Timing
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms int,
  
  -- Input/Output summaries (truncated for display)
  input_summary jsonb,
  output_summary jsonb,
  
  -- Full input/output for detailed debugging (may be large)
  input_full jsonb,
  output_full jsonb,
  
  -- Error details
  error_message text,
  error_type text,
  
  -- LLM usage stats (if applicable)
  llm_model text,
  llm_tokens_input int,
  llm_tokens_output int,
  llm_cost_usd numeric(10, 6),
  
  -- API calls made (Apify, SBB, etc.)
  api_calls jsonb,
  
  created_at timestamptz not null default now()
);

comment on table public.agent_trace_nodes is 'Individual agent node execution records within a trace';
comment on column public.agent_trace_nodes.input_summary is 'Truncated input for debug panel display';
comment on column public.agent_trace_nodes.output_summary is 'Truncated output for debug panel display';
comment on column public.agent_trace_nodes.api_calls is 'External API calls: [{"api": "apify", "endpoint": "...", "duration_ms": 123}]';

-- Index for fetching nodes by trace
create index if not exists agent_trace_nodes_trace_id_idx
  on public.agent_trace_nodes (trace_id, execution_order);

-- Index for finding slow agents
create index if not exists agent_trace_nodes_duration_idx
  on public.agent_trace_nodes (agent_name, duration_ms desc)
  where status = 'completed';

-- ---------------------------------------------------------------------------
-- agent_trace_events (SSE events log - 7 stages)
-- ---------------------------------------------------------------------------
create table if not exists public.agent_trace_events (
  id uuid primary key default gen_random_uuid(),
  trace_id uuid not null references public.agent_traces (id) on delete cascade,
  
  -- Event type (matches SSE event names)
  event_type text not null
    check (event_type in (
      'intent_parsed',
      'stores_crawled',
      'transit_computed',
      'reviews_fetched',
      'scores_computed',
      'recommendations_ready',
      'completed',
      'error'
    )),
  
  -- Event sequence
  sequence_number int not null,
  
  -- Event payload (sent to frontend via SSE)
  payload jsonb,
  
  -- Timing
  emitted_at timestamptz not null default now()
);

comment on table public.agent_trace_events is 'SSE events emitted during agent execution (7 stages)';

-- Index for fetching events by trace in order
create index if not exists agent_trace_events_trace_seq_idx
  on public.agent_trace_events (trace_id, sequence_number);

-- ---------------------------------------------------------------------------
-- Function: Get trace summary for debug panel
-- ---------------------------------------------------------------------------
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
