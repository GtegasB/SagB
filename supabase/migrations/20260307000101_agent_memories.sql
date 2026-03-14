-- Persistencia de memoria de longo prazo dos agentes

create table if not exists public.agent_memories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id text not null,
  session_id uuid,
  memory_type text not null default 'learning',
  content text not null,
  confidence numeric(5,2),
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

create index if not exists idx_agent_memories_workspace on public.agent_memories(workspace_id);
create index if not exists idx_agent_memories_agent on public.agent_memories(agent_id);
create index if not exists idx_agent_memories_session on public.agent_memories(session_id);
create index if not exists idx_agent_memories_created_at on public.agent_memories(created_at desc);
