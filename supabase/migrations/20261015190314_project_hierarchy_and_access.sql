-- Hierarchy and access are separate from occupational roles. No wildcard memberships.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table public.desarrollos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) between 1 and 120),
  created_at timestamptz not null default now()
);
create unique index desarrollos_nombre_unique on public.desarrollos (lower(btrim(nombre)));
insert into public.desarrollos(nombre) select distinct btrim(desarrollo) from public.proyectos;
alter table public.proyectos
  add column desarrollo_id uuid references public.desarrollos(id) on delete restrict,
  add column integrador_id uuid references public.profiles(id) on delete set null,
  add column tecnico_id uuid references public.profiles(id) on delete set null,
  add column equipo_revision integer not null default 0;
update public.proyectos p set desarrollo_id=d.id from public.desarrollos d where btrim(p.desarrollo)=d.nombre;
alter table public.proyectos alter column desarrollo_id set not null;
create index proyectos_desarrollo_id_idx on public.proyectos(desarrollo_id);
create index proyectos_integrador_id_idx on public.proyectos(integrador_id);
create index proyectos_tecnico_id_idx on public.proyectos(tecnico_id);

create table public.proyecto_participantes (
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(proyecto_id,usuario_id)
);
create index proyecto_participantes_usuario_idx on public.proyecto_participantes(usuario_id,proyecto_id);
create table public.desarrollo_accesos (
  desarrollo_id uuid not null references public.desarrollos(id) on delete cascade,
  usuario_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(desarrollo_id,usuario_id)
);
create index desarrollo_accesos_usuario_idx on public.desarrollo_accesos(usuario_id,desarrollo_id);
create table public.proyecto_accesos_globales (
  usuario_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
-- Existing task assignments are explicit access, not grants to everyone.
insert into public.proyecto_participantes(proyecto_id,usuario_id)
select distinct proyecto_id,asignado_a from public.tareas where asignado_a is not null on conflict do nothing;

create function private.project_admin() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles where id=auth.uid() and activo=true and rol='admin');
$$;
create function private.project_global() returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.profiles p where p.id=auth.uid() and p.activo=true
    and (p.rol='admin' or exists(select 1 from public.proyecto_accesos_globales g where g.usuario_id=p.id)));
$$;
create function private.project_visible(project_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.profiles u join public.proyectos p on p.id=project_id
    where u.id=auth.uid() and u.activo=true and (
      private.project_global() or p.integrador_id=u.id or p.tecnico_id=u.id
      or exists(select 1 from public.proyecto_participantes m where m.proyecto_id=p.id and m.usuario_id=u.id)
      or exists(select 1 from public.desarrollo_accesos a where a.desarrollo_id=p.desarrollo_id and a.usuario_id=u.id)));
$$;
create function private.development_visible(development_id uuid) returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (private.project_global()
    or exists(select 1 from public.desarrollo_accesos a join public.profiles u on u.id=a.usuario_id where a.desarrollo_id=development_id and u.id=auth.uid() and u.activo=true)
    or exists(select 1 from public.proyectos p where p.desarrollo_id=development_id and private.project_visible(p.id)));
$$;
revoke all on function private.project_admin(),private.project_global(),private.project_visible(uuid),private.development_visible(uuid) from public,anon;
grant execute on function private.project_admin(),private.project_global(),private.project_visible(uuid),private.development_visible(uuid) to authenticated;

-- Preserve the text field for existing mobile/web clients; IDs are canonical.
create function private.sync_project_development() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.desarrollo_id is null or (tg_op='UPDATE' and new.desarrollo is distinct from old.desarrollo and new.desarrollo_id=old.desarrollo_id) then
    if not private.project_admin() and auth.uid() is not null then raise exception 'Solo administradores pueden cambiar desarrollos' using errcode='42501'; end if;
    insert into public.desarrollos(nombre) values(btrim(new.desarrollo)) on conflict(lower(btrim(nombre))) do nothing;
    select id into new.desarrollo_id from public.desarrollos where lower(btrim(nombre))=lower(btrim(new.desarrollo));
  end if;
  select nombre into strict new.desarrollo from public.desarrollos where id=new.desarrollo_id;
  return new;
