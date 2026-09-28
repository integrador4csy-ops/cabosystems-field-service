-- Migración 009: Tabla para control de versiones y actualizaciones dentro de la App
CREATE TABLE IF NOT EXISTS public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL UNIQUE DEFAULT 'android',
  latest_version text NOT NULL DEFAULT '1.0.0',
  min_required_version text NOT NULL DEFAULT '1.0.0',
  apk_url text NOT NULL DEFAULT '',
  release_notes text DEFAULT '',
  force_update boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública (para que la app pueda consultar sin requerir login)
CREATE POLICY "Permitir lectura de versiones para todos"
  ON public.app_versions
  FOR SELECT
  USING (true);

-- Política de modificación para administradores
CREATE POLICY "Permitir a administradores actualizar versiones"
  ON public.app_versions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insertar registros iniciales por defecto para android e ios si no existen
INSERT INTO public.app_versions (platform, latest_version, min_required_version, apk_url, release_notes, force_update)
VALUES 
  ('android', '1.0.0', '1.0.0', '', 'Versión inicial estable de CSY Field Service.', false),
  ('ios', '1.0.0', '1.0.0', '', 'Versión inicial estable de CSY Field Service.', false)
ON CONFLICT (platform) DO NOTHING;
