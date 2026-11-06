import { supabase } from './supabase';
import type { Proyecto, Tarea, Subtarea } from '../types/projects';
import type { Profile } from '../types/fleet';
import { prepareTaskEvidence } from './taskProgress';

export interface TaskProgressActivity {
  id: number;
  request_id: string;
  actor_name: string;
  tarea_id: string;
  subtarea_id: string | null;
  subtarea_titulo: string | null;
  accion: 'estado' | 'subtarea';
  anterior: string | null;
  siguiente: string;
  comentario: string | null;
  evidencia_path: string | null;
  captured_at: string;
  accepted_at: string;
  evidence_url?: string | null;
}

export interface RecordTaskProgressInput {
  requestId: string;
  taskId: string;
  projectId: string;
  actorId: string;
  taskStatus?: Tarea['estatus'];
  subtaskId?: string;
  subtaskCompleted?: boolean;
  comment?: string;
  photo?: File | null;
  capturedAt?: string;
}

/**
 * Obtener todos los proyectos (villas y desarrollos)
 */
export async function getProjects(): Promise<Proyecto[]> {
  const { data, error } = await supabase
    .from('proyectos')
    .select('*')
    .order('desarrollo', { ascending: true })
    .order('villa', { ascending: true });

  if (error) {
    console.error('Error fetching projects:', error);
    throw error;
  }

  // Normalizar en caso de que existan columnas 'unidad' o 'villa'
  return (data || []).map((p: any) => ({
    id: p.id,
    desarrollo: p.desarrollo || 'Sin Desarrollo',
    villa: p.villa || p.unidad || 'Sin Villa',
    numero_proyecto: p.numero_proyecto ?? null,
    cliente: p.cliente ?? null,
    descripcion: p.descripcion,
    estatus: p.estatus || 'activo',
    latitud: p.latitud ?? null,
    longitud: p.longitud ?? null,
    radio_geocerca_m: p.radio_geocerca_m ?? 150,
    created_at: p.created_at,
  }));
}

/**
 * Crear un nuevo proyecto / villa bajo un desarrollo
 */
export async function createProject(payload: {
  desarrollo: string;
  villa: string;
  descripcion?: string;
  estatus?: 'activo' | 'pausado' | 'en_conciliacion' | 'finalizado';
  latitud?: number | null;
  longitud?: number | null;
  radio_geocerca_m?: number | null;
}): Promise<Proyecto> {
  const insertPayload: any = {
    desarrollo: payload.desarrollo.trim(),
    villa: payload.villa.trim(),
    descripcion: payload.descripcion?.trim() || null,
    estatus: payload.estatus || 'activo',
  };

  if (payload.latitud !== undefined && payload.latitud !== null) {
    insertPayload.latitud = payload.latitud;
  }
  if (payload.longitud !== undefined && payload.longitud !== null) {
    insertPayload.longitud = payload.longitud;
  }
  if (payload.radio_geocerca_m !== undefined && payload.radio_geocerca_m !== null) {
    insertPayload.radio_geocerca_m = payload.radio_geocerca_m;
  }

  const { data, error } = await supabase
    .from('proyectos')
    .insert([insertPayload])
    .select('*')
    .single();

  if (error) {
    console.error('Error creating project:', error);
    throw error;
  }

  return {
    ...data,
    villa: data.villa || data.unidad,
  };
}

/**
 * Actualizar una villa/proyecto
 */
export async function updateProject(
  id: string,
  payload: Partial<Omit<Proyecto, 'id' | 'created_at'>>
): Promise<Proyecto> {
  const { data, error } = await supabase
    .from('proyectos')
    .update(payload)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating project:', error);
    throw error;
  }

  return {
    ...data,
    villa: data.villa || data.unidad,
  };
}

/**
 * Eliminar una villa/proyecto y sus tareas asociadas
 */
export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('proyectos').delete().eq('id', id);
  if (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
}

/**
 * Obtener tareas de una villa/proyecto con perfiles asignados y subtareas
 */
