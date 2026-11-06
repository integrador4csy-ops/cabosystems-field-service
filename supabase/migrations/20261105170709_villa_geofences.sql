set local lock_timeout = '5s';

alter table public.proyectos
  add column if not exists radio_geocerca_m integer not null default 150;

alter table public.proyectos
  add constraint proyectos_latitud_valida
    check (latitud is null or latitud between -90 and 90) not valid,
  add constraint proyectos_longitud_valida
    check (longitud is null or longitud between -180 and 180) not valid,
  add constraint proyectos_coordenadas_completas
    check ((latitud is null) = (longitud is null)) not valid,
  add constraint proyectos_radio_geocerca_valido
    check (radio_geocerca_m between 25 and 5000) not valid;

comment on column public.proyectos.latitud is
  'Latitud WGS84 del centro de la geocerca de la villa.';
comment on column public.proyectos.longitud is
  'Longitud WGS84 del centro de la geocerca de la villa.';
comment on column public.proyectos.radio_geocerca_m is
  'Radio de la geocerca de la villa en metros; valor predeterminado 150.';
