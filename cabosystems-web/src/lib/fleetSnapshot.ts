import { supabase } from './supabase';
export async function fleetSnapshot() {
  const [locations, profiles] = await Promise.all([
    supabase.from('ubicaciones_usuarios').select('*'),
    supabase.from('profiles').select('id, nombre, rol, avatar_url, activo'),
  ]);
  if (locations.error) throw locations.error;
  if (profiles.error) throw profiles.error;
  return { locations: locations.data || [], profiles: profiles.data || [] };
}
