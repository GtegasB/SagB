-- CID V1 - Centro de Inteligencia Documental

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cid_material_type') then
    create type public.cid_material_type as enum (
      'pdf',
      'doc',
      'docx',
      'txt',
      'spreadsheet',
      'image',
      'audio',
      'video',
      'other'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cid_desired_action') then
    create type public.cid_desired_action as enum (
      'store_only',
      'store_transcribe',
      'store_summarize',
      'store_transcribe_summarize',
      'store_consolidate'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cid_status') then
    create type public.cid_status as enum (
      'received',
      'queued',
      'fragmenting',
      'processing',
      'transcribing',
      'summarizing',
      'consolidating',
      'completed',
      'completed_warning',
      'error',
      'paused',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'cid_output_type') then
    create type public.cid_output_type as enum (
      'extracted_text',
      'transcription',
      'summary_short',
      'summary_long',
      'consolidation',
      'keywords'
    );
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
