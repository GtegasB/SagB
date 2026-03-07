-- Persistencia de conversas no Supabase

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

create index if not exists idx_chat_sessions_workspace on public.chat_sessions(workspace_id);
create index if not exists idx_chat_sessions_agent on public.chat_sessions(agent_id);
create index if not exists idx_chat_sessions_owner on public.chat_sessions(owner_user_id);
create index if not exists idx_chat_sessions_last_message on public.chat_sessions(last_message_at desc);
create index if not exists idx_chat_messages_workspace on public.chat_messages(workspace_id);
create index if not exists idx_chat_messages_session on public.chat_messages(session_id, created_at);
create index if not exists idx_chat_messages_agent on public.chat_messages(agent_id);
