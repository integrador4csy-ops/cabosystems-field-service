-- CaboSystems Field Service - Schema Definitivo
-- Ejecutar en Supabase SQL Editor

-- 1. Tablas
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'aux_instalacion' CHECK (
    rol IN (
      'admin', 'supervisor_instalacion', 'instalador', 'aux_instalacion',
      'integrador', 'aux_integracion', 'infraestructura', 'aux_infraestructura',
      'servicios', 'aux_servicios', 'aux_operaciones'
    )
  ),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activo BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  desarrollo TEXT NOT NULL,
  unidad TEXT NOT NULL,
  descripcion TEXT,
  estatus TEXT NOT NULL DEFAULT 'activo' CHECK (estatus IN ('activo', 'pausado', 'finalizado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  asignado_a UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  estatus TEXT NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'en_proceso', 'completada')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subtareas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  completada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS registros_campo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tarea_id UUID NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
  tecnico_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('check_in', 'check_out')),
  latitud DOUBLE PRECISION NOT NULL,
  longitud DOUBLE PRECISION NOT NULL,
  foto_url TEXT NOT NULL,
  comentarios TEXT,
  fecha_hora TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tecnico_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  descripcion TEXT NOT NULL,
  prioridad TEXT NOT NULL DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta')),
  estatus TEXT NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente', 'en_proceso', 'resuelta')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Funciones
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT rol FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

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
    RETURN existing_profile;
  END IF;

  INSERT INTO profiles (id, nombre, rol, activo)
  VALUES (user_id, user_nombre, 'aux_instalacion', FALSE)
  RETURNING * INTO new_profile;

  RETURN new_profile;
END;
$$;

-- 3. RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE registros_campo ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtareas ENABLE ROW LEVEL SECURITY;
ALTER TABLE pendientes ENABLE ROW LEVEL SECURITY;

-- 4. Policies
CREATE POLICY "Lectura de perfiles para usuarios autenticados"
  ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Actualización de perfil propio"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Gestión total de perfiles para admin, supervisores y operaciones"
  ON profiles FOR ALL USING (get_my_role() IN ('admin', 'supervisor_instalacion', 'aux_operaciones'));

CREATE POLICY "Todos los usuarios ven proyectos"
  ON proyectos FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Gestión de proyectos"
  ON proyectos FOR ALL USING (get_my_role() IN ('admin', 'supervisor_instalacion', 'aux_operaciones'));

CREATE POLICY "Todos los usuarios ven tareas"
  ON tareas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Técnico actualiza tareas asignadas"
  ON tareas FOR UPDATE
  USING (auth.role() = 'authenticated' AND asignado_a = auth.uid());
CREATE POLICY "Creación y gestión de tareas/WO"
  ON tareas FOR ALL USING (get_my_role() IN (
    'admin', 'supervisor_instalacion', 'instalador', 'integrador',
    'infraestructura', 'servicios', 'aux_operaciones'
  ));

CREATE POLICY "Todos los usuarios ven registros de campo"
  ON registros_campo FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Inserción de registros propios"
  ON registros_campo FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND tecnico_id = auth.uid());

CREATE POLICY "Usuarios ven subtareas de tareas asignadas"
  ON subtareas FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Técnico gestiona subtareas propias"
  ON subtareas FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM tareas WHERE tareas.id = subtareas.tarea_id AND tareas.asignado_a = auth.uid()
    )
  );
CREATE POLICY "Admin y supervisor gestiona subtareas"
  ON subtareas FOR ALL
  USING (get_my_role() IN ('admin', 'supervisor_instalacion', 'aux_operaciones'));

CREATE POLICY "Usuarios ven pendientes"
  ON pendientes FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Técnico crea pendientes propios"
  ON pendientes FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND tecnico_id = auth.uid());
CREATE POLICY "Técnico actualiza pendientes propios"
  ON pendientes FOR UPDATE
  USING (tecnico_id = auth.uid());
CREATE POLICY "Admin y supervisor gestiona pendientes"
  ON pendientes FOR ALL
  USING (get_my_role() IN ('admin', 'supervisor_instalacion', 'aux_operaciones'));