export async function getTasksByProject(projectId?: string): Promise<Tarea[]> {
  let query = supabase
    .from('tareas')
    .select(`
      id,
      proyecto_id,
      asignado_a,
      titulo,
      descripcion,
      estatus,
      prioridad,
      prioridad_orden,
      fecha_programada,
      orden_plantilla,
      created_at,
      profiles:asignado_a (
        id,
        nombre,
        avatar_url,
        rol
      ),
      subtareas (
        id,
        tarea_id,
        titulo,
        completada,
        orden_plantilla,
        created_at
      )
    `);
  if (projectId) query = query.eq('proyecto_id', projectId);
  query = query.order('orden_plantilla', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false }).order('id');
  const allRows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw error;
    allRows.push(...(data || []));
    if (!data || data.length < 500) break;
  }

  return allRows.map((t: any) => ({
    id: t.id,
    proyecto_id: t.proyecto_id,
    asignado_a: t.asignado_a,
    titulo: t.titulo,
    descripcion: t.descripcion,
    estatus: t.estatus,
    prioridad: t.prioridad,
    prioridad_orden: t.prioridad_orden,
    fecha_programada: t.fecha_programada ?? null,
    orden_plantilla: t.orden_plantilla ?? null,
    created_at: t.created_at,
    profiles: t.profiles,
    subtareas: (t.subtareas || []).sort(
      (a: Subtarea, b: Subtarea) =>
        (a.orden_plantilla ?? Number.MAX_SAFE_INTEGER) - (b.orden_plantilla ?? Number.MAX_SAFE_INTEGER) || new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    ),
  }));
}

/**
 * Crear una nueva tarea
 */
export async function createTask(payload: {
  proyecto_id: string;
  asignado_a?: string | null;
  titulo: string;
  descripcion?: string;
  estatus?: 'pendiente' | 'en_proceso' | 'completada';
  prioridad?: 'baja' | 'media' | 'alta';
  fecha_programada?: string | null;
}): Promise<Tarea> {
  const { data, error } = await supabase
    .from('tareas')
    .insert([
      {
        proyecto_id: payload.proyecto_id,
        asignado_a: payload.asignado_a || null,
        titulo: payload.titulo.trim(),
        descripcion: payload.descripcion?.trim() || null,
        estatus: payload.estatus || 'pendiente',
        prioridad: payload.prioridad || 'media',
        fecha_programada: payload.fecha_programada || null,
      },
    ])
    .select(`
      *,
      profiles:asignado_a (
        id,
        nombre,
        avatar_url,
        rol
      )
    `)
    .single();

  if (error) {
    console.error('Error creating task:', error);
    throw error;
  }

  if (data.asignado_a) {
    void supabase.functions.invoke('operations-push-notifications', {
      body: { kind: 'task_assigned', entityId: data.id, eventKey: `task-created:${data.id}:${data.asignado_a}` },
    }).catch((notificationError) => console.warn('Task assignment notification failed:', notificationError));
  }

  return {
    ...data,
    subtareas: [],
  };
}

/**
 * Actualizar estatus o datos de una tarea
 */
export async function updateTask(
  id: string,
  payload: Partial<Omit<Tarea, 'id' | 'created_at' | 'profiles' | 'subtareas'>>
): Promise<Tarea> {
  const previousAssignee = payload.asignado_a !== undefined
    ? await supabase.from('tareas').select('asignado_a').eq('id', id).single()
    : null;
  const { data, error } = await supabase
    .from('tareas')
    .update(payload)
    .eq('id', id)
    .select(`
      *,
      profiles:asignado_a (
        id,
        nombre,
        avatar_url,
        rol
      )
    `)
    .single();

  if (error) {
    console.error('Error updating task:', error);
    throw error;
  }

  if (payload.asignado_a && previousAssignee?.data?.asignado_a !== data.asignado_a) {
    void supabase.functions.invoke('operations-push-notifications', {
      body: { kind: 'task_assigned', entityId: data.id, eventKey: `task-assigned:${data.id}:${data.asignado_a}:${Date.now()}` },
    }).catch((notificationError) => console.warn('Task assignment notification failed:', notificationError));
  }

  return data;
}

/**
 * Eliminar una tarea
 */
export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tareas').delete().eq('id', id);
  if (error) {
    console.error('Error deleting task:', error);
    throw error;
  }
}

/**
 * Crear una nueva subtarea
 */
export async function createSubtask(payload: {
  tarea_id: string;
  titulo: string;
}): Promise<Subtarea> {
  const { data, error } = await supabase
    .from('subtareas')
    .insert([
      {
        tarea_id: payload.tarea_id,
        titulo: payload.titulo.trim(),
        completada: false,
      },
    ])
    .select('*')
    .single();

  if (error) {
    console.error('Error creating subtask:', error);
    throw error;
  }

  return data;
}

/**
 * Alternar estatus completado de una subtarea
 */
export async function toggleSubtask(id: string, completada: boolean): Promise<Subtarea> {
  const { data, error } = await supabase
    .from('subtareas')
    .update({ completada })
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    console.error('Error updating subtask:', error);
    throw error;
  }

  return data;
}

