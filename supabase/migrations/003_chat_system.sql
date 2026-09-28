-- ==============================================================================
-- CABOSYSTEMS FIELD SERVICE - SISTEMA DE CHAT GRUPAL Y MULTIMEDIA
-- Migración: 003_chat_system.sql
-- ==============================================================================

-- 1. TABLA: chat_grupos
CREATE TABLE IF NOT EXISTS public.chat_grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  foto_url TEXT,
  creado_por UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  solo_multimedia BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA: chat_miembros
CREATE TABLE IF NOT EXISTS public.chat_miembros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.chat_grupos(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rol TEXT NOT NULL DEFAULT 'miembro' CHECK (rol IN ('admin', 'miembro')),
  unido_en TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (grupo_id, profile_id)
);

-- 3. TABLA: chat_mensajes
CREATE TABLE IF NOT EXISTS public.chat_mensajes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.chat_grupos(id) ON DELETE CASCADE,
  remitente_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('texto', 'imagen', 'video', 'sticker')),
  contenido TEXT,
  media_url TEXT,
  media_thumbnail_url TEXT,
  media_meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: chat_reacciones
CREATE TABLE IF NOT EXISTS public.chat_reacciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mensaje_id UUID NOT NULL REFERENCES public.chat_mensajes(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (mensaje_id, profile_id, emoji)
);

-- 5. TABLA: chat_stickers (Biblioteca de stickers del usuario importados de WhatsApp)
CREATE TABLE IF NOT EXISTS public.chat_stickers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre TEXT,
  url TEXT NOT NULL,
  pack_name TEXT DEFAULT 'Personal',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_chat_miembros_profile ON public.chat_miembros(profile_id);
