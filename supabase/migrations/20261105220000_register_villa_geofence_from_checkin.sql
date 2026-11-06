set local lock_timeout = '5s';

create or replace function public.register_missing_villa_geofence(
  p_field_record_id uuid,
  p_project_id uuid,
  p_latitude double precision,
  p_longitude double precision,
  p_radius_meters integer default 150
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_authorized boolean;
  v_updated_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_latitude is null or p_latitude not between -90 and 90
    or p_longitude is null or p_longitude not between -180 and 180
    or p_radius_meters is null or p_radius_meters not between 25 and 5000 then
    raise exception 'Invalid geofence values' using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.registros_campo as r
    join public.tareas as t on t.id = r.tarea_id
    join public.profiles as profile on profile.id = r.tecnico_id
    where r.id = p_field_record_id
      and r.tecnico_id = (select auth.uid())
      and r.tipo = 'check_in'
      and t.proyecto_id = p_project_id
      and profile.activo = true
  ) into v_authorized;

  if not v_authorized then
    raise exception 'Only the technician who created this check-in can register this villa location'
      using errcode = '42501';
  end if;

  update public.proyectos
  set latitud = p_latitude,
      longitud = p_longitude,
      radio_geocerca_m = p_radius_meters
  where id = p_project_id
    and latitud is null
    and longitud is null
  returning id into v_updated_id;

  return v_updated_id is not null;
end;
$$;

comment on function public.register_missing_villa_geofence(uuid, uuid, double precision, double precision, integer) is
  'Registers the first geofence for a villa from its technician-owned check-in. Existing locations are never overwritten.';

revoke all on function public.register_missing_villa_geofence(uuid, uuid, double precision, double precision, integer) from public;
revoke all on function public.register_missing_villa_geofence(uuid, uuid, double precision, double precision, integer) from anon;
grant execute on function public.register_missing_villa_geofence(uuid, uuid, double precision, double precision, integer) to authenticated;
