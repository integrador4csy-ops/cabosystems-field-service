import { supabase } from './supabase';
import type { TaskPermissions } from './taskAccess';
import type { Project, Task, Subtarea, TaskStatus, FieldRecord } from '@/types/database';

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
  taskStatus?: TaskStatus;
  subtaskId?: string;
  subtaskCompleted?: boolean;
  comment?: string;
  photoUri?: string | null;
  capturedAt?: string;
}

export interface TaskWithProject extends Task {
  proyectos: (Pick<Project, 'desarrollo'> & { villa?: string; unidad?: string }) | null;
  profiles: { nombre: string } | null;
}

export interface TaskDetail extends Task {
  permissions?: TaskPermissions;
  proyectos: (Pick<Project, 'desarrollo'> & { villa?: string; unidad?: string }) | null;
  profiles: { nombre: string } | null;
  subtareas: Subtarea[];
}

export async function getMyProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('proyectos')
    .select('*')
    .eq('estatus', 'activo')
    .order('desarrollo', { ascending: true });

  if (error) throw error;

  const projects = (data ?? []).map((p: any) => ({
    ...p,
    villa: p.villa || p.unidad || '',
    unidad: p.villa || p.unidad || '',
  }));

  projects.sort((a, b) => {
    const devComp = (a.desarrollo || '').localeCompare(b.desarrollo || '');
    if (devComp !== 0) return devComp;
    return (a.villa || '').localeCompare(b.villa || '');
  });

  return projects as Project[];
}

function normalizeTaskProject<T extends { proyectos: any }>(task: T): T {
  if (task.proyectos) {
    const p = task.proyectos;
    task.proyectos = {
      ...p,
      villa: p.villa || p.unidad || '',
      unidad: p.villa || p.unidad || '',
    };
  }
  return task;
}

export async function getAllTasks(): Promise<TaskWithProject[]> {
  const tasks: TaskWithProject[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from('tareas')
      .select('*, proyectos(*), profiles(nombre)')
      .order('created_at', { ascending: false })
      .order('id')
      .range(offset, offset + 499);
    if (error) throw error;
    tasks.push(...(data ?? []).map(normalizeTaskProject) as TaskWithProject[]);
    if (!data || data.length < 500) return tasks;
  }
}

/** The authenticated session's RLS determines villa/development/global visibility.
 * Occupational role and direct task assignment must not narrow this query. */
export async function getAccessibleTasks(userId: string): Promise<TaskWithProject[]> {
  if (!userId) return [];
  return getAllTasks();
}

export async function getTaskById(id: string): Promise<TaskDetail> {
  const { data, error } = await supabase
    .from('tareas')
    .select('*, proyectos(*), profiles(nombre), subtareas(id, titulo, completada)')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw Object.assign(new Error('Task unavailable'), { code: 'TASK_UNAVAILABLE' });
  return normalizeTaskProject(data) as TaskDetail;
}

export async function getTaskPermissions(id: string): Promise<TaskPermissions> {
  const { data, error } = await supabase.rpc('get_task_permissions', { p_task_id: id });
  if (error) throw error;
  if (!data?.user_id || typeof data.can_view !== 'boolean' || typeof data.can_view_all !== 'boolean' || typeof data.can_progress !== 'boolean' || typeof data.can_edit !== 'boolean') throw new Error('No se pudieron verificar los permisos de la tarea');
  return data as TaskPermissions;
}

export async function updateTaskStatus(id: string, estatus: TaskStatus): Promise<void> {
  const { error } = await supabase
    .from('tareas')
    .update({ estatus })
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
}

