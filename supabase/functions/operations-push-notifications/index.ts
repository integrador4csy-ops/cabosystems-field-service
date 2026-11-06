import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authorization = req.headers.get('Authorization') ?? '';
    const callerClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const admin = createClient(url, serviceKey);
    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) return json({ error: 'Authentication required' }, 401);

    const body = await req.json();
    const kind = body?.kind;
    const entityId = body?.entityId;
    if (!entityId || !['task_assigned', 'field_check'].includes(kind)) return json({ error: 'Invalid event' }, 400);

    let recipientIds: string[] = [];
    let title = '';
    let message = '';
    let data: Record<string, string> = {};
    let eventKey = '';

    if (kind === 'task_assigned') {
      const [{ data: caller }, { data: task, error }] = await Promise.all([
        admin.from('profiles').select('rol, activo').eq('id', authData.user.id).single(),
        admin.from('tareas').select('id, asignado_a').eq('id', entityId).single(),
      ]);
      if (!caller?.activo || !['admin', 'supervisor_instalacion', 'aux_operaciones'].includes(caller.rol)) return json({ error: 'Administrator access required' }, 403);
      if (error || !task?.asignado_a) return json({ error: 'Assigned task not found' }, 404);
      recipientIds = [task.asignado_a];
      title = 'Nueva tarea asignada';
      message = 'Tienes una nueva tarea. Abre la app para consultar los detalles.';
      data = { target: 'tasks' };
      eventKey = String(body.eventKey || `task:${task.id}:${task.asignado_a}`);
    } else {
      const { data: record, error } = await admin
        .from('registros_campo')
        .select('id, tecnico_id')
        .eq('id', entityId)
        .single();
      if (error || !record || record.tecnico_id !== authData.user.id) return json({ error: 'Owned check not found' }, 404);
      const { data: admins } = await admin.from('profiles').select('id').eq('activo', true).in('rol', ['admin', 'supervisor_instalacion', 'aux_operaciones']);
      recipientIds = (admins || []).map((profile) => profile.id).filter((id) => id !== record.tecnico_id);
      title = 'Nuevo registro de campo';
      message = 'Se registró un nuevo check. Abre la app para consultar la evidencia.';
      data = { target: 'checks' };
      eventKey = `field-check:${record.id}`;
    }

    if (!recipientIds.length) return json({ success: true, sentCount: 0 });
    const reservation = await admin.from('push_event_deliveries').insert({ event_key: eventKey });
    if (reservation.error?.code === '23505') return json({ success: true, duplicate: true, sentCount: 0 });
    if (reservation.error) throw reservation.error;

    const notificationRows = recipientIds.map((userId) => ({
      user_id: userId,
      kind,
      title,
      body: message,
      target: data.target,
      target_id: entityId,
      event_key: eventKey,
    }));
    const stored = await admin.from('app_notifications').upsert(notificationRows, {
      onConflict: 'user_id,event_key',
      ignoreDuplicates: true,
    });
    if (stored.error) throw stored.error;

    try {
      const { data: tokenRows, error: tokenError } = await admin
        .from('user_push_tokens')
        .select('expo_push_token')
        .in('user_id', recipientIds);
      if (tokenError) throw tokenError;
      const tokens = [...new Set((tokenRows || []).map((row) => row.expo_push_token).filter((token) => token?.startsWith('ExponentPushToken[')))];
      if (!tokens.length) return json({ success: true, sentCount: 0 });
      const notifications = tokens.map((to) => ({ to, sound: 'default', title, body: message, data, channelId: 'operations', priority: 'high' }));
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(notifications),
      });
      if (!response.ok) throw new Error(`Expo Push returned ${response.status}`);
      return json({ success: true, sentCount: tokens.length, receipts: await response.json() });
    } catch (error) {
      await admin.from('push_event_deliveries').delete().eq('event_key', eventKey);
      throw error;
    }
  } catch (error) {
    console.error('[operations-push]', error);
    return json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
