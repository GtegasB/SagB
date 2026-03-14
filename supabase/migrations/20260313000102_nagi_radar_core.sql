-- NAGI Radar core tables

do $$
begin
  if not exists (select 1 from pg_type where typname = 'nagi_entity_type') then
    create type public.nagi_entity_type as enum (
      'idea',
      'initiative',
      'project',
      'module',
      'reusable_asset',
      'strategic_line',
      'metaproject',
      'brand'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'nagi_relation_type') then
    create type public.nagi_relation_type as enum (
      'derives_from',
      'shares_base_with',
      'shares_module_with',
      'feeds',
      'depends_on',
      'commercial_version_of',
      'internal_version_of',
      'candidate_spin_off_of',
      'overlaps_with',
      'belongs_to_line'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'nagi_signal_status') then
    create type public.nagi_signal_status as enum (
      'captured',
      'triaged',
      'distributed',
      'converted',
      'discarded'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'nagi_distribution_status') then
    create type public.nagi_distribution_status as enum (
      'pending',
      'delivered',
      'acknowledged',
      'actioned',
      'archived'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'nagi_decision_status') then
    create type public.nagi_decision_status as enum (
      'observed',
      'in_analysis',
      'incubated',
      'approved',
      'discarded',
      'converted_to_project'
    );
  end if;
end $$;

create table if not exists public.nagi_ecosystem_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  parent_entity_id uuid references public.nagi_ecosystem_entities(id) on delete set null,
  title text not null,
  slug text not null,
  entity_type public.nagi_entity_type not null,
  summary text,
  thesis text,
  strategic_track text,
  raw_materials_json jsonb not null default '[]'::jsonb,
  pipelines_json jsonb not null default '[]'::jsonb,
  outputs_json jsonb not null default '[]'::jsonb,
  audiences_json jsonb not null default '[]'::jsonb,
  affected_brands_json jsonb not null default '[]'::jsonb,
  keywords_json jsonb not null default '[]'::jsonb,
  maturity text,
  integration_potential text,
  source_ref text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb,
  constraint nagi_ecosystem_entities_workspace_slug_unique unique (workspace_id, slug)
);

create table if not exists public.nagi_entity_relations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  from_entity_id uuid not null references public.nagi_ecosystem_entities(id) on delete cascade,
  to_entity_id uuid not null references public.nagi_ecosystem_entities(id) on delete cascade,
  relation_type public.nagi_relation_type not null,
  confidence numeric(5,2),
  rationale text,
  detected_by text not null default 'manual',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb,
  constraint nagi_entity_relations_unique unique (workspace_id, from_entity_id, to_entity_id, relation_type)
);

create table if not exists public.nagi_external_signals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  theme text not null,
  signal_type text,
  source_name text,
  source_url text,
  title text not null,
  summary text,
  relevance_score numeric(5,2),
  urgency_score numeric(5,2),
  impact_scope_json jsonb not null default '[]'::jsonb,
  related_entity_ids_json jsonb not null default '[]'::jsonb,
  published_at timestamptz,
  captured_at timestamptz not null default now(),
  status public.nagi_signal_status not null default 'captured',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

create table if not exists public.nagi_insight_distributions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  signal_id uuid references public.nagi_external_signals(id) on delete set null,
  entity_id uuid references public.nagi_ecosystem_entities(id) on delete set null,
  destination_area text not null,
  destination_key text,
  priority text not null default 'medium',
  owner_user_id uuid,
  status public.nagi_distribution_status not null default 'pending',
  distributed_at timestamptz,
  acknowledged_at timestamptz,
  actioned_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

create table if not exists public.nagi_ecosystem_decisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  signal_id uuid references public.nagi_external_signals(id) on delete set null,
  entity_id uuid references public.nagi_ecosystem_entities(id) on delete set null,
  distribution_id uuid references public.nagi_insight_distributions(id) on delete set null,
  title text not null,
  decision_status public.nagi_decision_status not null default 'observed',
  rationale text,
  owner_user_id uuid,
  converted_entity_id uuid references public.nagi_ecosystem_entities(id) on delete set null,
  due_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

create index if not exists idx_nagi_ecosystem_entities_workspace on public.nagi_ecosystem_entities(workspace_id);
create index if not exists idx_nagi_ecosystem_entities_type on public.nagi_ecosystem_entities(entity_type);
create index if not exists idx_nagi_ecosystem_entities_parent on public.nagi_ecosystem_entities(parent_entity_id);
create index if not exists idx_nagi_ecosystem_entities_status on public.nagi_ecosystem_entities(status);

create index if not exists idx_nagi_entity_relations_workspace on public.nagi_entity_relations(workspace_id);
create index if not exists idx_nagi_entity_relations_from on public.nagi_entity_relations(from_entity_id);
create index if not exists idx_nagi_entity_relations_to on public.nagi_entity_relations(to_entity_id);
create index if not exists idx_nagi_entity_relations_type on public.nagi_entity_relations(relation_type);

create index if not exists idx_nagi_external_signals_workspace on public.nagi_external_signals(workspace_id);
create index if not exists idx_nagi_external_signals_theme on public.nagi_external_signals(theme);
create index if not exists idx_nagi_external_signals_status on public.nagi_external_signals(status);
create index if not exists idx_nagi_external_signals_captured_at on public.nagi_external_signals(captured_at desc);

create index if not exists idx_nagi_insight_distributions_workspace on public.nagi_insight_distributions(workspace_id);
create index if not exists idx_nagi_insight_distributions_signal on public.nagi_insight_distributions(signal_id);
create index if not exists idx_nagi_insight_distributions_entity on public.nagi_insight_distributions(entity_id);
create index if not exists idx_nagi_insight_distributions_status on public.nagi_insight_distributions(status);

create index if not exists idx_nagi_ecosystem_decisions_workspace on public.nagi_ecosystem_decisions(workspace_id);
create index if not exists idx_nagi_ecosystem_decisions_signal on public.nagi_ecosystem_decisions(signal_id);
create index if not exists idx_nagi_ecosystem_decisions_entity on public.nagi_ecosystem_decisions(entity_id);
create index if not exists idx_nagi_ecosystem_decisions_status on public.nagi_ecosystem_decisions(decision_status);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'nagi_ecosystem_entities',
    'nagi_entity_relations',
    'nagi_external_signals',
    'nagi_insight_distributions',
    'nagi_ecosystem_decisions'
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
