-- Legacy definer RPCs must not bypass the authority boundary when auth.uid() is null.
create or replace function private.protect_profile_authority() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if (auth.uid() is not null or current_setting('role',true) in ('anon','authenticated')) and not private.project_admin() then
    if tg_op='DELETE' or (tg_op='UPDATE' and (new.rol is distinct from old.rol or new.activo is distinct from old.activo or new.id is distinct from old.id)) then
      raise exception 'Solo administradores pueden modificar permisos de usuarios' using errcode='42501';
    end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end; $$;
revoke all on function private.protect_profile_authority() from public,anon,authenticated;

do $$ declare r record; definition text; begin
  for r in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('actualizar_datos_usuario','expulsar_usuario','admin_editar_colaborador','admin_reactivar_colaborador','admin_expulsar_colaborador') loop
    if r.proname in ('actualizar_datos_usuario','expulsar_usuario') then
      definition := pg_get_functiondef(r.oid);
      definition := regexp_replace(definition,'BEGIN',E'BEGIN\n IF NOT private.project_admin() THEN RAISE EXCEPTION ''Solo administradores'' USING ERRCODE=''42501''; END IF;', 'i');
      execute definition;
    end if;
    execute format('alter function %s set search_path = %L',r.oid::regprocedure,'');
    execute format('revoke all on function %s from public,anon',r.oid::regprocedure);
    execute format('grant execute on function %s to authenticated',r.oid::regprocedure);
  end loop;
end $$;
