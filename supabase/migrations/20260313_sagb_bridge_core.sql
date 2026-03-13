-- SagB Bridge core tables

do $$
begin
  if not exists (select 1 from pg_type where typname = 'dev_profile_type') then
    create type public.dev_profile_type as enum (
      'desktop',
      'wsl',
      'devcontainer',
      'remote-ssh'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'dev_task_status') then
    create type public.dev_task_status as enum (
      'backlog',
      'todo',
      'in_progress',
      'blocked',
      'done',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'dev_run_status') then
    create type public.dev_run_status as enum (
      'in_progress',
      'blocked',
      'done',
      'cancelled'
    );
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'dev_launch_status') then
    create type public.dev_launch_status as enum (
      'issued',
      'consumed',
      'expired',
      'cancelled'
    );
  end if;
end $$;

create table if not exists public.dev_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name text not null,
  slug text not null,
  repository_url text,
  default_branch text not null default 'main',
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb,
  constraint dev_projects_workspace_slug_unique unique (workspace_id, slug)
);

create table if not exists public.dev_tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id uuid not null references public.dev_projects(id) on delete cascade,
  task_key text,
  title text not null,
  module_code text,
  stage_code text,
  description text,
  acceptance_criteria_json jsonb not null default '[]'::jsonb,
  prompt_base text not null default '',
  relative_target_path text,
  initial_files_json jsonb not null default '[]'::jsonb,
  context_links_json jsonb not null default '[]'::jsonb,
  attachments_json jsonb not null default '[]'::jsonb,
  expected_branch text,
  status public.dev_task_status not null default 'todo',
  priority text not null default 'medium',
  assignee_user_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  payload jsonb
);

create unique index if not exists idx_dev_tasks_workspace_task_key
  on public.dev_tasks(workspace_id, task_key)
  where task_key is not null;

create table if not exists public.dev_task_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null references public.dev_tasks(id) on delete cascade,
  user_id uuid,
  source text not null default 'vscode-extension',
  status public.dev_run_status not null default 'in_progress',
  blocked_reason text,
  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  finished_at timestamptz,
  vscode_session_id text,
  extension_version text,
  workspace_profile_type public.dev_profile_type not null default 'desktop',
  workspace_root text,
  git_branch text,
  git_dirty boolean not null default false,
  summary text,
  notes text,
  changed_files_json jsonb not null default '[]'::jsonb,
  next_steps_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb
);

create unique index if not exists idx_dev_task_runs_active_by_user
  on public.dev_task_runs(task_id, user_id)
  where status in ('in_progress', 'blocked');

create table if not exists public.dev_developer_sessions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  user_id uuid,
  vscode_session_id text not null,
  extension_version text,
  os_platform text,
  os_release text,
  hostname text,
  profile_type public.dev_profile_type not null default 'desktop',
  active_task_run_id uuid references public.dev_task_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  payload jsonb,
  constraint dev_developer_sessions_workspace_session_unique unique (workspace_id, vscode_session_id)
);

create table if not exists public.dev_task_launches (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  task_id uuid not null references public.dev_tasks(id) on delete cascade,
  user_id uuid,
  launch_token text not null,
  status public.dev_launch_status not null default 'issued',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  consumed_by_session_id text,
  origin text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payload jsonb,
  constraint dev_task_launches_launch_token_unique unique (launch_token)
);

create index if not exists idx_dev_projects_workspace on public.dev_projects(workspace_id);
create index if not exists idx_dev_projects_active on public.dev_projects(workspace_id, active);

create index if not exists idx_dev_tasks_workspace on public.dev_tasks(workspace_id);
create index if not exists idx_dev_tasks_project on public.dev_tasks(project_id);
create index if not exists idx_dev_tasks_status on public.dev_tasks(status);
create index if not exists idx_dev_tasks_assignee on public.dev_tasks(assignee_user_id);
create index if not exists idx_dev_tasks_updated_at on public.dev_tasks(updated_at desc);

create index if not exists idx_dev_task_runs_workspace on public.dev_task_runs(workspace_id);
create index if not exists idx_dev_task_runs_task on public.dev_task_runs(task_id);
create index if not exists idx_dev_task_runs_status on public.dev_task_runs(status);
create index if not exists idx_dev_task_runs_session on public.dev_task_runs(vscode_session_id);
create index if not exists idx_dev_task_runs_last_activity on public.dev_task_runs(last_activity_at desc);

create index if not exists idx_dev_developer_sessions_workspace on public.dev_developer_sessions(workspace_id);
create index if not exists idx_dev_developer_sessions_user on public.dev_developer_sessions(user_id);
create index if not exists idx_dev_developer_sessions_last_seen on public.dev_developer_sessions(last_seen_at desc);

create index if not exists idx_dev_task_launches_workspace on public.dev_task_launches(workspace_id);
create index if not exists idx_dev_task_launches_task on public.dev_task_launches(task_id);
create index if not exists idx_dev_task_launches_status on public.dev_task_launches(status);
create index if not exists idx_dev_task_launches_expires on public.dev_task_launches(expires_at);

do $$
declare
  tbl text;
begin
  foreach tbl in array [
    'dev_projects',
    'dev_tasks',
    'dev_task_runs',
    'dev_developer_sessions',
    'dev_task_launches'
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
