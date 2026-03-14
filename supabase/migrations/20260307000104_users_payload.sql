-- Compatibilidade: garantir coluna payload na tabela public.users
alter table if exists public.users
  add column if not exists payload jsonb;

update public.users
set payload = '{}'::jsonb
where payload is null;
