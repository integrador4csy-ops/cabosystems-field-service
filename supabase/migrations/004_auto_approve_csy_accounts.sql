-- 004_auto_approve_csy_accounts.sql
-- Eliminación del requisito de aprobación manual por admin para personal con cuentas CSY.
-- Todas las cuentas creadas e iniciadas con Google (@csy.mx o que contengan "csy") quedan activas de inmediato.

-- 1. Actualizar la función de creación de perfil para asignar activo = TRUE por defecto
CREATE OR REPLACE FUNCTION create_profile_if_not_exists(
  user_id UUID,
  user_nombre TEXT
)
RETURNS profiles
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_profile profiles;
  new_profile profiles;
BEGIN
  SELECT * INTO existing_profile FROM profiles WHERE id = user_id;
  IF existing_profile IS NOT NULL THEN
    IF existing_profile.activo = FALSE THEN
      UPDATE profiles SET activo = TRUE WHERE id = user_id RETURNING * INTO existing_profile;
    END IF;
    RETURN existing_profile;
  END IF;

  INSERT INTO profiles (id, nombre, rol, activo)
  VALUES (user_id, user_nombre, 'aux_instalacion', TRUE)
  RETURNING * INTO new_profile;

  RETURN new_profile;
END;
$$;

-- 2. Activar inmediatamente todos los perfiles de la base de datos
UPDATE public.profiles
SET activo = TRUE
WHERE activo = FALSE;

-- 3. Trigger opcional para garantizar que cualquier inserción en profiles nazca como activa
CREATE OR REPLACE FUNCTION set_profile_active_default()
RETURNS TRIGGER AS $$
BEGIN
  NEW.activo := TRUE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_activate_profile ON public.profiles;
CREATE TRIGGER trigger_auto_activate_profile
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION set_profile_active_default();
