-- V2 - Fluxo de Inteligencia oficial (trilha auditavel)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_status') then
    create type public.intelligence_flow_status as enum (
      'pending',
      'running',
      'ok',
      'warning',
      'error',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_type') then
    create type public.intelligence_flow_type as enum (
      'conversation',
      'handoff',
      'decision',
      'task_generation',
      'cid_processing'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_source_kind') then
    create type public.intelligence_flow_source_kind as enum (
      'conversation',
      'operation',
      'quality',
      'governance',
      'cid',
      'n8n'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_actor_type') then
    create type public.intelligence_flow_actor_type as enum (
      'user',
      'agent',
      'system',
      'cid',
      'governance'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_action_type') then
    create type public.intelligence_flow_action_type as enum (
      'question',
      'analysis',
      'response',
      'handoff',
      'synthesis',
      'task_created',
      'agenda_created',
      'decision_registered',
      'knowledge_saved',
      'error'
    );
  end if;
end $$;

create table if not exists public.intelligence_flows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  venture_id uuid,
  conversation_id uuid references public.chat_sessions(id) on delete set null,
  turn_id int,
  execution_run_id text,
  flow_type public.intelligence_flow_type not null,
  source_kind public.intelligence_flow_source_kind not null,
  source_id text,
  origin text not null,
  final_action text not null default 'Em processamento',
  status public.intelligence_flow_status not null default 'pending',
  participants jsonb not null default '[]'::jsonb,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint intelligence_flows_participants_array check (jsonb_typeof(participants) = 'array')
);

create table if not exists public.intelligence_flow_steps (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.intelligence_flows(id) on delete cascade,
  workspace_id uuid not null,
  conversation_id uuid references public.chat_sessions(id) on delete set null,
  turn_id int,
  step_order int not null,
  actor_type public.intelligence_flow_actor_type not null,
  actor_id text,
  actor_name text not null,
  action_type public.intelligence_flow_action_type not null,
  status public.intelligence_flow_status not null default 'pending',
  model_used text,
  workflow_version text,
  policy_version text,
  dna_version text,
  latency_ms int,
  estimated_cost numeric(18,8),
  tokens_in int,
  tokens_out int,
  note text,
  event_time timestamptz not null default now(),
  payload jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_intelligence_flows_workspace
  on public.intelligence_flows(workspace_id);
create index if not exists idx_intelligence_flows_conversation
  on public.intelligence_flows(conversation_id);
create index if not exists idx_intelligence_flows_turn
  on public.intelligence_flows(turn_id);
create index if not exists idx_intelligence_flows_type_status
  on public.intelligence_flows(flow_type, status);
create index if not exists idx_intelligence_flows_source
  on public.intelligence_flows(source_kind, source_id);
create index if not exists idx_intelligence_flows_created_at
  on public.intelligence_flows(created_at desc);

create index if not exists idx_intelligence_flow_steps_flow
  on public.intelligence_flow_steps(flow_id, step_order);
create index if not exists idx_intelligence_flow_steps_workspace
  on public.intelligence_flow_steps(workspace_id);
create index if not exists idx_intelligence_flow_steps_conversation
  on public.intelligence_flow_steps(conversation_id);
create index if not exists idx_intelligence_flow_steps_actor
  on public.intelligence_flow_steps(actor_name);
create index if not exists idx_intelligence_flow_steps_model
  on public.intelligence_flow_steps(model_used);
create index if not exists idx_intelligence_flow_steps_event_time
  on public.intelligence_flow_steps(event_time desc);

alter table public.intelligence_flows enable row level security;
alter table public.intelligence_flow_steps enable row level security;

grant select, insert, update, delete on table public.intelligence_flows to authenticated;
grant select, insert, update, delete on table public.intelligence_flow_steps to authenticated;

drop policy if exists intelligence_flows_select_workspace on public.intelligence_flows;
create policy intelligence_flows_select_workspace on public.intelligence_flows
  for select to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flows.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists intelligence_flows_insert_workspace on public.intelligence_flows;
create policy intelligence_flows_insert_workspace on public.intelligence_flows
  for insert to authenticated
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flows.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists intelligence_flows_update_workspace on public.intelligence_flows;
create policy intelligence_flows_update_workspace on public.intelligence_flows
  for update to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flows.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flows.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists intelligence_flows_delete_workspace on public.intelligence_flows;
create policy intelligence_flows_delete_workspace on public.intelligence_flows
  for delete to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flows.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists intelligence_flow_steps_select_workspace on public.intelligence_flow_steps;
create policy intelligence_flow_steps_select_workspace on public.intelligence_flow_steps
  for select to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flow_steps.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists intelligence_flow_steps_insert_workspace on public.intelligence_flow_steps;
create policy intelligence_flow_steps_insert_workspace on public.intelligence_flow_steps
  for insert to authenticated
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flow_steps.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists intelligence_flow_steps_update_workspace on public.intelligence_flow_steps;
create policy intelligence_flow_steps_update_workspace on public.intelligence_flow_steps
  for update to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flow_steps.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flow_steps.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists intelligence_flow_steps_delete_workspace on public.intelligence_flow_steps;
create policy intelligence_flow_steps_delete_workspace on public.intelligence_flow_steps
  for delete to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = intelligence_flow_steps.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );
