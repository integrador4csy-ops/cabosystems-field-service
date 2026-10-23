-- Recurrence applies to company events; preserve all existing rules and dates.
alter table public.agenda_eventos drop constraint agenda_recurrence_valid;
alter table public.agenda_eventos
  add constraint agenda_recurrence_valid check (
    repeticion in ('ninguna', 'diaria', 'semanal', 'mensual')
    and intervalo between 1 and 365
    and (repetir_hasta is null or repetir_hasta between fecha and date '9999-12-31')
    and (repeticion <> 'ninguna' or (intervalo = 1 and cardinality(dias_semana) = 0 and repetir_hasta is null))
    and (
      (repeticion = 'semanal' and cardinality(dias_semana) between 1 and 7
        and array_ndims(dias_semana) = 1
        and dias_semana <@ array[1,2,3,4,5,6,7]
        and array_position(dias_semana, null) is null)
      or (repeticion <> 'semanal' and cardinality(dias_semana) = 0)
    )
  );
update public.agenda_eventos set tipo = 'evento' where tipo = 'recordatorio';
