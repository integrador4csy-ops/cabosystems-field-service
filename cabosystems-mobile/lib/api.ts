import { supabase } from './supabase';
import type { Project, Task, Subtarea, TaskStatus, FieldRecord } from '@/types/database';

export interface TaskWithProject extends Task {
  proyectos: (Pick<Project, 'desarrollo'> & { villa?: string; unidad?: string }) | null;
  profiles: { nombre: string } | null;
}

export interface TaskDetail extends Task {
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

export async function getMyTasks(userId: string): Promise<TaskWithProject[]> {
  const { data, error } = await supabase
    .from('tareas')
    .select('*, proyectos(*), profiles(nombre)')
    .eq('asignado_a', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeTaskProject) as TaskWithProject[];
}

export async function getAllTasks(): Promise<TaskWithProject[]> {
  const { data, error } = await supabase
    .from('tareas')
    .select('*, proyectos(*), profiles(nombre)')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(normalizeTaskProject) as TaskWithProject[];
}

export async function getTaskById(id: string): Promise<TaskDetail> {
  const { data, error } = await supabase
    .from('tareas')
    .select('*, proyectos(*), profiles(nombre), subtareas(id, titulo, completada)')
    .eq('id', id)
    .single();

  if (error) throw error;
  return normalizeTaskProject(data) as TaskDetail;
}

export async function updateTaskStatus(id: string, estatus: TaskStatus): Promise<void> {
  const { error } = await supabase
    .from('tareas')
    .update({ estatus })
    .eq('id', id);

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
    .eq('id', id);

  if (error) throw error;
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

export async function uploadEvidencePhoto(localUri: string, path: string): Promise<string> {
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
      upsert: true,
    });

  if (error) {
    throw error;
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