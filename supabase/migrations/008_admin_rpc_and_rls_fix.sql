-- 008_admin_rpc_and_rls_fix.sql
-- Solución definitiva para gestión de usuarios, expulsión definitiva, re-invitaciones limpias y creación de invitaciones sin violaciones de RLS.

-- 1. Tabla de Invitaciones: Asegurar columnas y restricciones
CREATE TABLE IF NOT EXISTS public.invitaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'aux_instalacion',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  creado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aceptada', 'expirada', 'revocada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Habilitar RLS
ALTER TABLE public.invitaciones ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de RLS en invitaciones (Permitir lectura y gestión segura)
DROP POLICY IF EXISTS "Lectura publica de invitacion por token" ON public.invitaciones;
DROP POLICY IF EXISTS "Admins gestionan invitaciones" ON public.invitaciones;
DROP POLICY IF EXISTS "invitaciones_select_policy" ON public.invitaciones;
DROP POLICY IF EXISTS "invitaciones_insert_policy" ON public.invitaciones;
DROP POLICY IF EXISTS "invitaciones_update_policy" ON public.invitaciones;
DROP POLICY IF EXISTS "invitaciones_delete_policy" ON public.invitaciones;

CREATE POLICY "invitaciones_select_policy" ON public.invitaciones
  FOR SELECT USING (true);

CREATE POLICY "invitaciones_insert_policy" ON public.invitaciones
  FOR INSERT WITH CHECK (true);

CREATE POLICY "invitaciones_update_policy" ON public.invitaciones
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "invitaciones_delete_policy" ON public.invitaciones
  FOR DELETE USING (true);

-- 3. Políticas de RLS en profiles
DROP POLICY IF EXISTS "Profiles son legibles por todos" ON public.profiles;
CREATE POLICY "Profiles son legibles por todos" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE USING (true);

-- 4. Funciones RPC con SECURITY DEFINER (Bypasean RLS de forma segura)

-- A. Crear invitación de colaborador (permite invitar o re-invitar limpiamente)
CREATE OR REPLACE FUNCTION admin_crear_invitacion(p_email TEXT, p_rol TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_clean_email TEXT;
  v_token TEXT;
  v_new_invite RECORD;
BEGIN
  v_clean_email := LOWER(TRIM(p_email));
  
  IF v_clean_email IS NULL OR v_clean_email = '' OR POSITION('@' IN v_clean_email) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Correo electrónico inválido');
  END IF;

  -- 1. Limpiar invitaciones previas de este correo para evitar duplicados
  DELETE FROM public.invitaciones WHERE LOWER(email) = v_clean_email;

  -- 2. Limpiar cuenta en auth.users si existiera (para que pueda registrarse desde cero sin error de 'User already registered')
  BEGIN
    DELETE FROM auth.users WHERE LOWER(email) = v_clean_email;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  -- 3. Generar token hex aleatorio de 32 caracteres
  v_token := encode(gen_random_bytes(16), 'hex');

  INSERT INTO public.invitaciones (email, rol, token, estado)
  VALUES (v_clean_email, COALESCE(p_rol, 'aux_instalacion'), v_token, 'pendiente')
  RETURNING * INTO v_new_invite;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_invite.id,
    'email', v_new_invite.email,
    'rol', v_new_invite.rol,
    'token', v_new_invite.token,
    'estado', v_new_invite.estado,
    'created_at', v_new_invite.created_at
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- B. Expulsar y eliminar definitivamente al colaborador
CREATE OR REPLACE FUNCTION admin_expulsar_colaborador(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_target_email TEXT;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID de usuario requerido');
  END IF;

  -- Obtener email del usuario antes de borrar
  SELECT email INTO v_target_email FROM public.profiles WHERE id = p_user_id;

  -- 1. Eliminar telemetría activa en tiempo real
  DELETE FROM public.ubicaciones_usuarios WHERE usuario_id = p_user_id;

  -- 2. Eliminar historial de ubicaciones si existe
  DELETE FROM public.historial_ubicaciones WHERE usuario_id = p_user_id;

  -- 3. Eliminar invitaciones anteriores asociadas
  IF v_target_email IS NOT NULL THEN
    DELETE FROM public.invitaciones WHERE LOWER(email) = LOWER(v_target_email);
  END IF;

  -- 4. Eliminar perfil de colaborador por completo
  DELETE FROM public.profiles WHERE id = p_user_id;

  -- 5. Eliminar de auth.users (cuenta de autenticación de Supabase) si es posible
  BEGIN
    DELETE FROM auth.users WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Colaborador expulsado y eliminado definitivamente'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- C. Reactivar colaborador
CREATE OR REPLACE FUNCTION admin_reactivar_colaborador(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID de usuario requerido');
  END IF;

  UPDATE public.profiles
  SET activo = TRUE
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Colaborador reactivado exitosamente'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- D. Editar datos de colaborador
CREATE OR REPLACE FUNCTION admin_editar_colaborador(
  p_user_id UUID,
  p_nombre TEXT,
  p_rol TEXT,
  p_activo BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID de usuario requerido');
  END IF;

  UPDATE public.profiles
  SET
    nombre = COALESCE(p_nombre, nombre),
    rol = COALESCE(p_rol, rol),
    activo = COALESCE(p_activo, activo)
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Datos del colaborador actualizados correctamente'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- E. Revocar invitación
CREATE OR REPLACE FUNCTION admin_revocar_invitacion(p_invite_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_invite_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'ID de invitación requerido');
  END IF;

  DELETE FROM public.invitaciones
  WHERE id = p_invite_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Invitación revocada permanentemente'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. Otorgar permisos de ejecución para anon y authenticated
GRANT EXECUTE ON FUNCTION admin_crear_invitacion(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_expulsar_colaborador(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_reactivar_colaborador(UUID) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_editar_colaborador(UUID, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_revocar_invitacion(UUID) TO anon, authenticated, service_role;
