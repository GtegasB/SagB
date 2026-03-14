do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit)
    values ('cid-assets', 'cid-assets', false, 2147483648)
    on conflict (id) do update
      set file_size_limit = excluded.file_size_limit;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'objects'
  ) then
    execute 'drop policy if exists cid_storage_select on storage.objects';
    execute 'drop policy if exists cid_storage_insert on storage.objects';
    execute 'drop policy if exists cid_storage_update on storage.objects';
    execute 'drop policy if exists cid_storage_delete on storage.objects';

    execute $policy$
      create policy cid_storage_select on storage.objects
      for select to authenticated
      using (
        bucket_id = 'cid-assets'
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
      create policy cid_storage_insert on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'cid-assets'
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
      create policy cid_storage_update on storage.objects
      for update to authenticated
      using (
        bucket_id = 'cid-assets'
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
        bucket_id = 'cid-assets'
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
      create policy cid_storage_delete on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'cid-assets'
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
