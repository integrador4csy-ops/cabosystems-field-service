-- 005_realtime_locations.sql
-- Sistema de telemetría y ubicación en tiempo real tipo Life360 para CaboSystems

-- 1. Añadir avatar_url a la tabla de perfiles para almacenar la foto oficial de Google
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Tabla de ubicaciones en vivo
CREATE TABLE IF NOT EXISTS public.ubicaciones_usuarios (
  usuario_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL,
  precision DOUBLE PRECISION,
  velocidad DOUBLE PRECISION, -- en km/h
  rumbo DOUBLE PRECISION,     -- orientación en grados (0-360)
  bateria INTEGER,            -- nivel de batería (0-100)
  esta_cargando BOOLEAN DEFAULT FALSE,
  en_linea BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Histórico de ubicaciones (para análisis de trayectorias)
CREATE TABLE IF NOT EXISTS public.historial_ubicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL,
  precision DOUBLE PRECISION,
  velocidad DOUBLE PRECISION,
  bateria INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_ubicaciones_updated_at ON public.ubicaciones_usuarios(updated_at);
CREATE INDEX IF NOT EXISTS idx_historial_usuario_id_created ON public.historial_ubicaciones(usuario_id, created_at DESC);

-- 4. Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.ubicaciones_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_ubicaciones ENABLE ROW LEVEL SECURITY;

-- Lectura abierta para que el Dashboard Web pueda consultar las ubicaciones de todos los técnicos
DROP POLICY IF EXISTS "Lectura publica de ubicaciones para dashboard" ON public.ubicaciones_usuarios;
CREATE POLICY "Lectura publica de ubicaciones para dashboard"
ON public.ubicaciones_usuarios
FOR SELECT
USING (true);

-- Escritura permitida al propio técnico autenticado
DROP POLICY IF EXISTS "Tecnicos pueden actualizar su ubicacion" ON public.ubicaciones_usuarios;
CREATE POLICY "Tecnicos pueden actualizar su ubicacion"
ON public.ubicaciones_usuarios
FOR ALL
USING (auth.uid() = usuario_id)
WITH CHECK (auth.uid() = usuario_id);

-- Historial: lectura abierta y escritura para el técnico
DROP POLICY IF EXISTS "Lectura de historial para dashboard" ON public.historial_ubicaciones;
CREATE POLICY "Lectura de historial para dashboard"
ON public.historial_ubicaciones
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Tecnicos pueden registrar historial" ON public.historial_ubicaciones;
CREATE POLICY "Tecnicos pueden registrar historial"
ON public.historial_ubicaciones
FOR INSERT
WITH CHECK (auth.uid() = usuario_id);

-- 5. Habilitar publicación Realtime en la tabla de ubicaciones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'ubicaciones_usuarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ubicaciones_usuarios;
  END IF;
END $$;
