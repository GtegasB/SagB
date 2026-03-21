-- EXECUTE THIS IN SUPABASE SQL EDITOR
-- This will create all governance tables

-- 1. Governance core tables
create table if not exists public.governance_global_culture (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  title text not null,
  summary text,
  content_md text not null,
  version int not null default 1,
  effective_from timestamptz,
  effective_to timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

create table if not exists public.governance_compliance_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  code text not null,
  title text not null,
  description text,
  severity text not null default 'medium',
  scope text not null,
  subject text,
  rule_md text not null,
  version int not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  provider text not null,
  env text not null,
  item_type text not null,
  owner_email text,
  storage_path text,
  secret_ref text,
  rotate_policy text,
  last_rotated_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

-- 2. Workspace members and audit
create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid not null,
  role text not null default 'viewer',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb,
  unique(workspace_id, user_id)
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  actor_type text not null,
  actor_id uuid,
  actor_label text,
  diff jsonb,
  created_at timestamptz not null default now(),
  payload jsonb
);

-- 3. Knowledge tables
create table if not exists public.knowledge_nodes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  parent_id uuid references public.knowledge_nodes(id) on delete set null,
  node_type text not null,
  slug text,
  title text not null,
  content_md text,
  link_url text,
  order_index int not null default 0,
  version int not null default 1,
  visibility text not null default 'internal',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

create table if not exists public.knowledge_attachments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  node_id uuid not null references public.knowledge_nodes(id) on delete cascade,
  bucket text not null,
  path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  checksum text,
  version int not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

-- 4. Agent configs (NEW)
create table if not exists public.agent_configs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id text not null,
  full_prompt text not null default '',
  global_documents jsonb default '[]',
  doc_count int default 0,
  version int not null default 1,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb,
  unique(workspace_id, agent_id)
);

-- 4.1 Agent DNA layers (global + individual + effective snapshot)
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
  unique(workspace_id, agent_id)
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
  unique(workspace_id, agent_id)
);

-- 5. Chat persistence tables
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  agent_id text not null,
  owner_user_id uuid,
  title text not null default 'Nova Conversa',
  status text not null default 'active',
  bu_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  agent_id text not null,
  sender text not null,
  text text not null default '',
  bu_id text,
  participant_name text,
  has_attachment boolean not null default false,
  attachment jsonb,
  created_at timestamptz not null default now(),
  payload jsonb
);

-- 6. Agent memories (long-term learning)
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

-- 7. Agent quality events (sensor de qualidade e erros)
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