end; $$;
create trigger proyectos_sync_desarrollo before insert or update on public.proyectos for each row execute function private.sync_project_development();
-- Development renames cannot leave legacy labels stale.
create function private.sync_development_name() returns trigger language plpgsql security definer set search_path='' as $$
begin update public.proyectos set desarrollo=new.nombre where desarrollo_id=new.id; return new; end; $$;
create trigger desarrollos_sync_nombre after update of nombre on public.desarrollos for each row execute function private.sync_development_name();
revoke all on function private.sync_project_development(),private.sync_development_name() from public,anon,authenticated;

alter table public.desarrollos enable row level security;
alter table public.proyecto_participantes enable row level security;
alter table public.desarrollo_accesos enable row level security;
alter table public.proyecto_accesos_globales enable row level security;
revoke all on public.desarrollos,public.proyecto_participantes,public.desarrollo_accesos,public.proyecto_accesos_globales from anon,authenticated;
grant select,insert,update,delete on public.desarrollos,public.proyecto_participantes,public.desarrollo_accesos,public.proyecto_accesos_globales to authenticated;
create policy desarrollos_read on public.desarrollos for select to authenticated using(private.development_visible(id));
create policy desarrollos_admin on public.desarrollos for all to authenticated using((select private.project_admin())) with check((select private.project_admin()));
create policy participantes_read on public.proyecto_participantes for select to authenticated using(private.project_visible(proyecto_id));
create policy participantes_admin on public.proyecto_participantes for all to authenticated using((select private.project_admin())) with check((select private.project_admin()));
create policy desarrollo_accesos_read on public.desarrollo_accesos for select to authenticated using(usuario_id=(select auth.uid()));
create policy desarrollo_accesos_admin on public.desarrollo_accesos for all to authenticated using((select private.project_admin())) with check((select private.project_admin()));
create policy globales_read on public.proyecto_accesos_globales for select to authenticated using(usuario_id=(select auth.uid()));
create policy globales_admin on public.proyecto_accesos_globales for all to authenticated using((select private.project_admin())) with check((select private.project_admin()));

-- Replace permissive legacy policies (policies combine with OR).
do $$ declare r record; begin
  for r in select tablename,policyname from pg_policies where schemaname='public' and tablename in ('proyectos','tareas','subtareas','pendientes','registros_campo') loop
    execute format('drop policy %I on public.%I',r.policyname,r.tablename);
  end loop;
end $$;
create policy proyectos_read on public.proyectos for select to authenticated using(private.project_visible(id));
create policy proyectos_admin on public.proyectos for all to authenticated using((select private.project_admin())) with check((select private.project_admin()));
create policy tareas_read on public.tareas for select to authenticated using(private.project_visible(proyecto_id));
create policy tareas_admin on public.tareas for all to authenticated using((select private.project_admin())) with check((select private.project_admin()));
create policy tareas_assignee_update on public.tareas for update to authenticated
  using(asignado_a=(select auth.uid()) and private.project_visible(proyecto_id)) with check(asignado_a=(select auth.uid()) and private.project_visible(proyecto_id));
create policy subtareas_read on public.subtareas for select to authenticated using(exists(select 1 from public.tareas t where t.id=tarea_id));
create policy subtareas_admin on public.subtareas for all to authenticated using((select private.project_admin())) with check((select private.project_admin()));
create policy subtareas_assignee_update on public.subtareas for update to authenticated
  using(exists(select 1 from public.tareas t where t.id=tarea_id and t.asignado_a=(select auth.uid())))
  with check(exists(select 1 from public.tareas t where t.id=tarea_id and t.asignado_a=(select auth.uid())));
create policy pendientes_read on public.pendientes for select to authenticated using(private.project_visible(proyecto_id));
create policy pendientes_admin on public.pendientes for all to authenticated using((select private.project_admin())) with check((select private.project_admin()));
create policy pendientes_insert on public.pendientes for insert to authenticated with check(tecnico_id=(select auth.uid()) and private.project_visible(proyecto_id));
create policy pendientes_update on public.pendientes for update to authenticated using(tecnico_id=(select auth.uid()) and private.project_visible(proyecto_id)) with check(tecnico_id=(select auth.uid()) and private.project_visible(proyecto_id));
create policy registros_read on public.registros_campo for select to authenticated using(exists(select 1 from public.tareas t where t.id=tarea_id));
create policy registros_insert on public.registros_campo for insert to authenticated with check(tecnico_id=(select auth.uid()) and exists(select 1 from public.tareas t where t.id=tarea_id and t.asignado_a=(select auth.uid())));

