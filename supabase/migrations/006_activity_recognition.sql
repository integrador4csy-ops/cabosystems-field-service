-- 006_activity_recognition.sql
-- Añade soporte para Activity Recognition (Acelerómetro + Podómetro + GPS)

-- 1. Añadir columna 'actividad' en ubicaciones_usuarios
ALTER TABLE public.ubicaciones_usuarios 
ADD COLUMN IF NOT EXISTS actividad TEXT DEFAULT 'detenido';

-- 2. Añadir columna 'actividad' en historial_ubicaciones
ALTER TABLE public.historial_ubicaciones 
ADD COLUMN IF NOT EXISTS actividad TEXT DEFAULT 'detenido';

-- Comentario explicativo
COMMENT ON COLUMN public.ubicaciones_usuarios.actividad IS 'Actividad física detectada por acelerómetro, podómetro y GPS: detenido, caminando, conduciendo';