-- 8. Fluxo de Inteligencia oficial (V2)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_status') then
    create type public.intelligence_flow_status as enum ('pending','running','ok','warning','error','cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_type') then
    create type public.intelligence_flow_type as enum ('conversation','handoff','decision','task_generation','cid_processing');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_source_kind') then
    create type public.intelligence_flow_source_kind as enum ('conversation','operation','quality','governance','cid','n8n');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_actor_type') then
    create type public.intelligence_flow_actor_type as enum ('user','agent','system','cid','governance');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'intelligence_flow_action_type') then
    create type public.intelligence_flow_action_type as enum (
      'question','analysis','response','handoff','synthesis','task_created','agenda_created','decision_registered','knowledge_saved','error'
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

-- Create indexes
create index if not exists idx_governance_global_culture_workspace on public.governance_global_culture(workspace_id);
create index if not exists idx_governance_compliance_workspace on public.governance_compliance_rules(workspace_id);
create index if not exists idx_vault_items_workspace on public.vault_items(workspace_id);
create index if not exists idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_audit_events_workspace on public.audit_events(workspace_id);
create index if not exists idx_audit_events_entity on public.audit_events(entity_type, entity_id);
create index if not exists idx_knowledge_nodes_workspace on public.knowledge_nodes(workspace_id);
create index if not exists idx_knowledge_nodes_parent on public.knowledge_nodes(parent_id);
create index if not exists idx_knowledge_attachments_workspace on public.knowledge_attachments(workspace_id);
create index if not exists idx_knowledge_attachments_node on public.knowledge_attachments(node_id);
create index if not exists idx_agent_configs_workspace on public.agent_configs(workspace_id);
create index if not exists idx_agent_configs_agent on public.agent_configs(agent_id);
create index if not exists idx_agent_dna_profiles_workspace on public.agent_dna_profiles(workspace_id);
create index if not exists idx_agent_dna_profiles_agent on public.agent_dna_profiles(agent_id);
create index if not exists idx_agent_dna_effective_workspace on public.agent_dna_effective(workspace_id);
create index if not exists idx_agent_dna_effective_agent on public.agent_dna_effective(agent_id);
create index if not exists idx_chat_sessions_workspace on public.chat_sessions(workspace_id);
create index if not exists idx_chat_sessions_agent on public.chat_sessions(agent_id);
create index if not exists idx_chat_sessions_owner on public.chat_sessions(owner_user_id);
create index if not exists idx_chat_sessions_last_message on public.chat_sessions(last_message_at desc);
create index if not exists idx_chat_messages_workspace on public.chat_messages(workspace_id);
create index if not exists idx_chat_messages_session on public.chat_messages(session_id, created_at);
create index if not exists idx_chat_messages_agent on public.chat_messages(agent_id);
create index if not exists idx_agent_memories_workspace on public.agent_memories(workspace_id);
create index if not exists idx_agent_memories_agent on public.agent_memories(agent_id);
create index if not exists idx_agent_memories_session on public.agent_memories(session_id);
create index if not exists idx_agent_memories_created_at on public.agent_memories(created_at desc);
create unique index if not exists idx_agent_quality_events_event_id on public.agent_quality_events(event_id);
create index if not exists idx_agent_quality_events_workspace on public.agent_quality_events(workspace_id);
create index if not exists idx_agent_quality_events_conversation on public.agent_quality_events(conversation_id);
create index if not exists idx_agent_quality_events_agent on public.agent_quality_events(agent_id);
create index if not exists idx_agent_quality_events_type on public.agent_quality_events(event_type);
create index if not exists idx_agent_quality_events_severity on public.agent_quality_events(severity);
create index if not exists idx_agent_quality_events_created_at on public.agent_quality_events(created_at desc);
create index if not exists idx_intelligence_flows_workspace on public.intelligence_flows(workspace_id);
create index if not exists idx_intelligence_flows_conversation on public.intelligence_flows(conversation_id);
create index if not exists idx_intelligence_flows_turn on public.intelligence_flows(turn_id);
create index if not exists idx_intelligence_flows_type_status on public.intelligence_flows(flow_type, status);
create index if not exists idx_intelligence_flows_source on public.intelligence_flows(source_kind, source_id);
create index if not exists idx_intelligence_flows_created_at on public.intelligence_flows(created_at desc);
create index if not exists idx_intelligence_flow_steps_flow on public.intelligence_flow_steps(flow_id, step_order);
create index if not exists idx_intelligence_flow_steps_workspace on public.intelligence_flow_steps(workspace_id);
create index if not exists idx_intelligence_flow_steps_conversation on public.intelligence_flow_steps(conversation_id);
create index if not exists idx_intelligence_flow_steps_actor on public.intelligence_flow_steps(actor_name);
create index if not exists idx_intelligence_flow_steps_model on public.intelligence_flow_steps(model_used);
create index if not exists idx_intelligence_flow_steps_event_time on public.intelligence_flow_steps(event_time desc);

-- RLS - Agent DNA layers
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

-- RLS - Fluxo de Inteligencia
alter table if exists public.intelligence_flows enable row level security;
alter table if exists public.intelligence_flow_steps enable row level security;

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

-- CID V1 - Centro de Inteligencia Documental
do $$
begin
  if not exists (select 1 from pg_type where typname = 'cid_material_type') then
    create type public.cid_material_type as enum ('pdf','doc','docx','txt','spreadsheet','image','audio','video','other');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cid_desired_action') then
    create type public.cid_desired_action as enum ('store_only','store_transcribe','store_summarize','store_transcribe_summarize','store_consolidate');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cid_status') then
    create type public.cid_status as enum ('received','queued','fragmenting','processing','transcribing','summarizing','consolidating','completed','completed_warning','error','paused','cancelled');
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cid_output_type') then
    create type public.cid_output_type as enum ('extracted_text','transcription','summary_short','summary_long','consolidation','keywords');
  end if;
end $$;

create table if not exists public.cid_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  venture_id uuid,
  title text not null,
  material_type public.cid_material_type not null default 'other',
  area text,
  project text,
  sensitivity text not null default 'internal',
  owner_user_id uuid,
  owner_name text,
  language text not null default 'pt-BR',
  desired_action public.cid_desired_action not null default 'store_only',
  source_kind text not null default 'upload',
  source_id text,
  is_consultable boolean not null default false,
  status public.cid_status not null default 'received',
  progress_pct int not null default 0,
  total_parts int not null default 0,
  completed_parts int not null default 0,
  pending_parts int not null default 0,
  processing_started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb,
  constraint cid_assets_progress_range check (progress_pct >= 0 and progress_pct <= 100)
);

create table if not exists public.cid_asset_files (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.cid_assets(id) on delete cascade,
  workspace_id uuid not null,
  bucket text not null default 'cid-assets',
  path text not null,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  duration_sec numeric(12,3),
  checksum text,
  status text not null default 'stored',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.cid_batches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  venture_id uuid,
  title text not null,
  source text,
  status text not null default 'open',
  total_items int not null default 0,
  processed_items int not null default 0,
  failed_items int not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.cid_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.cid_assets(id) on delete cascade,
  workspace_id uuid not null,
  batch_id uuid references public.cid_batches(id) on delete set null,
  job_type text not null default 'ingestion',
  action_plan jsonb,
  queue_position int,
  status public.cid_status not null default 'queued',
  progress_pct int not null default 0,
  total_parts int not null default 0,
  completed_parts int not null default 0,
  pending_parts int not null default 0,
  retries int not null default 0,
  max_retries int not null default 3,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb,
  constraint cid_jobs_progress_range check (progress_pct >= 0 and progress_pct <= 100)
);