export async function getSubtareas(taskId: string): Promise<Subtarea[]> {
  const { data, error } = await supabase
    .from('subtareas')
    .select('*')
    .eq('tarea_id', taskId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as Subtarea[];
}

export async function toggleSubtarea(id: string, completada: boolean): Promise<void> {
  const { error } = await supabase
    .from('subtareas')
    .update({ completada })
    .eq('id', id)
    .select('id')
    .single();

  if (error) throw error;
}

async function uploadTaskEvidence(input: RecordTaskProgressInput): Promise<string | null> {
  if (!input.photoUri) return null;
  const path = `${input.projectId}/${input.taskId}/${input.actorId}/${input.requestId}.jpg`;
  const { optimizeEvidencePhoto } = await import('./evidencePhoto');
  const optimizedUri = await optimizeEvidencePhoto(input.photoUri);
  const response = await fetch(optimizedUri);
  const body = await response.arrayBuffer();
  if (body.byteLength > 10 * 1024 * 1024) throw new Error('La fotografía supera el límite de 10 MB.');
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
  return Promise.all(((data ?? []) as TaskProgressActivity[]).map(async activity => {
    if (!activity.evidencia_path) return { ...activity, evidence_url: null };
    const signed = await supabase.storage.from('task-evidence').createSignedUrl(activity.evidencia_path, 3600);
    return { ...activity, evidence_url: signed.error ? null : signed.data.signedUrl };
  }));
}

function decodeBase64ToUint8Array(base64: string): Uint8Array {
  const maybeBuffer = (globalThis as any).Buffer;
  const binaryString = typeof atob === 'function'
    ? atob(base64)
    : maybeBuffer
      ? maybeBuffer.from(base64, 'base64').toString('binary')
      : '';
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function uploadEvidencePhoto(localUri: string, path: string, reuseExisting = false): Promise<string> {
  let fileBody: ArrayBuffer | Uint8Array;
  let contentType = 'image/jpeg';

  if (path.endsWith('.png')) {
    contentType = 'image/png';
  } else if (path.endsWith('.webp')) {
    contentType = 'image/webp';
  }

  if (localUri.startsWith('data:')) {
    const parts = localUri.split(',');
    const header = parts[0] || '';
    const base64Data = parts[1] || '';
    const mimeMatch = header.match(/:(.*?);/);
    if (mimeMatch && mimeMatch[1]) {
      contentType = mimeMatch[1];
    }
    fileBody = decodeBase64ToUint8Array(base64Data);
  } else {
    const response = await fetch(localUri);
    fileBody = await response.arrayBuffer();
  }

  const { error } = await supabase.storage
    .from('evidencias-campo')
    .upload(path, fileBody, {
      contentType,
      upsert: !reuseExisting,
    });

  if (error) {
    const duplicate = String((error as { statusCode?: string }).statusCode) === '409' || /already exists|duplicate/i.test(error.message);
    if (!reuseExisting || !duplicate) throw error;
    // Evidence storage is INSERT/SELECT only. Confirm a previous upload instead of requiring UPDATE.
    const existing = await supabase.storage.from('evidencias-campo').info(path);
    if (existing.error) throw existing.error;
  }

  const { data: publicUrlData } = supabase.storage
    .from('evidencias-campo')
    .getPublicUrl(path);

  return publicUrlData.publicUrl;
}

export async function createFieldRecord(
  record: Omit<FieldRecord, 'id' | 'fecha_hora'>
): Promise<FieldRecord> {
  const { data, error } = await supabase
    .from('registros_campo')
    .insert([record])
    .select()
    .single();

  if (error) throw error;

  if (record.tipo === 'check_in') {
    await updateTaskStatus(record.tarea_id, 'en_proceso').catch(() => {
      // Ignorar error no crítico de actualización de estado
    });
  } else if (record.tipo === 'check_out') {
    await updateTaskStatus(record.tarea_id, 'completada').catch(() => {
      // Ignorar error no crítico de actualización de estado
    });
  }

  return data as FieldRecord;
}

export async function getLatestFieldRecord(userId: string): Promise<FieldRecord | null> {
  const { data, error } = await supabase
    .from('registros_campo')
    .select('*')
    .eq('tecnico_id', userId)
    .order('fecha_hora', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('Error fetching latest field record:', error);
    return null;
  }
  return data as FieldRecord | null;
}

export async function getOrCreateCheckInTaskForProject(
  projectId: string,
  userId: string
): Promise<string> {
  // 1. Try to find an active task in this project assigned to this technician
  const { data: userTasks, error: errUser } = await supabase
    .from('tareas')
    .select('id, estatus')
    .eq('proyecto_id', projectId)
    .eq('asignado_a', userId)
    .order('created_at', { ascending: false });

  if (!errUser && userTasks && userTasks.length > 0) {
    const inProgress = userTasks.find((t) => t.estatus === 'en_proceso');
    return inProgress ? inProgress.id : userTasks[0].id;
  }

  // 2. Try to find any task in this project
  const { data: projectTasks, error: errProj } = await supabase
    .from('tareas')
    .select('id')
    .eq('proyecto_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (!errProj && projectTasks && projectTasks.length > 0) {
    return projectTasks[0].id;
  }

  // 3. If no task exists at all for this project, create a default check-in task
  const { data: newTask, error: errInsert } = await supabase
    .from('tareas')
    .insert([
      {
        proyecto_id: projectId,
        asignado_a: userId,
        titulo: 'Servicio en Villa',
        descripcion: 'Registro de actividades en sitio',
        estatus: 'en_proceso',
      },
    ])
    .select('id')
    .maybeSingle();

  if (newTask?.id) {
    return newTask.id;
  }

  // 4. Safe fallback if role cannot insert tasks
  const { data: fallbackTask } = await supabase
    .from('tareas')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (fallbackTask?.id) {
    return fallbackTask.id;
  }

  throw new Error('No se pudo encontrar o asociar una orden de trabajo a esta villa.');
}
