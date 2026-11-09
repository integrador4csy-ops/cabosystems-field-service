import type { Profile, UbicacionUsuario } from '@/types/database';
import { supabase } from './supabase';

export interface FleetMapWorker {
  profile: Pick<Profile, 'id' | 'nombre' | 'rol' | 'avatar_url' | 'activo'>;
  location: UbicacionUsuario;
  isOffline: boolean;
}

export function isFleetWorkerOffline(location: Pick<UbicacionUsuario, 'en_linea' | 'updated_at'>, now = Date.now()) {
  return location.en_linea === false || now - new Date(location.updated_at).getTime() > 15 * 60 * 1000;
}

export async function getFleetMapWorkers(): Promise<FleetMapWorker[]> {
  const [locationsResult, profilesResult] = await Promise.all([
    supabase.from('ubicaciones_usuarios').select('*'),
    supabase.from('profiles').select('id,nombre,rol,avatar_url,activo'),
  ]);
  if (locationsResult.error) throw locationsResult.error;
  if (profilesResult.error) throw profilesResult.error;

  const profiles = new Map(
    ((profilesResult.data || []) as FleetMapWorker['profile'][]).map(profile => [profile.id, profile]),
  );

  return ((locationsResult.data || []) as UbicacionUsuario[])
    .flatMap(location => {
      const profile = profiles.get(location.usuario_id);
      if (!profile || profile.activo === false || !Number.isFinite(location.latitud) || !Number.isFinite(location.longitud)) return [];
      return [{ profile, location, isOffline: isFleetWorkerOffline(location) }];
    })
    .sort((a, b) => a.profile.nombre.localeCompare(b.profile.nombre));
}
