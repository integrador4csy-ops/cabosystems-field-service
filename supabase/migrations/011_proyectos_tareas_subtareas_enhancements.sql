-- 011_proyectos_tareas_subtareas_enhancements.sql
-- Optimización y permisos de proyectos (desarrollos y villas), tareas y subtareas

-- 1. Añadir latitud y longitud opcionales a proyectos para geolocalización de villas
ALTER TABLE public.proyectos 
ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION;

-- 2. Asegurar que las políticas de RLS permitan gestión completa a usuarios autenticados / administradores
DROP POLICY IF EXISTS "Todos los usuarios ven proyectos" ON public.proyectos;
CREATE POLICY "Todos los usuarios ven proyectos"
ON public.proyectos FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Gestión de proyectos" ON public.proyectos;
CREATE POLICY "Gestión de proyectos"
ON public.proyectos FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Tareas
DROP POLICY IF EXISTS "Todos los usuarios ven tareas" ON public.tareas;
CREATE POLICY "Todos los usuarios ven tareas"
ON public.tareas FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Creación y gestión de tareas/WO" ON public.tareas;
DROP POLICY IF EXISTS "Técnico actualiza tareas asignadas" ON public.tareas;
DROP POLICY IF EXISTS "Gestión total de tareas para autenticados" ON public.tareas;
CREATE POLICY "Gestión total de tareas para autenticados"
ON public.tareas FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Subtareas
DROP POLICY IF EXISTS "Usuarios ven subtareas de tareas asignadas" ON public.subtareas;
DROP POLICY IF EXISTS "Usuarios ven subtareas" ON public.subtareas;
CREATE POLICY "Usuarios ven subtareas"
ON public.subtareas FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Admin y supervisor gestiona subtareas" ON public.subtareas;
DROP POLICY IF EXISTS "Técnico gestiona subtareas propias" ON public.subtareas;
DROP POLICY IF EXISTS "Gestión total de subtareas para autenticados" ON public.subtareas;
CREATE POLICY "Gestión total de subtareas para autenticados"
ON public.subtareas FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- 3. Habilitar Realtime para proyectos, tareas y subtareas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'proyectos'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.proyectos;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'tareas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tareas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'subtareas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.subtareas;
  END IF;
END $$;
