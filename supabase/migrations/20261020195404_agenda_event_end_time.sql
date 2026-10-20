alter table public.agenda_eventos add column hora_fin time without time zone;
-- Existing start-only records retain NULL instead of inventing a duration.
alter table public.agenda_eventos add constraint agenda_eventos_time_range_check
  check (hora_fin is null or (hora is not null and hora_fin > hora));
