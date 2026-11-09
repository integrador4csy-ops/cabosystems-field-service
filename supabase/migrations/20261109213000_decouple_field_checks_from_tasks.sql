set local lock_timeout = '5s';

alter table public.registros_campo add column if not exists proyecto_id uuid;

update public.registros_campo as record
set proyecto_id = task.proyecto_id
from public.tareas as task
where task.id = record.tarea_id and record.proyecto_id is null;

alter table public.registros_campo
  alter column proyecto_id set not null,
  alter column tarea_id drop not null;

alter table public.registros_campo
  drop constraint if exists registros_campo_tarea_id_fkey;
alter table public.registros_campo
  add constraint registros_campo_tarea_id_fkey foreign key (tarea_id) references public.tareas(id) on delete set null,
  add constraint registros_campo_proyecto_id_fkey foreign key (proyecto_id) references public.proyectos(id) on delete cascade;

create index if not exists registros_campo_proyecto_fecha_idx on public.registros_campo(proyecto_id, fecha_hora desc);
create index if not exists registros_campo_tecnico_fecha_idx on public.registros_campo(tecnico_id, fecha_hora desc);

drop policy if exists registros_read on public.registros_campo;
drop policy if exists registros_insert on public.registros_campo;
create policy registros_read on public.registros_campo for select to authenticated
  using (tecnico_id = (select auth.uid()) or (select private.project_admin()));
create policy registros_insert on public.registros_campo for insert to authenticated
  with check (tecnico_id = (select auth.uid()) and private.project_visible(proyecto_id));

create or replace function public.list_admin_check_history(p_day date default current_date, p_user_id uuid default null)
returns table (
  id uuid, technician_id uuid, technician_name text, technician_avatar_url text,
  check_type text, checked_at timestamptz, local_day date, latitude double precision,
  longitude double precision, photo_url text, comments text, task_id uuid,
  project_id uuid, villa text, development text
)
language plpgsql security definer set search_path = '' stable
as $$
declare v_role text;
begin
  select profile.rol into v_role from public.profiles as profile
  where profile.id = (select auth.uid()) and profile.activo = true;
  if v_role is null or v_role not in ('admin', 'supervisor_instalacion', 'aux_operaciones') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;
  return query
  select record.id, record.tecnico_id, profile.nombre, profile.avatar_url, record.tipo,
    record.fecha_hora, timezone('America/Chihuahua', record.fecha_hora)::date,
    record.latitud, record.longitud, record.foto_url, record.comentarios, record.tarea_id,
    project.id, project.villa, development.nombre
  from public.registros_campo as record
  join public.profiles as profile on profile.id = record.tecnico_id
  join public.proyectos as project on project.id = record.proyecto_id
  join public.desarrollos as development on development.id = project.desarrollo_id
  where timezone('America/Chihuahua', record.fecha_hora)::date = p_day
    and (p_user_id is null or record.tecnico_id = p_user_id)
  order by profile.nombre asc, record.fecha_hora desc, record.id desc;
end;
$$;

create or replace function public.register_missing_villa_geofence(
  p_field_record_id uuid, p_project_id uuid, p_latitude double precision,
  p_longitude double precision, p_radius_meters integer default 150
)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_authorized boolean; v_updated_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180
    or p_radius_meters is null or p_radius_meters not between 25 and 5000 then
    raise exception 'Invalid geofence values' using errcode = '22023';
  end if;
  select exists (
    select 1 from public.registros_campo as record
    join public.profiles as profile on profile.id = record.tecnico_id
    where record.id = p_field_record_id and record.tecnico_id = (select auth.uid())
      and record.tipo = 'check_in' and record.proyecto_id = p_project_id and profile.activo = true
  ) into v_authorized;
  if not v_authorized then
    raise exception 'Only the technician who created this check-in can register this villa location' using errcode = '42501';
  end if;
  update public.proyectos set latitud = p_latitude, longitud = p_longitude, radio_geocerca_m = p_radius_meters
  where id = p_project_id and latitud is null and longitud is null returning id into v_updated_id;
  return v_updated_id is not null;
end;
$$;

comment on column public.registros_campo.proyecto_id is
  'Villa where the technician checked in or out. Field checks do not require a task.';
