-- Governance core tables: cultura, compliance e vault
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
  severity text not null default 'medium', -- low, medium, high, critical
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

create index if not exists idx_governance_global_culture_workspace on public.governance_global_culture(workspace_id);
create index if not exists idx_governance_compliance_workspace on public.governance_compliance_rules(workspace_id);

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

create index if not exists idx_vault_items_workspace on public.vault_items(workspace_id);
