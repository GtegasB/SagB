-- Audit events (imutável) e membership básico
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

create index if not exists idx_audit_events_workspace on public.audit_events(workspace_id);
create index if not exists idx_audit_events_entity on public.audit_events(entity_type, entity_id);

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

create index if not exists idx_workspace_members_workspace on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
