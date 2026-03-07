-- HOTFIX: desbloquear INSERT/UPDATE/DELETE em public.agents para usuários autenticados
-- Motivo: erro "new row violates row-level security policy for table 'agents'" (HTTP 403)
-- Observação: política permissiva temporária para estabilizar operação.

do $$
declare
  pol record;
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'agents'
  ) then
    raise notice 'Tabela public.agents não encontrada. Hotfix ignorado.';
    return;
  end if;

  execute 'alter table public.agents enable row level security';
  execute 'grant select, insert, update, delete on table public.agents to authenticated';

  -- Remove policies antigas que possam estar bloqueando o fluxo atual.
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'agents'
  loop
    execute format('drop policy %I on public.agents', pol.policyname);
  end loop;

  execute 'create policy agents_select_authenticated on public.agents
           for select to authenticated
           using (true)';

  execute 'create policy agents_insert_authenticated on public.agents
           for insert to authenticated
           with check (true)';

  execute 'create policy agents_update_authenticated on public.agents
           for update to authenticated
           using (true)
           with check (true)';

  execute 'create policy agents_delete_authenticated on public.agents
           for delete to authenticated
           using (true)';
end $$;
