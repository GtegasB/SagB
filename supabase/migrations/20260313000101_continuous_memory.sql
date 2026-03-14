-- Memoria Continua V1/V2 scaffold oficial do SAGB

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuous_memory_session_status') then
    create type public.continuous_memory_session_status as enum (
      'draft',
      'live',
      'paused',
      'ended',
      'processing',
      'completed',
      'error'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuous_memory_capture_mode') then
    create type public.continuous_memory_capture_mode as enum (
      'microphone',
      'upload',
      'hybrid',
      'system'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuous_memory_chunk_status') then
    create type public.continuous_memory_chunk_status as enum (
      'queued',
      'capturing',
      'captured',
      'uploading',
      'stored',
      'transcribing',
      'classified',
      'completed',
      'error',
      'retrying'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuous_memory_transcript_status') then
    create type public.continuous_memory_transcript_status as enum (
      'pending',
      'processing',
      'completed',
      'error',
      'retrying'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuous_memory_job_status') then
    create type public.continuous_memory_job_status as enum (
      'queued',
      'running',
      'completed',
      'completed_warning',
      'error',
      'cancelled',
      'retrying'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuous_memory_file_role') then
    create type public.continuous_memory_file_role as enum (
      'session_audio_master',
      'chunk_audio_original',
      'chunk_audio_cleaned',
      'chunk_waveform',
      'chunk_transcript_attachment'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuous_memory_output_type') then
    create type public.continuous_memory_output_type as enum (
      'transcript',
      'summary_session',
      'summary_period',
      'classification',
      'extraction',
      'agent_brief',
      'timeline_note'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuous_memory_source_type') then
    create type public.continuous_memory_source_type as enum (
      'system',
      'ai',
      'user',
      'rule'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'continuous_memory_item_type') then
    create type public.continuous_memory_item_type as enum (
      'idea',
      'task',
      'decision',
      'insight',
      'reminder',
      'meeting',
      'command',
      'observation',
      'personal',
      'noise',
      'objection',
      'follow_up',
      'question'
    );
  end if;
end $$;

create table if not exists public.continuous_memory_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  venture_id uuid,
  project_id uuid,
  area_id uuid,
  session_date date not null default current_date,
  title text not null,
  source_device text,
  capture_mode public.continuous_memory_capture_mode not null default 'microphone',
  status public.continuous_memory_session_status not null default 'draft',
  sensitivity_level text not null default 'internal',
  allow_agent_reading boolean not null default false,
  started_at timestamptz,
  ended_at timestamptz,
  total_chunks int not null default 0,
  total_duration_seconds numeric(12,3) not null default 0,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.continuous_memory_chunks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.continuous_memory_sessions(id) on delete cascade,
  workspace_id uuid not null,
  venture_id uuid,
  project_id uuid,
  chunk_index int not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds numeric(12,3) not null default 0,
  status public.continuous_memory_chunk_status not null default 'queued',
  transcript_status public.continuous_memory_transcript_status not null default 'pending',
  transcript_text text,
  transcript_confidence numeric(5,2),
  detected_language text,
  noise_score numeric(5,2),
  importance_flag boolean not null default false,
  anchor_flag boolean not null default false,
  source_context text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  error_message text,
  payload jsonb,
  constraint continuous_memory_chunks_unique unique (session_id, chunk_index)
);

create table if not exists public.continuous_memory_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id uuid not null references public.continuous_memory_sessions(id) on delete cascade,
  chunk_id uuid references public.continuous_memory_chunks(id) on delete cascade,
  file_role public.continuous_memory_file_role not null,
  storage_bucket text not null default 'continuous-memory',
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  checksum text,
  duration_seconds numeric(12,3),
  created_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.continuous_memory_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id uuid references public.continuous_memory_sessions(id) on delete cascade,
  chunk_id uuid references public.continuous_memory_chunks(id) on delete cascade,
  job_type text not null,
  job_status public.continuous_memory_job_status not null default 'queued',
  processor_type text,
  processor_name text,
  priority int not null default 50,
  attempt_count int not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  latency_ms bigint,
  estimated_cost numeric(18,8),
  tokens_in int,
  tokens_out int,
  workflow_version text,
  policy_version text,
  status_note text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.continuous_memory_outputs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id uuid not null references public.continuous_memory_sessions(id) on delete cascade,
  chunk_id uuid references public.continuous_memory_chunks(id) on delete cascade,
  output_type public.continuous_memory_output_type not null,
  content text not null default '',
  version int not null default 1,
  generated_by text,
  created_at timestamptz not null default now(),
  payload jsonb
);

create table if not exists public.continuous_memory_labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid,
  name text not null,
  description text,
  color text,
  created_at timestamptz not null default now(),
  payload jsonb,
  constraint continuous_memory_labels_unique unique (workspace_id, name)
);

create table if not exists public.continuous_memory_chunk_labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  chunk_id uuid not null references public.continuous_memory_chunks(id) on delete cascade,
  label_id uuid not null references public.continuous_memory_labels(id) on delete cascade,
  confidence_score numeric(5,2),
  source_type public.continuous_memory_source_type not null default 'system',
  created_at timestamptz not null default now(),
  constraint continuous_memory_chunk_labels_unique unique (chunk_id, label_id, source_type)
);

create table if not exists public.continuous_memory_extracted_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id uuid not null references public.continuous_memory_sessions(id) on delete cascade,
  chunk_id uuid not null references public.continuous_memory_chunks(id) on delete cascade,
  item_type public.continuous_memory_item_type not null,
  title text not null,
  content text not null default '',
  priority text,
  status text not null default 'open',
  suggested_venture_id uuid,
  suggested_project_id uuid,
  suggested_agent_id text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  payload jsonb
);

create table if not exists public.continuous_memory_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  session_id uuid not null references public.continuous_memory_sessions(id) on delete cascade,
  chunk_id uuid references public.continuous_memory_chunks(id) on delete cascade,
  extracted_item_id uuid references public.continuous_memory_extracted_items(id) on delete set null,
  link_type text not null,
  linked_entity_id text,
  created_at timestamptz not null default now(),
  payload jsonb
);

create index if not exists idx_continuous_memory_sessions_workspace on public.continuous_memory_sessions(workspace_id);
create index if not exists idx_continuous_memory_sessions_date on public.continuous_memory_sessions(session_date desc);
create index if not exists idx_continuous_memory_sessions_status on public.continuous_memory_sessions(status);
create index if not exists idx_continuous_memory_sessions_venture_project on public.continuous_memory_sessions(venture_id, project_id);

create index if not exists idx_continuous_memory_chunks_workspace on public.continuous_memory_chunks(workspace_id);
create index if not exists idx_continuous_memory_chunks_session on public.continuous_memory_chunks(session_id, chunk_index);
create index if not exists idx_continuous_memory_chunks_status on public.continuous_memory_chunks(status, transcript_status);
create index if not exists idx_continuous_memory_chunks_created on public.continuous_memory_chunks(created_at desc);

create index if not exists idx_continuous_memory_files_workspace on public.continuous_memory_files(workspace_id);
create index if not exists idx_continuous_memory_files_session on public.continuous_memory_files(session_id);
create index if not exists idx_continuous_memory_files_chunk on public.continuous_memory_files(chunk_id);

create index if not exists idx_continuous_memory_jobs_workspace on public.continuous_memory_jobs(workspace_id);
create index if not exists idx_continuous_memory_jobs_session on public.continuous_memory_jobs(session_id);
create index if not exists idx_continuous_memory_jobs_chunk on public.continuous_memory_jobs(chunk_id);
create index if not exists idx_continuous_memory_jobs_status on public.continuous_memory_jobs(job_status, job_type);
create index if not exists idx_continuous_memory_jobs_created on public.continuous_memory_jobs(created_at desc);

create index if not exists idx_continuous_memory_outputs_workspace on public.continuous_memory_outputs(workspace_id);
create index if not exists idx_continuous_memory_outputs_session on public.continuous_memory_outputs(session_id);
create index if not exists idx_continuous_memory_outputs_chunk on public.continuous_memory_outputs(chunk_id);
create index if not exists idx_continuous_memory_outputs_type on public.continuous_memory_outputs(output_type);

create index if not exists idx_continuous_memory_labels_workspace on public.continuous_memory_labels(workspace_id, name);
create index if not exists idx_continuous_memory_chunk_labels_workspace on public.continuous_memory_chunk_labels(workspace_id);
create index if not exists idx_continuous_memory_chunk_labels_chunk on public.continuous_memory_chunk_labels(chunk_id);
create index if not exists idx_continuous_memory_extracted_items_workspace on public.continuous_memory_extracted_items(workspace_id);
create index if not exists idx_continuous_memory_extracted_items_session on public.continuous_memory_extracted_items(session_id);
create index if not exists idx_continuous_memory_extracted_items_chunk on public.continuous_memory_extracted_items(chunk_id);
create index if not exists idx_continuous_memory_extracted_items_type on public.continuous_memory_extracted_items(item_type, status);
create index if not exists idx_continuous_memory_links_workspace on public.continuous_memory_links(workspace_id);
create index if not exists idx_continuous_memory_links_session on public.continuous_memory_links(session_id);
create index if not exists idx_continuous_memory_links_chunk on public.continuous_memory_links(chunk_id);

insert into public.continuous_memory_labels (workspace_id, name, description, color)
values
  (null, 'idea', 'Ideia capturada na fala espontanea.', '#1d4ed8'),
  (null, 'task', 'Acao executavel ou encaminhamento.', '#047857'),
  (null, 'decision', 'Decisao tomada ou confirmada.', '#b45309'),
  (null, 'insight', 'Insight relevante para leitura futura.', '#7c3aed'),
  (null, 'reminder', 'Lembrete operacional.', '#0f766e'),
  (null, 'meeting', 'Trecho de reuniao ou alinhamento.', '#475569'),
  (null, 'command', 'Comando explicito.', '#be123c'),
  (null, 'observation', 'Observacao contextual.', '#4338ca'),
  (null, 'personal', 'Memoria pessoal/biografica.', '#6b7280'),
  (null, 'noise', 'Ruido, vazio ou fala descartavel.', '#9ca3af'),
  (null, 'objection', 'Objeção ou resistencia registrada.', '#dc2626'),
  (null, 'follow_up', 'Pendencia de acompanhamento.', '#0ea5e9'),
  (null, 'question', 'Pergunta aberta.', '#2563eb')
on conflict (workspace_id, name) do nothing;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'continuous_memory_sessions',
    'continuous_memory_chunks',
    'continuous_memory_files',
    'continuous_memory_jobs',
    'continuous_memory_outputs',
    'continuous_memory_labels',
    'continuous_memory_chunk_labels',
    'continuous_memory_extracted_items',
    'continuous_memory_links'
  ]
  loop
    execute format('alter table public.%I enable row level security', tbl);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', tbl);

    execute format('drop policy if exists %I_select_workspace on public.%I', tbl, tbl);
    execute format(
      'create policy %I_select_workspace on public.%I for select to authenticated using (
        auth.role() = ''service_role''
        or (
          %I.workspace_id is null
          and %L = ''continuous_memory_labels''
        )
        or exists (
          select 1
          from public.workspace_members wm
          where wm.workspace_id = %I.workspace_id
            and wm.user_id = auth.uid()
            and coalesce(wm.status, ''active'') <> ''inactive''
        )
      )',
      tbl, tbl, tbl, tbl, tbl
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
        or (
          %I.workspace_id is null
          and %L = ''continuous_memory_labels''
        )
      )',
      tbl, tbl, tbl, tbl, tbl
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
    values ('continuous-memory', 'continuous-memory', false, 524288000)
    on conflict (id) do nothing;
  end if;
