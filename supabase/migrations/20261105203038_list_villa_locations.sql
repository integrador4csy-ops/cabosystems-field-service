create or replace function private.list_villa_locations_for_current_user()
returns table (
  id uuid,
  desarrollo text,
  villa text,
  latitud double precision,
  longitud double precision,
  radio_geocerca_m integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    project.id,
    project.desarrollo,
    coalesce(project.villa, ''),
    project.latitud,
    project.longitud,
    coalesce(project.radio_geocerca_m, 150)
  from public.proyectos as project
  where project.estatus = 'activo'
    and project.latitud between -90 and 90
    and project.longitud between -180 and 180
    and exists (
      select 1
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.activo = true
    )
  order by project.desarrollo, project.villa, project.id;
$$;

create or replace function public.list_villa_locations()
returns table (
  id uuid,
  desarrollo text,
  villa text,
  latitud double precision,
  longitud double precision,
  radio_geocerca_m integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.list_villa_locations_for_current_user();
$$;

revoke execute on function private.list_villa_locations_for_current_user() from public, anon;
revoke execute on function public.list_villa_locations() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.list_villa_locations_for_current_user() to authenticated;
grant execute on function public.list_villa_locations() to authenticated;
