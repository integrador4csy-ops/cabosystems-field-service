-- Personal task queues with explicit full-scope exceptions.
-- A direct assignment exposes only that task. Explicit villa/development/global
-- access exposes every task in that scope. Managers retain their scoped view.

alter table public.tareas
  add column prioridad text not null default 'media',
  add column prioridad_orden smallint generated always as (
    case prioridad when 'alta' then 1 when 'media' then 2 when 'baja' then 3 end
  ) stored,
  add constraint tareas_prioridad_check check (prioridad in ('alta','media','baja'));

create index tareas_assignee_priority_idx
  on public.tareas(asignado_a,prioridad_orden,fecha_programada,created_at,id);
create index tareas_priority_idx
  on public.tareas(prioridad_orden,fecha_programada,created_at,id);

-- Generated columns are not populated yet in BEFORE triggers. Exclude the rank
-- from field comparison while still protecting the user-editable priority.
create or replace function private.protect_task_fields() returns trigger
language plpgsql set search_path='' as $$
declare project_id uuid;
begin
  if auth.uid() is not null then
    if tg_table_name='tareas' then project_id := old.proyecto_id;
    else select t.proyecto_id into project_id from public.tareas t where t.id=old.tarea_id;
    end if;
    if not coalesce(private.task_editor(project_id),false) then
      if tg_table_name='tareas'
        and (to_jsonb(new)-'estatus'-'prioridad_orden') is distinct from (to_jsonb(old)-'estatus'-'prioridad_orden')
      then raise exception 'Solo administradores y supervisores pueden editar los datos de una tarea' using errcode='42501';
      end if;
      if tg_table_name='subtareas' and (to_jsonb(new)-'completada') is distinct from (to_jsonb(old)-'completada')
      then raise exception 'Solo puedes marcar las subtareas de tu villa' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end; $$;

-- Assignment grants the minimum project visibility needed to show villa data,
-- but it is deliberately not a full-task access grant.
create or replace function private.project_visible(project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.profiles u join public.proyectos p on p.id=project_id
    where u.id=auth.uid() and u.activo=true and (
      private.project_global() or p.integrador_id=u.id or p.tecnico_id=u.id
      or exists(select 1 from public.proyecto_participantes m where m.proyecto_id=p.id and m.usuario_id=u.id)
      or exists(select 1 from public.desarrollo_accesos a where a.desarrollo_id=p.desarrollo_id and a.usuario_id=u.id)
      or exists(select 1 from public.tareas t where t.proyecto_id=p.id and t.asignado_a=u.id)));
$$;

create function private.task_view_all(project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.profiles u join public.proyectos p on p.id=project_id
    where u.id=auth.uid() and u.activo=true and (
      u.rol='admin'
      or (u.rol='supervisor_instalacion' and private.project_visible(p.id))
      or exists(select 1 from public.proyecto_accesos_globales g where g.usuario_id=u.id)
      or exists(select 1 from public.desarrollo_accesos a where a.desarrollo_id=p.desarrollo_id and a.usuario_id=u.id)
      or p.integrador_id=u.id or p.tecnico_id=u.id
      or exists(select 1 from public.proyecto_participantes m where m.proyecto_id=p.id and m.usuario_id=u.id)));
$$;

create function private.task_visible(project_id uuid,assignee_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.profiles u where u.id=auth.uid() and u.activo=true
      and (assignee_id=u.id or private.task_view_all(project_id)));
$$;

create function private.task_progress_allowed(project_id uuid,assignee_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.task_visible(project_id,assignee_id);
$$;

revoke all on function private.task_view_all(uuid),private.task_visible(uuid,uuid),
  private.task_progress_allowed(uuid,uuid) from public,anon;
grant execute on function private.task_view_all(uuid),private.task_visible(uuid,uuid),
  private.task_progress_allowed(uuid,uuid) to authenticated;

-- Keep the legacy helper safe for the existing activity trigger. Row-level
-- update policies still decide which concrete task can be changed.
create or replace function private.task_progress_member(project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.task_view_all(project_id) or exists(
    select 1 from public.tareas t
    where t.proyecto_id=task_progress_member.project_id and t.asignado_a=auth.uid());
$$;

do $$ declare r record; begin
  for r in select tablename,policyname from pg_policies
    where schemaname='public' and tablename in ('tareas','subtareas')
  loop execute format('drop policy %I on public.%I',r.policyname,r.tablename); end loop;
end $$;

revoke all on public.tareas,public.subtareas from anon;
grant select,insert,update,delete on public.tareas,public.subtareas to authenticated;

create policy tareas_select on public.tareas for select to authenticated
  using(private.task_visible(proyecto_id,asignado_a));
create policy tareas_progress_update on public.tareas for update to authenticated
  using(private.task_progress_allowed(proyecto_id,asignado_a))
  with check(private.task_progress_allowed(proyecto_id,asignado_a));
create policy tareas_editor_insert on public.tareas for insert to authenticated
  with check(private.task_editor(proyecto_id));
create policy tareas_editor_update on public.tareas for update to authenticated
  using(private.task_editor(proyecto_id)) with check(private.task_editor(proyecto_id));
create policy tareas_editor_delete on public.tareas for delete to authenticated
  using(private.task_editor(proyecto_id));

create policy subtareas_select on public.subtareas for select to authenticated
  using(exists(select 1 from public.tareas t where t.id=tarea_id
    and private.task_visible(t.proyecto_id,t.asignado_a)));
create policy subtareas_progress_update on public.subtareas for update to authenticated
  using(exists(select 1 from public.tareas t where t.id=tarea_id
    and private.task_progress_allowed(t.proyecto_id,t.asignado_a)))
  with check(exists(select 1 from public.tareas t where t.id=tarea_id
    and private.task_progress_allowed(t.proyecto_id,t.asignado_a)));
create policy subtareas_editor_insert on public.subtareas for insert to authenticated
  with check(exists(select 1 from public.tareas t where t.id=tarea_id and private.task_editor(t.proyecto_id)));
create policy subtareas_editor_update on public.subtareas for update to authenticated
  using(exists(select 1 from public.tareas t where t.id=tarea_id and private.task_editor(t.proyecto_id)))
  with check(exists(select 1 from public.tareas t where t.id=tarea_id and private.task_editor(t.proyecto_id)));
create policy subtareas_editor_delete on public.subtareas for delete to authenticated
  using(exists(select 1 from public.tareas t where t.id=tarea_id and private.task_editor(t.proyecto_id)));

create or replace function public.get_task_permissions(p_task_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'user_id',auth.uid(),
    'can_view',private.task_visible(t.proyecto_id,t.asignado_a),
    'can_view_all',private.task_view_all(t.proyecto_id),
    'can_progress',private.task_progress_allowed(t.proyecto_id,t.asignado_a),
    'can_edit',private.task_editor(t.proyecto_id))
  from public.tareas t where t.id=p_task_id;
$$;
revoke all on function public.get_task_permissions(uuid) from public,anon;
grant execute on function public.get_task_permissions(uuid) to authenticated;

drop policy if exists task_activity_visible on public.task_activity;
create policy task_activity_visible on public.task_activity for select to authenticated
  using(private.task_view_all(proyecto_id) or exists(
    select 1 from public.tareas t where t.id=tarea_id
      and private.task_visible(t.proyecto_id,t.asignado_a)));
