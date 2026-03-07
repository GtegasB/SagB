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
create index if not exists idx_chat_sessions_workspace on public.chat_sessions(workspace_id);
create index if not exists idx_chat_sessions_agent on public.chat_sessions(agent_id);
create index if not exists idx_chat_sessions_owner on public.chat_sessions(owner_user_id);
create index if not exists idx_chat_sessions_last_message on public.chat_sessions(last_message_at desc);
create index if not exists idx_chat_messages_workspace on public.chat_messages(workspace_id);
create index if not exists idx_chat_messages_session on public.chat_messages(session_id, created_at);
create index if not exists idx_chat_messages_agent on public.chat_messages(agent_id);

select 'All governance tables created successfully!' as result;
