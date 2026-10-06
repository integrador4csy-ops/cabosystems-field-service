-- 010_chat_push_notifications.sql
-- Almacén de Tokens Push de Expo y Notificaciones de Chat en Segundo Plano

-- 1. Tabla para registrar los tokens de notificación por dispositivo y usuario
CREATE TABLE IF NOT EXISTS public.user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_user_expo_push_token UNIQUE (user_id, expo_push_token)
);

-- Índices de búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_user ON public.user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_push_tokens_token ON public.user_push_tokens(expo_push_token);

-- 2. Habilitar Seguridad a Nivel de Fila (RLS)
ALTER TABLE public.user_push_tokens ENABLE ROW LEVEL SECURITY;

-- Política de lectura: Cada usuario puede ver sus tokens registrados
DROP POLICY IF EXISTS "Usuarios ven sus propios tokens" ON public.user_push_tokens;
CREATE POLICY "Usuarios ven sus propios tokens"
  ON public.user_push_tokens FOR SELECT
  USING (auth.uid() = user_id);

-- Política de inserción y actualización: Cada usuario gestiona su token
DROP POLICY IF EXISTS "Usuarios insertan o actualizan sus tokens" ON public.user_push_tokens;
CREATE POLICY "Usuarios insertan o actualizan sus tokens"
  ON public.user_push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Función RPC auxiliar para obtener los tokens de los miembros de un grupo (excluyendo al remitente)
CREATE OR REPLACE FUNCTION get_chat_group_push_tokens(p_grupo_id UUID, p_remitente_id UUID)
RETURNS TABLE (
  expo_push_token TEXT,
  user_id UUID,
  nombre TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.expo_push_token,
    p.id AS user_id,
    p.nombre
  FROM public.chat_miembros m
  JOIN public.user_push_tokens t ON t.user_id = m.profile_id
  JOIN public.profiles p ON p.id = m.profile_id
  WHERE m.grupo_id = p_grupo_id
    AND m.profile_id <> p_remitente_id
    AND p.activo = TRUE;
END;
$$;