create table if not exists public.cid_chunks (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.cid_assets(id) on delete cascade,
  job_id uuid references public.cid_processing_jobs(id) on delete set null,
  workspace_id uuid not null,
  chunk_index int not null,
  chunk_kind text not null default 'text_block',
  char_start int,
  char_end int,
  byte_start bigint,
  byte_end bigint,
  time_start_sec numeric(12,3),
  time_end_sec numeric(12,3),
  text_content text,
  status public.cid_status not null default 'queued',
  retries int not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb,
  constraint cid_chunks_unique unique (asset_id, chunk_index)
);

create table if not exists public.cid_outputs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.cid_assets(id) on delete cascade,
  job_id uuid references public.cid_processing_jobs(id) on delete set null,
  workspace_id uuid not null,
  output_type public.cid_output_type not null,
  content_text text,
  content_json jsonb,
  language text,
  version int not null default 1,
  status text not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.cid_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  color text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb,
  constraint cid_tags_name_unique unique (workspace_id, name)
);

create table if not exists public.cid_asset_tags (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  asset_id uuid not null references public.cid_assets(id) on delete cascade,
  tag_id uuid not null references public.cid_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  payload jsonb,
  constraint cid_asset_tags_unique unique (asset_id, tag_id)
);

create table if not exists public.cid_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  asset_id uuid not null references public.cid_assets(id) on delete cascade,
  link_type text not null,
  linked_id text,
  linked_label text,
  created_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.cid_batch_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  batch_id uuid not null references public.cid_batches(id) on delete cascade,
  asset_id uuid not null references public.cid_assets(id) on delete cascade,
  status text not null default 'queued',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb,
  constraint cid_batch_items_unique unique (batch_id, asset_id)
);

create index if not exists idx_cid_assets_workspace on public.cid_assets(workspace_id);
create index if not exists idx_cid_assets_status on public.cid_assets(status);
create index if not exists idx_cid_assets_venture on public.cid_assets(venture_id);
create index if not exists idx_cid_assets_created_at on public.cid_assets(created_at desc);
create index if not exists idx_cid_asset_files_workspace on public.cid_asset_files(workspace_id);
create index if not exists idx_cid_asset_files_asset on public.cid_asset_files(asset_id);
create index if not exists idx_cid_batches_workspace on public.cid_batches(workspace_id);
create index if not exists idx_cid_batches_status on public.cid_batches(status);
create index if not exists idx_cid_batch_items_workspace on public.cid_batch_items(workspace_id);
create index if not exists idx_cid_batch_items_batch on public.cid_batch_items(batch_id);
create index if not exists idx_cid_batch_items_asset on public.cid_batch_items(asset_id);
create index if not exists idx_cid_jobs_workspace on public.cid_processing_jobs(workspace_id);
create index if not exists idx_cid_jobs_asset on public.cid_processing_jobs(asset_id);
create index if not exists idx_cid_jobs_status on public.cid_processing_jobs(status);
create index if not exists idx_cid_jobs_batch on public.cid_processing_jobs(batch_id);
create index if not exists idx_cid_jobs_created_at on public.cid_processing_jobs(created_at desc);
create index if not exists idx_cid_chunks_workspace on public.cid_chunks(workspace_id);
create index if not exists idx_cid_chunks_asset on public.cid_chunks(asset_id);
create index if not exists idx_cid_chunks_job on public.cid_chunks(job_id);
create index if not exists idx_cid_chunks_status on public.cid_chunks(status);
create index if not exists idx_cid_outputs_workspace on public.cid_outputs(workspace_id);
create index if not exists idx_cid_outputs_asset on public.cid_outputs(asset_id);
create index if not exists idx_cid_outputs_job on public.cid_outputs(job_id);
create index if not exists idx_cid_outputs_type on public.cid_outputs(output_type);
create index if not exists idx_cid_outputs_created_at on public.cid_outputs(created_at desc);
create index if not exists idx_cid_tags_workspace on public.cid_tags(workspace_id);
create index if not exists idx_cid_asset_tags_workspace on public.cid_asset_tags(workspace_id);
create index if not exists idx_cid_links_workspace on public.cid_links(workspace_id);
create index if not exists idx_cid_links_asset on public.cid_links(asset_id);

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'cid_assets',
    'cid_asset_files',
    'cid_batches',
    'cid_batch_items',
    'cid_processing_jobs',
    'cid_chunks',
    'cid_outputs',
    'cid_tags',
    'cid_asset_tags',
    'cid_links'
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

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('cid-assets', 'cid-assets', false, 104857600)
    on conflict (id) do nothing;
  end if;
end $$;

-- Compatibilidade de schema legado (users sem payload)
alter table if exists public.users
  add column if not exists payload jsonb;

update public.users
set payload = '{}'::jsonb
where payload is null;

-- IMPORTANTE:
-- A frente oficial de Memoria Continua foi adicionada em:
-- supabase/migrations/20260313000101_continuous_memory.sql
-- Execute essa migration junto do pacote principal ao subir o modulo.

select 'All governance tables created successfully!' as result;