-- Assignees can report progress, never move tasks to another project/user.
create function private.protect_task_fields() returns trigger language plpgsql set search_path='' as $$
begin
  if auth.uid() is not null and not private.project_admin() then
    if tg_table_name='tareas' and (to_jsonb(new)-'estatus') is distinct from (to_jsonb(old)-'estatus') then raise exception 'Solo puedes actualizar el estado de tu tarea' using errcode='42501'; end if;
    if tg_table_name='subtareas' and (to_jsonb(new)-'completada') is distinct from (to_jsonb(old)-'completada') then raise exception 'Solo puedes completar el checklist' using errcode='42501'; end if;
  end if;
  return new;
end; $$;
create trigger tareas_protect_fields before update on public.tareas for each row execute function private.protect_task_fields();
create trigger subtareas_protect_fields before update on public.subtareas for each row execute function private.protect_task_fields();
revoke all on function private.protect_task_fields() from public,anon,authenticated;

-- A task assignment made by an admin is an explicit villa assignment too.
create function private.task_project_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.asignado_a is not null then insert into public.proyecto_participantes(proyecto_id,usuario_id) values(new.proyecto_id,new.asignado_a) on conflict do nothing; end if;
  return new;
end; $$;
create trigger tareas_project_member after insert or update of asignado_a,proyecto_id on public.tareas for each row execute function private.task_project_member();
revoke all on function private.task_project_member() from public,anon,authenticated;

-- Atomic team update, RLS invoker and optimistic concurrency against stale drawers.
create function public.save_project_team(p_project_id uuid,p_integrador_id uuid,p_tecnico_id uuid,p_participants uuid[],p_revision integer)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not private.project_admin() then raise exception 'Solo administradores pueden gestionar equipos' using errcode='42501'; end if;
  if exists(select 1 from unnest(coalesce(p_participants,'{}'::uuid[]) || array[p_integrador_id,p_tecnico_id]) u(id) where u.id is not null and not exists(select 1 from public.profiles where id=u.id and activo=true)) then raise exception 'Selecciona colaboradores activos'; end if;
  update public.proyectos set integrador_id=p_integrador_id,tecnico_id=p_tecnico_id,equipo_revision=equipo_revision+1 where id=p_project_id and equipo_revision=p_revision;
  if not found then raise exception 'El equipo cambió. Recarga antes de guardar.' using errcode='40001'; end if;
  delete from public.proyecto_participantes where proyecto_id=p_project_id;
  insert into public.proyecto_participantes(proyecto_id,usuario_id)
    select p_project_id,id from (select distinct unnest(coalesce(p_participants,'{}'::uuid[])) id) u where id is not null;
end; $$;
revoke all on function public.save_project_team(uuid,uuid,uuid,uuid[],integer) from public,anon;
grant execute on function public.save_project_team(uuid,uuid,uuid,uuid[],integer) to authenticated;

-- Prevent changing one's own role (or using old definer RPCs to bypass project RLS).
create function private.protect_profile_authority() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is not null and not private.project_admin() then
    if tg_op='DELETE' or (tg_op='UPDATE' and (new.rol is distinct from old.rol or new.activo is distinct from old.activo or new.id is distinct from old.id)) then raise exception 'Solo administradores pueden modificar permisos de usuarios' using errcode='42501'; end if;
  end if;
  if tg_op='DELETE' then return old; end if; return new;
end; $$;
create trigger profiles_protect_authority before update or delete on public.profiles for each row execute function private.protect_profile_authority();
revoke all on function private.protect_profile_authority() from public,anon,authenticated;
do $$ declare r record; v_definition text; begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_editar_colaborador','admin_reactivar_colaborador','admin_expulsar_colaborador') loop
    v_definition := pg_get_functiondef(r.oid);
    v_definition := regexp_replace(v_definition,'BEGIN',E'BEGIN\n IF NOT private.project_admin() THEN RAISE EXCEPTION ''Solo administradores'' USING ERRCODE=''42501''; END IF;', 'i');
    execute v_definition;
    execute format('revoke all on function %s from public,anon',r.oid::regprocedure);
    execute format('grant execute on function %s to authenticated',r.oid::regprocedure);
  end loop;
end $$;
