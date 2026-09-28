-- 007_invitaciones_y_gestion_usuarios.sql
-- Sistema de Invitaciones por Correo, Registro de Usuarios con Foto y Control de Administrador

-- 1. Tabla de Invitaciones
CREATE TABLE IF NOT EXISTS public.invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'aux_instalacion' CHECK (
    rol IN (
      'admin', 'supervisor_instalacion', 'instalador', 'aux_instalacion',
      'integrador', 'aux_integracion', 'infraestructura', 'aux_infraestructura',
      'servicios', 'aux_servicios', 'aux_operaciones'
    )
  ),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  creado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'expirada', 'revocada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_invitaciones_email ON public.invitaciones(email);
CREATE INDEX IF NOT EXISTS idx_invitaciones_token ON public.invitaciones(token);
CREATE INDEX IF NOT EXISTS idx_invitaciones_estado ON public.invitaciones(estado);

-- 2. Habilitar RLS en invitaciones
ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer invitaciones públicas por token para el flujo de registro
DROP POLICY IF EXISTS "Lectura publica de invitacion por token" ON public.invitaciones;
CREATE POLICY "Lectura publica de invitacion por token"
ON public.invitaciones
FOR SELECT
USING (true);

-- Política: Administradores pueden gestionar (insert, update, delete) invitaciones
DROP POLICY IF EXISTS "Admins gestionan invitaciones" ON public.invitaciones;
CREATE POLICY "Admins gestionan invitaciones"
ON public.invitaciones
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol IN ('admin', 'supervisor_instalacion', 'aux_operaciones')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol IN ('admin', 'supervisor_instalacion', 'aux_operaciones')
  )
);

-- 3. Funciones RPC para gestión de usuarios
-- Expulsar / Desactivar usuario
CREATE OR REPLACE FUNCTION expulsar_usuario(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Validar que quien ejecuta sea administrador
  SELECT rol INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin', 'supervisor_instalacion', 'aux_operaciones') THEN
    RAISE EXCEPTION 'No tienes permisos de administrador para realizar esta acción';
  END IF;

  -- Desactivar perfil
  UPDATE public.profiles
  SET activo = FALSE
  WHERE id = target_user_id;

  -- Eliminar de la lista de telemetría activa en tiempo real
  DELETE FROM public.ubicaciones_usuarios
  WHERE usuario_id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuario desactivado y expulsado exitosamente');
END;
$$;

-- Actualizar datos de usuario (nombre, rol, activo)
CREATE OR REPLACE FUNCTION actualizar_datos_usuario(
  target_user_id UUID,
  nuevo_nombre TEXT,
  nuevo_rol TEXT,
  nuevo_activo BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
BEGIN
  -- Validar permisos de administrador
  SELECT rol INTO caller_role FROM public.profiles WHERE id = auth.uid();
  IF caller_role NOT IN ('admin', 'supervisor_instalacion', 'aux_operaciones') THEN
    RAISE EXCEPTION 'No tienes permisos de administrador para actualizar usuarios';
  END IF;

  UPDATE public.profiles
  SET
    nombre = COALESCE(nuevo_nombre, nombre),
    rol = COALESCE(nuevo_rol, rol),
    activo = COALESCE(nuevo_activo, activo)
  WHERE id = target_user_id;

  RETURN jsonb_build_object('success', true, 'message', 'Usuario actualizado correctamente');
END;
$$;

-- 4. Bucket de Almacenamiento para Avatares
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Políticas de storage para avatars
DROP POLICY IF EXISTS "Avatares son publicos" ON storage.objects;
CREATE POLICY "Avatares son publicos"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Usuarios autenticados pueden subir avatares" ON storage.objects;
CREATE POLICY "Usuarios autenticados pueden subir avatares"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Usuarios pueden actualizar su avatar" ON storage.objects;
CREATE POLICY "Usuarios pueden actualizar su avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars');
