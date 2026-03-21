-- Camadas de DNA de Agentes
-- 1) Perfil individual (override) por agente
-- 2) Snapshot efetivo sincronizado para runtime

create table if not exists public.agent_dna_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id text not null,
  individual_prompt text,
  version int not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb,
  unique (workspace_id, agent_id)
);

create table if not exists public.agent_dna_effective (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id text not null,
  effective_prompt text not null,
  profile_version int,
  status text not null default 'active',
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb,
  unique (workspace_id, agent_id)
);

create index if not exists idx_agent_dna_profiles_workspace on public.agent_dna_profiles(workspace_id);
create index if not exists idx_agent_dna_profiles_agent on public.agent_dna_profiles(agent_id);
create index if not exists idx_agent_dna_profiles_updated_at on public.agent_dna_profiles(updated_at desc);

create index if not exists idx_agent_dna_effective_workspace on public.agent_dna_effective(workspace_id);
create index if not exists idx_agent_dna_effective_agent on public.agent_dna_effective(agent_id);
create index if not exists idx_agent_dna_effective_synced_at on public.agent_dna_effective(synced_at desc);

alter table if exists public.agent_dna_profiles enable row level security;
alter table if exists public.agent_dna_effective enable row level security;

grant select, insert, update, delete on table public.agent_dna_profiles to authenticated;
grant select, insert, update, delete on table public.agent_dna_effective to authenticated;

drop policy if exists agent_dna_profiles_select_workspace on public.agent_dna_profiles;
create policy agent_dna_profiles_select_workspace on public.agent_dna_profiles
  for select to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_profiles.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists agent_dna_profiles_insert_workspace on public.agent_dna_profiles;
create policy agent_dna_profiles_insert_workspace on public.agent_dna_profiles
  for insert to authenticated
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_profiles.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists agent_dna_profiles_update_workspace on public.agent_dna_profiles;
create policy agent_dna_profiles_update_workspace on public.agent_dna_profiles
  for update to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_profiles.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_profiles.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists agent_dna_profiles_delete_workspace on public.agent_dna_profiles;
create policy agent_dna_profiles_delete_workspace on public.agent_dna_profiles
  for delete to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_profiles.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists agent_dna_effective_select_workspace on public.agent_dna_effective;
create policy agent_dna_effective_select_workspace on public.agent_dna_effective
  for select to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_effective.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists agent_dna_effective_insert_workspace on public.agent_dna_effective;
create policy agent_dna_effective_insert_workspace on public.agent_dna_effective
  for insert to authenticated
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_effective.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists agent_dna_effective_update_workspace on public.agent_dna_effective;
create policy agent_dna_effective_update_workspace on public.agent_dna_effective
  for update to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_effective.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  )
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_effective.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );

drop policy if exists agent_dna_effective_delete_workspace on public.agent_dna_effective;
create policy agent_dna_effective_delete_workspace on public.agent_dna_effective
  for delete to authenticated
  using (
    auth.role() = 'service_role'
    or exists (
      select 1
      from public.workspace_members wm
      where wm.workspace_id = agent_dna_effective.workspace_id
        and wm.user_id = auth.uid()
        and coalesce(wm.status, 'active') <> 'inactive'
    )
  );
