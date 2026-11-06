alter table public.proyectos
  add column numero_proyecto text,
  add column cliente text;

alter table public.proyectos
  add constraint proyectos_numero_proyecto_length
    check (numero_proyecto is null or length(btrim(numero_proyecto)) between 1 and 120),
  add constraint proyectos_cliente_length
    check (cliente is null or length(btrim(cliente)) between 1 and 200);

comment on column public.proyectos.numero_proyecto is 'Internal or customer-facing project number.';
comment on column public.proyectos.cliente is 'Client associated with the villa or project.';
