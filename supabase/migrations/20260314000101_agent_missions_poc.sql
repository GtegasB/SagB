do $$
begin
  if exists (
    select 1
    from pg_type
    where typname = 'intelligence_flow_type'
  ) then
    alter type public.intelligence_flow_type add value if not exists 'agent_orchestration';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'agent_mission_status') then
    create type public.agent_mission_status as enum ('queued', 'running', 'completed', 'failed');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'agent_mission_step_status') then
    create type public.agent_mission_step_status as enum ('pending', 'ready', 'running', 'completed', 'failed');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'agent_artifact_status') then
    create type public.agent_artifact_status as enum ('created', 'validated', 'rejected');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'agent_handoff_status') then
    create type public.agent_handoff_status as enum ('created', 'accepted', 'failed');
  end if;
end $$;

create table if not exists public.agent_missions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  title text not null,
  initial_input text not null default '',
  status public.agent_mission_status not null default 'queued',
  current_step_index int not null default 1,
  created_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.agent_mission_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  mission_id uuid not null references public.agent_missions(id) on delete cascade,
  step_index int not null,
  agent_id text,
  agent_name text not null,
  step_name text not null,
  artifact_type text not null,
  status public.agent_mission_step_status not null default 'pending',
  validation_status text,
  retry_count int not null default 0,
  prompt_snapshot text,
  context_snapshot jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb,
  constraint agent_mission_steps_unique unique (mission_id, step_index)
);

create table if not exists public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  mission_id uuid not null references public.agent_missions(id) on delete cascade,
  step_id uuid not null references public.agent_mission_steps(id) on delete cascade,
  artifact_type text not null,
  status public.agent_artifact_status not null default 'created',
  version int not null default 1,
  content_json jsonb,
  content_text text,
  created_by_agent_id text,
  created_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.agent_handoffs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  mission_id uuid not null references public.agent_missions(id) on delete cascade,
  from_step_id uuid not null references public.agent_mission_steps(id) on delete cascade,
  to_step_id uuid references public.agent_mission_steps(id) on delete cascade,
  from_agent_id text,
  to_agent_id text,
  artifact_id uuid references public.agent_artifacts(id) on delete set null,
  status public.agent_handoff_status not null default 'created',
  note text,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  payload jsonb
);

create index if not exists idx_agent_missions_workspace on public.agent_missions(workspace_id, created_at desc);
create index if not exists idx_agent_missions_status on public.agent_missions(status, updated_at desc);

create index if not exists idx_agent_mission_steps_workspace on public.agent_mission_steps(workspace_id, created_at desc);
create index if not exists idx_agent_mission_steps_mission on public.agent_mission_steps(mission_id, step_index);
create index if not exists idx_agent_mission_steps_status on public.agent_mission_steps(status, updated_at desc);

create index if not exists idx_agent_artifacts_workspace on public.agent_artifacts(workspace_id, created_at desc);
create index if not exists idx_agent_artifacts_mission on public.agent_artifacts(mission_id, created_at desc);
create index if not exists idx_agent_artifacts_step on public.agent_artifacts(step_id, created_at desc);

create index if not exists idx_agent_handoffs_workspace on public.agent_handoffs(workspace_id, created_at desc);
create index if not exists idx_agent_handoffs_mission on public.agent_handoffs(mission_id, created_at desc);
create index if not exists idx_agent_handoffs_steps on public.agent_handoffs(from_step_id, to_step_id);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'agent_missions',
    'agent_mission_steps',
    'agent_artifacts',
    'agent_handoffs'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', tbl);

    execute format('drop policy if exists %I_select_workspace on public.%I', tbl, tbl);
    execute format(
      'create policy %I_select_workspace on public.%I for select to authenticated using (
        auth.role() = ''service_role''
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = %I.workspace_id
            and wm.user_id = auth.uid()
            and coalesce(wm.status, ''active'') <> ''inactive''
        )
      )',
      tbl, tbl, tbl
    );

    execute format('drop policy if exists %I_insert_workspace on public.%I', tbl, tbl);
    execute format(
      'create policy %I_insert_workspace on public.%I for insert to authenticated with check (
        auth.role() = ''service_role''
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = %I.workspace_id
            and wm.user_id = auth.uid()
            and coalesce(wm.status, ''active'') <> ''inactive''
        )
      )',
      tbl, tbl, tbl
    );

    execute format('drop policy if exists %I_update_workspace on public.%I', tbl, tbl);
    execute format(
      'create policy %I_update_workspace on public.%I for update to authenticated using (
        auth.role() = ''service_role''
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = %I.workspace_id
            and wm.user_id = auth.uid()
            and coalesce(wm.status, ''active'') <> ''inactive''
        )
      ) with check (
        auth.role() = ''service_role''
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = %I.workspace_id
            and wm.user_id = auth.uid()
            and coalesce(wm.status, ''active'') <> ''inactive''
        )
      )',
      tbl, tbl, tbl, tbl
    );

    execute format('drop policy if exists %I_delete_workspace on public.%I', tbl, tbl);
    execute format(
      'create policy %I_delete_workspace on public.%I for delete to authenticated using (
        auth.role() = ''service_role''
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = %I.workspace_id
            and wm.user_id = auth.uid()
            and coalesce(wm.status, ''active'') <> ''inactive''
        )
      )',
      tbl, tbl, tbl
    );
  end loop;
end $$;