CREATE INDEX IF NOT EXISTS idx_chat_miembros_grupo ON public.chat_miembros(grupo_id);
CREATE INDEX IF NOT EXISTS idx_chat_mensajes_grupo_created ON public.chat_mensajes(grupo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_reacciones_mensaje ON public.chat_reacciones(mensaje_id);
CREATE INDEX IF NOT EXISTS idx_chat_stickers_profile ON public.chat_stickers(profile_id);

-- ==============================================================================
-- -- ==============================================================================
-- FUNCIONES AUXILIARES DE CONTROL DE ACCESO
-- ==============================================================================
-- FUNCIONES AUXILIARES DE CONTROL DE ACCESO (PLPGSQL + SECURITY DEFINER)
-- Bypassean RLS internamente para eliminar cualquier recursión infinita (42P17)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_is_group_admin(p_grupo_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1. Si es admin global o supervisor
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id AND rol = ANY (ARRAY['admin'::text, 'supervisor_instalacion'::text])
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Si es el creador del grupo
  IF EXISTS (
    SELECT 1 FROM public.chat_grupos 
    WHERE id = p_grupo_id AND creado_por = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Si tiene rol 'admin' en chat_miembros
  IF EXISTS (
    SELECT 1 FROM public.chat_miembros 
    WHERE grupo_id = p_grupo_id AND profile_id = p_user_id AND rol = 'admin'
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_is_group_member(p_grupo_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- 1. Si es admin global o supervisor
  IF EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id AND rol = ANY (ARRAY['admin'::text, 'supervisor_instalacion'::text])
  ) THEN
    RETURN TRUE;
  END IF;

  -- 2. Si es el creador del grupo
  IF EXISTS (
    SELECT 1 FROM public.chat_grupos 
    WHERE id = p_grupo_id AND creado_por = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  -- 3. Si es miembro registrado (cualquier rol: instalador, aux, etc.)
  IF EXISTS (
    SELECT 1 FROM public.chat_miembros 
    WHERE grupo_id = p_grupo_id AND profile_id = p_user_id
  ) THEN
    RETURN TRUE;
  END IF;

  RETURN FALSE;
END;
$$;

-- Compatibilidad con llamadas previas
CREATE OR REPLACE FUNCTION public.is_chat_admin(gid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.check_is_group_admin(gid, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_chat_member(gid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT public.check_is_group_member(gid, auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.can_send_chat_message(gid UUID, sender_id UUID, msg_tipo TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_member BOOLEAN;
  v_solo_multi BOOLEAN;
BEGIN
  IF sender_id <> auth.uid() THEN
    RETURN FALSE;
  END IF;

  v_is_member := public.check_is_group_member(gid, auth.uid());
  IF NOT v_is_member THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(solo_multimedia, false) INTO v_solo_multi
  FROM public.chat_grupos WHERE id = gid;

  IF v_solo_multi = TRUE AND msg_tipo = 'texto' THEN
    v_is_admin := public.check_is_group_admin(gid, auth.uid());
    IF NOT v_is_admin THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- ==============================================================================
-- HABILITAR RLS EN TODAS LAS TABLAS DE CHAT
-- ==============================================================================
ALTER TABLE public.chat_grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_miembros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_mensajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_reacciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_stickers ENABLE ROW LEVEL SECURITY;

-- POLÍTICAS: chat_miembros (Políticas explícitas separadas para evitar bucle FOR ALL)
DROP POLICY IF EXISTS "Lectura de miembros del grupo" ON public.chat_miembros;
DROP POLICY IF EXISTS "Lectura de membresías" ON public.chat_miembros;
DROP POLICY IF EXISTS "Lectura general de miembros" ON public.chat_miembros;
CREATE POLICY "Lectura general de miembros" ON public.chat_miembros
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Gestión de miembros para admin del grupo" ON public.chat_miembros;
DROP POLICY IF EXISTS "Inserción de miembros para admin del grupo" ON public.chat_miembros;
DROP POLICY IF EXISTS "Actualización de miembros para admin del grupo" ON public.chat_miembros;
DROP POLICY IF EXISTS "Eliminación de miembros para admin del grupo" ON public.chat_miembros;

CREATE POLICY "Inserción de miembros para admin del grupo" ON public.chat_miembros
  FOR INSERT TO authenticated
  WITH CHECK (public.check_is_group_admin(grupo_id, auth.uid()));

CREATE POLICY "Actualización de miembros para admin del grupo" ON public.chat_miembros
  FOR UPDATE TO authenticated
  USING (public.check_is_group_admin(grupo_id, auth.uid()))
  WITH CHECK (public.check_is_group_admin(grupo_id, auth.uid()));

CREATE POLICY "Eliminación de miembros para admin del grupo" ON public.chat_miembros
  FOR DELETE TO authenticated
  USING (public.check_is_group_admin(grupo_id, auth.uid()));

-- POLÍTICAS: chat_grupos
DROP POLICY IF EXISTS "Lectura de grupos para miembros" ON public.chat_grupos;
CREATE POLICY "Lectura de grupos para miembros" ON public.chat_grupos
  FOR SELECT TO authenticated
  USING (
    creado_por = auth.uid()
    OR public.check_is_group_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Creación de grupos para admins y supervisores" ON public.chat_grupos;
CREATE POLICY "Creación de grupos para admins y supervisores" ON public.chat_grupos
  FOR INSERT TO authenticated
  WITH CHECK (
    public.get_my_role() = ANY (ARRAY['admin'::text, 'supervisor_instalacion'::text]) 
    OR creado_por = auth.uid()
  );

DROP POLICY IF EXISTS "Actualización de grupos para admin del grupo" ON public.chat_grupos;
CREATE POLICY "Actualización de grupos para admin del grupo" ON public.chat_grupos
  FOR UPDATE TO authenticated
  USING (public.check_is_group_admin(id, auth.uid()))
  WITH CHECK (public.check_is_group_admin(id, auth.uid()));

DROP POLICY IF EXISTS "Eliminación de grupos para admin del grupo" ON public.chat_grupos;
CREATE POLICY "Eliminación de grupos para admin del grupo" ON public.chat_grupos
  FOR DELETE TO authenticated
  USING (public.check_is_group_admin(id, auth.uid()));

-- POLÍTICAS: chat_mensajes
DROP POLICY IF EXISTS "Lectura de mensajes para miembros" ON public.chat_mensajes;
CREATE POLICY "Lectura de mensajes para miembros" ON public.chat_mensajes
  FOR SELECT TO authenticated
  USING (public.check_is_group_member(grupo_id, auth.uid()));

DROP POLICY IF EXISTS "Inserción de mensajes para miembros" ON public.chat_mensajes;
CREATE POLICY "Inserción de mensajes para miembros" ON public.chat_mensajes
  FOR INSERT TO authenticated
  WITH CHECK (public.can_send_chat_message(grupo_id, remitente_id, tipo));

DROP POLICY IF EXISTS "Eliminación de mensajes propios o por admin" ON public.chat_mensajes;
CREATE POLICY "Eliminación de mensajes propios o por admin" ON public.chat_mensajes
  FOR DELETE TO authenticated
  USING (remitente_id = auth.uid() OR public.check_is_group_admin(grupo_id, auth.uid()));

-- POLÍTICAS: chat_reacciones
DROP POLICY IF EXISTS "Lectura de reacciones" ON public.chat_reacciones;
CREATE POLICY "Lectura de reacciones" ON public.chat_reacciones
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Gestión de reacciones propias" ON public.chat_reacciones;
CREATE POLICY "Gestión de reacciones propias" ON public.chat_reacciones
  FOR ALL TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- POLÍTICAS: chat_stickers
DROP POLICY IF EXISTS "Gestión de stickers propios" ON public.chat_stickers;
DROP POLICY IF EXISTS "Lectura de stickers propios" ON public.chat_stickers;
DROP POLICY IF EXISTS "Inserción de stickers propios" ON public.chat_stickers;
DROP POLICY IF EXISTS "Actualización de stickers propios" ON public.chat_stickers;
DROP POLICY IF EXISTS "Eliminación de stickers propios" ON public.chat_stickers;

CREATE POLICY "Lectura de stickers propios" ON public.chat_stickers
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Inserción de stickers propios" ON public.chat_stickers
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Actualización de stickers propios" ON public.chat_stickers
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Eliminación de stickers propios" ON public.chat_stickers
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid());

-- ==============================================================================
-- STORAGE BUCKET: chat-media
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Lectura de chat-media para usuarios autenticados" ON storage.objects;
CREATE POLICY "Lectura de chat-media para usuarios autenticados" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Lectura pública de chat-media" ON storage.objects;
CREATE POLICY "Lectura pública de chat-media" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Subida a chat-media para usuarios autenticados" ON storage.objects;
CREATE POLICY "Subida a chat-media para usuarios autenticados" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

DROP POLICY IF EXISTS "Actualización de chat-media para usuarios autenticados" ON storage.objects;
CREATE POLICY "Actualización de chat-media para usuarios autenticados" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-media');

-- ==============================================================================
-- HABILITAR SUPABASE REALTIME
-- ==============================================================================
DO 
BEGIN
 BEGIN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_mensajes;
 EXCEPTION WHEN duplicate_object THEN
 -- Ya existe en publication
 END;

 BEGIN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reacciones;
 EXCEPTION WHEN duplicate_object THEN
 -- Ya existe en publication
 END;

 BEGIN
 ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_grupos;
 EXCEPTION WHEN duplicate_object THEN
 -- Ya existe en publication
 END;
END ;
