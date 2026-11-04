-- 20261103170000_profile_birthday.sql
-- Añadir fecha de nacimiento (cumpleaños) al perfil de colaboradores

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
