-- Sensor de Qualidade e Erros das interacoes (SAGB)

create table if not exists public.agent_quality_events (
  id uuid primary key default gen_random_uuid(),
  event_id text generated always as (id::text) stored,
  workspace_id uuid not null,
  venture_id uuid,
  conversation_id uuid references public.chat_sessions(id) on delete set null,
  turn_id int,
  agent_id text,
  agent_name text,
  event_type text not null,
  event_subtype text,
  severity text not null default 'medium',
  detected_by text not null default 'system',
  message_ref text,
  excerpt text,
  correction_text text,
  model_used text,
  workflow_version text,
  dna_version text,
  policy_version text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  payload jsonb
);

create unique index if not exists idx_agent_quality_events_event_id
  on public.agent_quality_events(event_id);
create index if not exists idx_agent_quality_events_workspace
  on public.agent_quality_events(workspace_id);
create index if not exists idx_agent_quality_events_conversation
  on public.agent_quality_events(conversation_id);
create index if not exists idx_agent_quality_events_agent
  on public.agent_quality_events(agent_id);
create index if not exists idx_agent_quality_events_type
  on public.agent_quality_events(event_type);
create index if not exists idx_agent_quality_events_severity
  on public.agent_quality_events(severity);
create index if not exists idx_agent_quality_events_created_at
  on public.agent_quality_events(created_at desc);
