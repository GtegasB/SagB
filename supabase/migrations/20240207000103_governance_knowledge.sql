-- Knowledge tree (metodologias) e anexos
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

create index if not exists idx_knowledge_nodes_workspace on public.knowledge_nodes(workspace_id);
create index if not exists idx_knowledge_nodes_parent on public.knowledge_nodes(parent_id);

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

create index if not exists idx_knowledge_attachments_workspace on public.knowledge_attachments(workspace_id);
create index if not exists idx_knowledge_attachments_node on public.knowledge_attachments(node_id);
