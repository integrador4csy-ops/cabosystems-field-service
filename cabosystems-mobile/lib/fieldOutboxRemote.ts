import { supabase } from './supabase';
import { uploadEvidencePhoto, updateTaskStatus } from './api';
import { saveFieldTask } from './fieldOutboxStore';
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
  const existing = await supabase.from('registros_campo').select('id, tecnico_id, tarea_id, foto_url').eq('id', record.id).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data && existing.data.tecnico_id !== record.owner) throw new Error('El registro pertenece a otra cuenta.');
  if (existing.data) record.remotePhotoUrl = existing.data.foto_url;
  if (!existing.data) {
    if (!record.taskId) {
      await guard();
      const tasks = await supabase.from('tareas').select('id, estatus').eq('proyecto_id', record.projectId).eq('asignado_a', record.owner).order('created_at', { ascending: false });
      if (tasks.error) throw tasks.error;
      let taskId = tasks.data?.find(task => task.estatus === 'en_proceso')?.id || tasks.data?.[0]?.id;
      if (!taskId) {
        await guard();
        // Reuse the operation UUID if task creation succeeded but the response was lost.
        const created = await supabase.from('tareas').insert({ id: record.id, proyecto_id: record.projectId, asignado_a: record.owner, titulo: 'Servicio en Villa', descripcion: 'Registro de actividades en sitio', estatus: 'en_proceso' });
        if (created.error && created.error.code !== '23505') throw created.error;
        const task = await supabase.from('tareas').select('id').eq('id', record.id).eq('proyecto_id', record.projectId).eq('asignado_a', record.owner).single();
        if (task.error) throw task.error;
        taskId = task.data.id;
      }
      await saveFieldTask(record, taskId);
    }
    await guard();
    const { getInfoAsync } = await import('expo-file-system/legacy');
    if (!(await getInfoAsync(record.photoUri)).exists) throw Object.assign(new Error('No se encuentra la foto guardada. El registro necesita revisión.'), { code: 'LOCAL_PHOTO_MISSING' });
    const photoUrl = await uploadEvidencePhoto(record.photoUri, `field-offline/${record.owner}/${record.id}.jpg`, true);
    record.remotePhotoUrl = photoUrl;
    await guard();
    const result = await supabase.from('registros_campo').insert({
      id: record.id, tarea_id: record.taskId!, tecnico_id: record.owner, tipo: record.tipo,
      latitud: record.latitude, longitud: record.longitude, foto_url: photoUrl,
      comentarios: record.comments, fecha_hora: record.capturedAt,
    });
    if (result.error && result.error.code !== '23505') throw result.error;
    if (result.error) {
      const confirmed = await supabase.from('registros_campo').select('id').eq('id', record.id).eq('tecnico_id', record.owner).eq('tarea_id', record.taskId!).single();
      if (confirmed.error) throw confirmed.error;
    }
  }
  await guard();
  const taskId = existing.data?.tarea_id || record.taskId!;
  // Do not let an old offline event regress a task that already has a newer event.
  const latest = await supabase.from('registros_campo').select('id').eq('tarea_id', taskId).order('fecha_hora', { ascending: false }).order('id', { ascending: false }).limit(1).maybeSingle();
  if (latest.error) throw latest.error;
  if (latest.data?.id === record.id) {
    await guard();
    await updateTaskStatus(taskId, record.tipo === 'check_in' ? 'en_proceso' : 'completada');
  }
}
