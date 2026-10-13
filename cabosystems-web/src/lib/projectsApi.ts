import { supabase } from './supabase';
import type { Proyecto, Tarea, Subtarea } from '../types/projects';
import type { Profile } from '../types/fleet';

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
    descripcion: p.descripcion,
    estatus: p.estatus || 'activo',
    latitud: p.latitud ?? null,
    longitud: p.longitud ?? null,
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
  estatus?: 'activo' | 'pausado' | 'finalizado';
  latitud?: number | null;
  longitud?: number | null;
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
export async function getTasksByProject(projectId: string): Promise<Tarea[]> {
  const { data, error } = await supabase
    .from('tareas')
    .select(`
      id,
      proyecto_id,
      asignado_a,
      titulo,
      descripcion,
      estatus,
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
        created_at
      )
    `)
    .eq('proyecto_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching tasks for project:', error);
    throw error;
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    proyecto_id: t.proyecto_id,
    asignado_a: t.asignado_a,
    titulo: t.titulo,
    descripcion: t.descripcion,
    estatus: t.estatus,
    created_at: t.created_at,
    profiles: t.profiles,
    subtareas: (t.subtareas || []).sort(
      (a: Subtarea, b: Subtarea) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    ),
  }));
}

/**
 * Crear una nueva tarea
 */
export async function createTask(payload: {
  proyecto_id: string;
  asignado_a: string;
  titulo: string;
  descripcion?: string;
  estatus?: 'pendiente' | 'en_proceso' | 'completada';
}): Promise<Tarea> {
  const { data, error } = await supabase
    .from('tareas')
    .insert([
      {
        proyecto_id: payload.proyecto_id,
        asignado_a: payload.asignado_a,
        titulo: payload.titulo.trim(),
        descripcion: payload.descripcion?.trim() || null,
        estatus: payload.estatus || 'pendiente',
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
