alter table public.proyectos
  drop constraint proyectos_estatus_check;

alter table public.proyectos
  add constraint proyectos_estatus_check
  check (estatus in ('activo', 'pausado', 'en_conciliacion', 'finalizado'));