async function uploadTaskEvidence(input: RecordTaskProgressInput): Promise<string | null> {
  if (!input.photo) return null;
  const path = `${input.projectId}/${input.taskId}/${input.actorId}/${input.requestId}.jpg`;
  const body = await prepareTaskEvidence(input.photo);
  const bucket = supabase.storage.from('task-evidence');
  const { error } = await bucket.upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) {
    const duplicate = String((error as { statusCode?: string }).statusCode) === '409' || /already exists|duplicate/i.test(error.message);
    if (!duplicate) throw error;
    const existing = await bucket.info(path);
    if (existing.error) throw existing.error;
  }
  return path;
}

async function dispatchTaskActivityNotifications(activity: TaskProgressActivity, projectId: string, actorId: string) {
  try {
    const { data: groups } = await supabase
      .from('chat_grupos')
      .select('id, nombre')
      .eq('proyecto_id', projectId);

    if (!groups || groups.length === 0) return;

    for (const group of groups) {
      const content =
        activity.accion === 'subtarea'
          ? (activity.siguiente === 'true'
              ? `${activity.actor_name} completó la subtarea «${activity.subtarea_titulo || 'Subtarea'}»`
              : `${activity.actor_name} reabrió la subtarea «${activity.subtarea_titulo || 'Subtarea'}»`)
          : `${activity.actor_name} cambió el estado a ${
              activity.siguiente === 'en_proceso'
                ? 'En Proceso'
                : activity.siguiente === 'completada'
                ? 'Completada'
                : 'Pendiente'
            }`;

      supabase.functions
        .invoke('chat-push-notifications', {
          body: {
            record: {
              grupo_id: group.id,
              remitente_id: actorId,
              tipo: 'sistema',
              contenido: content,
              task_id: activity.tarea_id,
              subtask_id: activity.subtarea_id,
            },
          },
        })
        .catch((err) => {
          console.warn('Push notification dispatch error for task progress:', err);
        });
    }
  } catch (err) {
    console.warn('Could not dispatch task progress notifications:', err);
  }
}

/** Upload first, then atomically commit task state and activity with one stable request ID. */
export async function recordTaskProgress(input: RecordTaskProgressInput): Promise<TaskProgressActivity> {
  const evidencePath = await uploadTaskEvidence(input);
  const { data, error } = await supabase.rpc('record_task_progress', {
    p_request_id: input.requestId,
    p_task_id: input.taskId,
    p_task_status: input.taskStatus ?? null,
    p_subtask_id: input.subtaskId ?? null,
    p_subtask_completed: input.subtaskCompleted ?? null,
    p_comment: input.comment?.trim() || null,
    p_evidence_path: evidencePath,
    p_captured_at: input.capturedAt ?? new Date().toISOString(),
  });
  if (error) {
    if (evidencePath) {
      const cleanup = await supabase.storage.from('task-evidence').remove([evidencePath]);
      if (cleanup.error) console.warn('Could not remove unreferenced task evidence:', cleanup.error);
    }
    throw error;
  }
  const activity = data as TaskProgressActivity;
  void dispatchTaskActivityNotifications(activity, input.projectId, input.actorId);
  return activity;
}

export async function getTaskProgressHistory(taskId: string): Promise<TaskProgressActivity[]> {
  const { data, error } = await supabase.from('task_activity')
    .select('id,request_id,actor_name,tarea_id,subtarea_id,subtarea_titulo,accion,anterior,siguiente,comentario,evidencia_path,captured_at,accepted_at')
    .eq('tarea_id', taskId).order('id', { ascending: false }).limit(30);
  if (error) throw error;
  return Promise.all(((data || []) as TaskProgressActivity[]).map(async activity => {
    if (!activity.evidencia_path) return { ...activity, evidence_url: null };
    const signed = await supabase.storage.from('task-evidence').createSignedUrl(activity.evidencia_path, 3600);
    return { ...activity, evidence_url: signed.error ? null : signed.data.signedUrl };
  }));
}

/**
 * Eliminar una subtarea
 */
export async function deleteSubtask(id: string): Promise<void> {
  const { error } = await supabase.from('subtareas').delete().eq('id', id);
  if (error) {
    console.error('Error deleting subtask:', error);
    throw error;
  }
}

/**
 * Obtener lista de colaboradores disponibles para asignar tareas
 */
export async function getAssignableStaff(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error fetching assignable staff:', error);
    return [];
  }

  return data || [];
}
