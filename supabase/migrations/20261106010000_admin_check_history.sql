set local lock_timeout = '5s';

create table if not exists public.push_event_deliveries (
  event_key text primary key,
  created_at timestamptz not null default now()
);

alter table public.push_event_deliveries enable row level security;
revoke all on table public.push_event_deliveries from public, anon, authenticated;
grant all on table public.push_event_deliveries to service_role;

comment on table public.push_event_deliveries is
  'Server-only idempotency ledger for operational push notifications.';

create or replace function public.list_admin_check_history(
  p_day date default current_date,
  p_user_id uuid default null
)
returns table (
  id uuid,
  technician_id uuid,
  technician_name text,
  technician_avatar_url text,
  check_type text,
  checked_at timestamptz,
  local_day date,
  latitude double precision,
  longitude double precision,
  photo_url text,
  comments text,
  task_id uuid,
  project_id uuid,
  villa text,
  development text
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_role text;
begin
  select profile.rol
    into v_role
  from public.profiles as profile
  where profile.id = (select auth.uid())
    and profile.activo = true;

  if v_role is null or v_role not in ('admin', 'supervisor_instalacion', 'aux_operaciones') then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  return query
  select
    record.id,
    record.tecnico_id,
    profile.nombre,
    profile.avatar_url,
    record.tipo,
    record.fecha_hora,
    timezone('America/Chihuahua', record.fecha_hora)::date,
    record.latitud,
    record.longitud,
    record.foto_url,
    record.comentarios,
    task.id,
    project.id,
    project.villa,
    development.nombre
  from public.registros_campo as record
  join public.profiles as profile on profile.id = record.tecnico_id
  join public.tareas as task on task.id = record.tarea_id
  join public.proyectos as project on project.id = task.proyecto_id
  join public.desarrollos as development on development.id = project.desarrollo_id
  where timezone('America/Chihuahua', record.fecha_hora)::date = p_day
    and (p_user_id is null or record.tecnico_id = p_user_id)
  order by profile.nombre asc, record.fecha_hora desc, record.id desc;
end;
$$;

revoke all on function public.list_admin_check_history(date, uuid) from public, anon;
grant execute on function public.list_admin_check_history(date, uuid) to authenticated;

comment on function public.list_admin_check_history(date, uuid) is
  'Returns one local day of check-in/out evidence to active administrative roles.';
