-- 20261102230000_villa_participant_access_levels.sql
-- Niveles de acceso en villa: 'mis_tareas' (por defecto) vs 'todas_las_tareas' (acceso total de la villa).
-- Acceso global exclusivo para roles 'admin' y 'supervisor_instalacion'.

ALTER TABLE public.proyecto_participantes
  ADD COLUMN IF NOT EXISTS tipo_acceso text NOT NULL DEFAULT 'mis_tareas';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'proyecto_participantes_tipo_acceso_check'
  ) THEN
    ALTER TABLE public.proyecto_participantes
      ADD CONSTRAINT proyecto_participantes_tipo_acceso_check
      CHECK (tipo_acceso IN ('mis_tareas', 'todas_las_tareas'));
  END IF;
END $$;

-- 1. Restringir acceso global a proyectos exclusivamente a admin y supervisor_instalacion
CREATE OR REPLACE FUNCTION private.project_global()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.activo = true
      AND (p.rol = 'admin' OR p.rol = 'supervisor_instalacion')
  );
$$;

-- 2. Visibilidad completa de tareas en la villa (admin, supervisor, encargados o participantes con 'todas_las_tareas')
CREATE OR REPLACE FUNCTION private.task_view_all(project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles u
    JOIN public.proyectos p ON p.id = project_id
    WHERE u.id = auth.uid() AND u.activo = true AND (
      u.rol = 'admin'
      OR u.rol = 'supervisor_instalacion'
      OR p.integrador_id = u.id
      OR p.tecnico_id = u.id
      OR EXISTS (
        SELECT 1 FROM public.desarrollo_accesos a
        WHERE a.desarrollo_id = p.desarrollo_id AND a.usuario_id = u.id
      )
      OR EXISTS (
        SELECT 1 FROM public.proyecto_participantes m
        WHERE m.proyecto_id = p.id AND m.usuario_id = u.id AND m.tipo_acceso = 'todas_las_tareas'
      )
    )
  );
$$;

-- 3. Visibilidad de tarea: asignado directamente O con permiso de ver todas
CREATE OR REPLACE FUNCTION private.task_visible(project_id uuid, assignee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles u
    WHERE u.id = auth.uid() AND u.activo = true
      AND (assignee_id = u.id OR private.task_view_all(project_id))
  );
$$;

CREATE OR REPLACE FUNCTION private.task_visible(t public.tareas)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN private.task_visible(t.proyecto_id, t.asignado_a);
END;
$$;

-- 4. Actualizar save_project_team para soportar niveles de acceso
CREATE OR REPLACE FUNCTION public.save_project_team(
  p_project_id uuid,
  p_integrador_id uuid,
  p_tecnico_id uuid,
  p_participants uuid[],
  p_revision integer,
  p_all_tasks_participants uuid[] DEFAULT '{}'::uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NOT private.project_admin() THEN
    RAISE EXCEPTION 'Solo administradores pueden gestionar equipos' USING errcode = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(p_participants, '{}'::uuid[]) || array[p_integrador_id, p_tecnico_id]) u(id)
    WHERE u.id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE id = u.id AND activo = true
    )
  ) THEN
    RAISE EXCEPTION 'Selecciona colaboradores activos';
  END IF;

  UPDATE public.proyectos
  SET integrador_id = p_integrador_id,
      tecnico_id = p_tecnico_id,
      equipo_revision = equipo_revision + 1
  WHERE id = p_project_id AND equipo_revision = p_revision;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El equipo cambió. Recarga antes de guardar.' USING errcode = '40001';
  END IF;

  DELETE FROM public.proyecto_participantes WHERE proyecto_id = p_project_id;

  INSERT INTO public.proyecto_participantes(proyecto_id, usuario_id, tipo_acceso)
    SELECT p_project_id, id,
           CASE WHEN id = ANY(coalesce(p_all_tasks_participants, '{}'::uuid[]))
                THEN 'todas_las_tareas'
                ELSE 'mis_tareas'
           END
    FROM (SELECT DISTINCT unnest(coalesce(p_participants, '{}'::uuid[])) id) u
    WHERE id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.save_project_team(uuid, uuid, uuid, uuid[], integer, uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_project_team(uuid, uuid, uuid, uuid[], integer, uuid[]) TO authenticated;
