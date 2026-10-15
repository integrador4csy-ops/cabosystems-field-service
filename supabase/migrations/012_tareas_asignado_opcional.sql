-- 012_tareas_asignado_opcional.sql
-- Permitir que las tareas puedan crearse o editarse sin técnico asignado (asignado_a NULL)
ALTER TABLE public.tareas ALTER COLUMN asignado_a DROP NOT NULL;
