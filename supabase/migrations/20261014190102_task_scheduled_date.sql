-- Optional calendar day shared by Tasks and Agenda. Existing tasks remain unscheduled.
ALTER TABLE public.tareas ADD COLUMN IF NOT EXISTS fecha_programada DATE;
COMMENT ON COLUMN public.tareas.fecha_programada IS 'Optional scheduled calendar day, without time or timezone.';
