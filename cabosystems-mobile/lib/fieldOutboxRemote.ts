import { supabase } from './supabase';
import { uploadEvidencePhoto } from './api';
import type { PendingFieldRecord } from './fieldOutbox';

export async function sendPendingFieldRecord(record: PendingFieldRecord, assertActive: () => void) {
  const guard = async () => {
    assertActive();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session?.user.id !== record.owner) throw new Error('La sesión cambió. El registro sigue guardado en su cuenta.');
    assertActive();
  };
  await guard();
  const existing = await supabase.from('registros_campo').select('id, tecnico_id, proyecto_id, foto_url').eq('id', record.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data && existing.data.tecnico_id !== record.owner) throw new Error('El registro pertenece a otra cuenta.');
  if (existing.data) record.remotePhotoUrl = existing.data.foto_url;
  if (!existing.data) {
    await guard();
    const { getInfoAsync } = await import('expo-file-system/legacy');
    if (!(await getInfoAsync(record.photoUri)).exists) throw Object.assign(new Error('No se encuentra la foto guardada. El registro necesita revisión.'), { code: 'LOCAL_PHOTO_MISSING' });
    const photoUrl = await uploadEvidencePhoto(record.photoUri, `field-offline/${record.owner}/${record.id}.jpg`, true);
    record.remotePhotoUrl = photoUrl;
    await guard();
    const result = await supabase.from('registros_campo').insert({
      id: record.id, proyecto_id: record.projectId, tarea_id: null, tecnico_id: record.owner, tipo: record.tipo,
      latitud: record.latitude, longitud: record.longitude, foto_url: photoUrl,
      comentarios: record.comments, fecha_hora: record.capturedAt,
    });
    if (result.error && result.error.code !== '23505') throw result.error;
    if (result.error) {
      const confirmed = await supabase.from('registros_campo').select('id').eq('id', record.id).eq('tecnico_id', record.owner).eq('proyecto_id', record.projectId).single();
      if (confirmed.error) throw confirmed.error;
    }
  }
  if (record.tipo === 'check_in' && record.geofence) {
    await guard();
    const geofence = await supabase.rpc('register_missing_villa_geofence', {
      p_field_record_id: record.id,
      p_project_id: record.projectId,
      p_latitude: record.geofence.latitude,
      p_longitude: record.geofence.longitude,
      p_radius_meters: record.geofence.radiusMeters,
    });
    if (geofence.error) throw geofence.error;
  }
  supabase.functions.invoke('operations-push-notifications', {
    body: { kind: 'field_check', entityId: record.id },
  }).then(({ error }) => {
    if (error) console.warn('Could not notify administrators about field check:', error);
  }).catch((error) => {
    console.warn('Could not notify administrators about field check:', error);
  });
}
