-- Existing entries remain one-off. Repetition is stored as a rule, not duplicate rows.
alter table public.agenda_eventos
  add column repeticion text not null default 'ninguna',
  add column intervalo integer not null default 1,
  add column dias_semana integer[] not null default '{}',
  add column repetir_hasta date,
  add constraint agenda_recurrence_valid check (
    repeticion in ('ninguna', 'diaria', 'semanal', 'mensual')
    and intervalo between 1 and 365
    and (repetir_hasta is null or repetir_hasta between fecha and date '9999-12-31')
    and (tipo = 'recordatorio' or repeticion = 'ninguna')
    and (repeticion <> 'ninguna' or (intervalo = 1 and cardinality(dias_semana) = 0 and repetir_hasta is null))
    and (
      (repeticion = 'semanal' and cardinality(dias_semana) between 1 and 7
        and array_ndims(dias_semana) = 1
        and dias_semana <@ array[1,2,3,4,5,6,7]
        and array_position(dias_semana, null) is null)
      or (repeticion <> 'semanal' and cardinality(dias_semana) = 0)
    )
  );

create index agenda_eventos_recurring_idx on public.agenda_eventos(fecha, repetir_hasta)
  where repeticion <> 'ninguna';
