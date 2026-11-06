import { supabase } from './supabase';
import type { AccessGrant, Development, ProjectDirectory, ProjectVilla } from '../types/projectAccess';

async function readAll<T>(table: string, columns = '*'): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = supabase.from(table).select(columns).order(table === 'desarrollos' ? 'nombre' : table === 'profiles' ? 'nombre' : table === 'proyectos' ? 'id' : 'usuario_id');
    if (table === 'proyecto_participantes') query = query.order('proyecto_id');
    if (table === 'desarrollo_accesos') query = query.order('desarrollo_id');
    if (table === 'profiles') query = query.order('id');
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data || []) as unknown as T[]);
    if (!data || data.length < 500) return rows;
  }
}

export async function getProjectDirectory(admin: boolean): Promise<ProjectDirectory> {
  const [developments, villas, members, staff, globalGrants, developmentGrants] = await Promise.all([
    readAll<Development>('desarrollos'), readAll<ProjectVilla>('proyectos'),
    readAll<ProjectDirectory['members'][number]>('proyecto_participantes'),
    readAll<ProjectDirectory['staff'][number]>('profiles', 'id,nombre,rol,activo,avatar_url'),
    admin ? readAll<AccessGrant>('proyecto_accesos_globales') : Promise.resolve([]),
    admin ? readAll<AccessGrant>('desarrollo_accesos') : Promise.resolve([]),
  ]);
  return { developments, villas, members, staff, globalGrants, developmentGrants };
}

export async function createDevelopment(nombre: string) {
  const { data, error } = await supabase.from('desarrollos').insert({ nombre: nombre.trim() }).select('*').single();
  if (error) throw error;
  return data as Development;
}

export async function deleteDevelopment(developmentId: string) {
  const { data, error } = await supabase
    .from('desarrollos')
    .delete()
    .eq('id', developmentId)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw Object.assign(new Error('Development was not deleted.'), { code: 'DELETE_NOT_FOUND' });
}

export async function createVilla(
  development: Development,
  input: { villa: string; numeroProyecto: string; cliente: string; descripcion: string; estatus: ProjectVilla['estatus'] },
) {
  const { data, error } = await supabase.from('proyectos').insert({
    desarrollo_id: development.id,
    desarrollo: development.nombre,
    villa: input.villa.trim(),
    numero_proyecto: input.numeroProyecto.trim(),
    cliente: input.cliente.trim(),
    descripcion: input.descripcion.trim() || null,
    estatus: input.estatus,
  }).select('*').single();
  if (error) throw error;
  return data as ProjectVilla;
}

export async function updateVillaDetails(
  projectId: string,
  input: { villa: string; numeroProyecto: string; cliente: string; descripcion: string; estatus: ProjectVilla['estatus'] },
) {
  const { data, error } = await supabase.from('proyectos').update({
    villa: input.villa.trim(),
    numero_proyecto: input.numeroProyecto.trim() || null,
    cliente: input.cliente.trim() || null,
    descripcion: input.descripcion.trim() || null,
    estatus: input.estatus,
  }).eq('id', projectId).select('*').single();
  if (error) throw error;
  return data as ProjectVilla;
}

export async function deleteVilla(projectId: string) {
  const { data, error } = await supabase.from('proyectos').delete().eq('id', projectId).select('id');
  if (error) throw error;
  if (!data?.length) throw Object.assign(new Error('Villa was not deleted.'), { code: 'DELETE_NOT_FOUND' });
}

export async function saveProjectTeam(villa: ProjectVilla, integrador: string, tecnico: string, participants: string[], allTasksParticipants: string[] = []) {
  const { error } = await supabase.rpc('save_project_team', { p_project_id: villa.id, p_integrador_id: integrador || null, p_tecnico_id: tecnico || null, p_participants: [...new Set(participants)], p_revision: villa.equipo_revision, p_all_tasks_participants: [...new Set(allTasksParticipants)] });
  if (error) throw error;
}

export async function updateVillaGeofence(
  projectId: string,
  geofence: { latitude: number | null; longitude: number | null; radiusMeters: number },
) {
  const { data, error } = await supabase
    .from('proyectos')
    .update({
      latitud: geofence.latitude,
      longitud: geofence.longitude,
      radio_geocerca_m: geofence.radiusMeters,
    })
    .eq('id', projectId)
    .select('id,latitud,longitud,radio_geocerca_m')
    .single();
  if (error) throw error;
  return data;
}

export async function grantProjectAccess(userId: string, developmentId?: string) {
  const { error } = await supabase.from(developmentId ? 'desarrollo_accesos' : 'proyecto_accesos_globales').insert(developmentId ? { usuario_id: userId, desarrollo_id: developmentId } : { usuario_id: userId });
  if (error) throw error;
}

export async function revokeProjectAccess(userId: string, developmentId?: string) {
  let query = supabase.from(developmentId ? 'desarrollo_accesos' : 'proyecto_accesos_globales').delete().eq('usuario_id', userId).select('usuario_id');
  if (developmentId) query = query.eq('desarrollo_id', developmentId);
  const { data, error } = await query;
  if (error) throw error;
  if (!data?.length) throw new Error('access_not_found');
}
