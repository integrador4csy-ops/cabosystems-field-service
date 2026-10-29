-- Append-only progress history. The actor and calendar date come from the
-- authenticated database request, never from mutable task assignment/client input.
create table public.task_activity (
  id bigint generated always as identity primary key,
  fecha date not null,
  actor_id uuid not null,
  actor_name text not null,
  proyecto_id uuid not null,
  desarrollo text not null,
  villa text not null,
  tarea_id uuid not null,
  tarea_titulo text not null,
  subtarea_id uuid,
  subtarea_titulo text,
  accion text not null check (accion in ('estado','subtarea')),
  anterior text,
  siguiente text not null,
  estado_registrado text not null,
  encargado_nombre text,
  check ((accion='estado' and subtarea_id is null) or (accion='subtarea' and subtarea_id is not null))
);
create index task_activity_date_id_idx on public.task_activity(fecha,id);
create index task_activity_actor_date_idx on public.task_activity(actor_id,fecha,id);
create index task_activity_project_date_idx on public.task_activity(proyecto_id,fecha,id);
alter table public.task_activity enable row level security;
revoke all on public.task_activity from public,anon,authenticated;
grant select on public.task_activity to authenticated;
create policy task_activity_visible on public.task_activity for select to authenticated
  using (private.project_visible(proyecto_id));

-- A private definer trigger is needed to append history while clients have only
-- SELECT. Task/subtask permissions are still enforced on the original mutation.
create function private.record_task_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  task_row public.tareas%rowtype;
  project_row public.proyectos%rowtype;
  person_name text;
  assigned_name text;
  before_value text;
  after_value text;
  sub_id uuid;
  sub_title text;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name='tareas' then
    if tg_op='UPDATE' then
      if old.estatus is not distinct from new.estatus then return new; end if;
      before_value := old.estatus;
    elsif new.estatus='pendiente' then return new;
    end if;
    task_row := new; after_value := new.estatus;
  else
    if tg_op='UPDATE' then
      if old.completada is not distinct from new.completada then return new; end if;
      before_value := old.completada::text;
    elsif not new.completada then return new;
    end if;
    select * into strict task_row from public.tareas where id=new.tarea_id;
    after_value := new.completada::text; sub_id := new.id; sub_title := new.titulo;
  end if;
  if not coalesce(private.task_progress_member(task_row.proyecto_id),false) then
    raise exception 'No tienes permiso para registrar avances en esta villa' using errcode='42501';
  end if;
  select nombre into strict person_name from public.profiles where id=auth.uid() and activo=true;
  select * into strict project_row from public.proyectos where id=task_row.proyecto_id;
  select nombre into assigned_name from public.profiles where id=task_row.asignado_a;
  insert into public.task_activity(fecha,actor_id,actor_name,proyecto_id,desarrollo,villa,tarea_id,tarea_titulo,
    subtarea_id,subtarea_titulo,accion,anterior,siguiente,estado_registrado,encargado_nombre)
  values ((statement_timestamp() at time zone 'America/Mazatlan')::date,auth.uid(),person_name,
    task_row.proyecto_id,project_row.desarrollo,project_row.villa,task_row.id,task_row.titulo,sub_id,sub_title,
    case when tg_table_name='tareas' then 'estado' else 'subtarea' end,before_value,after_value,task_row.estatus,assigned_name);
  return new;
end;
$$;
revoke all on function private.record_task_activity() from public,anon,authenticated;
create trigger record_task_activity after insert or update on public.tareas
  for each row execute function private.record_task_activity();
create trigger record_subtask_activity after insert or update on public.subtareas
  for each row execute function private.record_task_activity();

create function public.get_task_activity_report(p_from date,p_to date,p_actor uuid default null,
  p_project uuid default null,p_after bigint default 0,p_until bigint default null,p_limit integer default 500)
returns table(id bigint,fecha date,actor_id uuid,actor_name text,proyecto_id uuid,desarrollo text,villa text,
  tarea_id uuid,tarea_titulo text,subtarea_id uuid,subtarea_titulo text,accion text,anterior text,siguiente text,
  estado_registrado text,encargado_nombre text,estado_actual text,hasta_id bigint)
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_from is null or p_to is null or p_from>p_to or p_limit is null or p_limit<1 or p_limit>1000
    or p_after is null or p_after<0 then raise exception 'Parametros de informe no validos' using errcode='22023'; end if;
  return query select a.id,a.fecha,a.actor_id,a.actor_name,a.proyecto_id,a.desarrollo,a.villa,
    a.tarea_id,a.tarea_titulo,a.subtarea_id,a.subtarea_titulo,a.accion,a.anterior,a.siguiente,
    a.estado_registrado,a.encargado_nombre,t.estatus,max(a.id) over()
  from public.task_activity a left join public.tareas t on t.id=a.tarea_id and t.proyecto_id=a.proyecto_id
  where a.fecha between p_from and p_to and (p_actor is null or a.actor_id=p_actor)
    and (p_project is null or a.proyecto_id=p_project) and a.id>p_after and (p_until is null or a.id<=p_until)
  order by a.id limit p_limit;
end; $$;
revoke all on function public.get_task_activity_report(date,date,uuid,uuid,bigint,bigint,integer) from public,anon;
grant execute on function public.get_task_activity_report(date,date,uuid,uuid,bigint,bigint,integer) to authenticated;

create function public.get_task_activity_people() returns table(id uuid,nombre text)
language sql stable security invoker set search_path='' as $$
  select distinct on (a.actor_id) a.actor_id,a.actor_name from public.task_activity a order by a.actor_id,a.id desc;
$$;
revoke all on function public.get_task_activity_people() from public,anon;
grant execute on function public.get_task_activity_people() to authenticated;