end $$;

do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'objects') then
    execute 'drop policy if exists continuous_memory_storage_select on storage.objects';
    execute 'drop policy if exists continuous_memory_storage_insert on storage.objects';
    execute 'drop policy if exists continuous_memory_storage_update on storage.objects';
    execute 'drop policy if exists continuous_memory_storage_delete on storage.objects';

    execute $policy$
      create policy continuous_memory_storage_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'continuous-memory'
        and (
          auth.role() = 'service_role'
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id::text = split_part(name, '/', 1)
              and wm.user_id = auth.uid()
              and coalesce(wm.status, 'active') <> 'inactive'
          )
        )
      )
    $policy$;

    execute $policy$
      create policy continuous_memory_storage_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'continuous-memory'
        and (
          auth.role() = 'service_role'
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id::text = split_part(name, '/', 1)
              and wm.user_id = auth.uid()
              and coalesce(wm.status, 'active') <> 'inactive'
          )
        )
      )
    $policy$;

    execute $policy$
      create policy continuous_memory_storage_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'continuous-memory'
        and (
          auth.role() = 'service_role'
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id::text = split_part(name, '/', 1)
              and wm.user_id = auth.uid()
              and coalesce(wm.status, 'active') <> 'inactive'
          )
        )
      )
      with check (
        bucket_id = 'continuous-memory'
        and (
          auth.role() = 'service_role'
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id::text = split_part(name, '/', 1)
              and wm.user_id = auth.uid()
              and coalesce(wm.status, 'active') <> 'inactive'
          )
        )
      )
    $policy$;

    execute $policy$
      create policy continuous_memory_storage_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'continuous-memory'
        and (
          auth.role() = 'service_role'
          or exists (
            select 1
            from public.workspace_members wm
            where wm.workspace_id::text = split_part(name, '/', 1)
              and wm.user_id = auth.uid()
              and coalesce(wm.status, 'active') <> 'inactive'
          )
        )
      )
    $policy$;
  end if;
end $$;
