// supabase/functions/chat-push-notifications/index.ts
// Función Serverless para enviar notificaciones push de chat grupal a dispositivos móviles
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('[chat-push] Body recibido:', JSON.stringify(body));

    // Soportar ambos formatos: { record: { ... } } y { grupo_id, remitente_id, ... }
    const payload = body.record || body;
    console.log('[chat-push] Payload parseado:', JSON.stringify(payload));

    // MODO DE PRUEBA DIRECTA: Envía una notificación a todos los tokens en la BD
    if (payload.test === true) {
      console.log('[chat-push] MODO PRUEBA ACTIVADO');
      const { data: allTokens, error: errTokens } = await supabaseAdmin
        .from('user_push_tokens')
        .select('*');

      if (errTokens || !allTokens || allTokens.length === 0) {
        return new Response(
          JSON.stringify({
            test: true,
            status: 'sin_tokens',
            message: 'La tabla user_push_tokens está vacía o no tiene registros.',
            db_error: errTokens,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const testNotifications = allTokens.map((t) => ({
        to: t.expo_push_token,
        sound: 'default',
        title: '🔔 Prueba CaboSystems',
        body: '¡Las notificaciones push funcionan en tu celular!',
        data: { test: true },
        channelId: 'chat-messages',
        priority: 'high',
        _displayInForeground: true,
      }));

      const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(testNotifications),
      }).then((r) => r.json());

      return new Response(
        JSON.stringify({
          test: true,
          tokens_encontrados: allTokens,
          expo_respuesta: expoRes,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const grupoId = payload.grupo_id;
    const remitenteId = payload.remitente_id;
    const tipo = payload.tipo || 'texto';
    const contenido = payload.contenido || '';
    const mensajeId = payload.id || payload.mensaje_id;

    console.log('[chat-push] grupoId:', grupoId, '| remitenteId:', remitenteId);

    if (!grupoId || !remitenteId) {
      return new Response(
        JSON.stringify({ error: 'Parámetros grupo_id y remitente_id requeridos' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Obtener información del grupo y del remitente en paralelo
    const [groupRes, senderRes] = await Promise.all([
      supabaseAdmin
        .from('chat_grupos')
        .select('nombre, foto_url')
        .eq('id', grupoId)
        .single(),
      supabaseAdmin
        .from('profiles')
        .select('nombre')
        .eq('id', remitenteId)
        .single(),
    ]);

    const groupName = groupRes.data?.nombre || 'Chat de Cuadrilla';
    const senderName = senderRes.data?.nombre || 'Compañero de equipo';

    // 2. Formatear vista previa del mensaje según el tipo
    let previewText = contenido;
    if (tipo === 'imagen') {
      previewText = '📷 Foto';
    } else if (tipo === 'video') {
      previewText = '🎥 Video';
    } else if (tipo === 'sticker') {
      previewText = '🎨 Sticker';
    }

    if (!previewText || previewText.trim() === '') {
      previewText = 'Nuevo mensaje';
    }

    // 3. Obtener tokens push de los demás miembros del grupo
    const { data: members, error: memError } = await supabaseAdmin
      .from('chat_miembros')
      .select('profile_id')
      .eq('grupo_id', grupoId)
      .neq('profile_id', remitenteId);

    console.log('[chat-push] Miembros encontrados:', members?.length ?? 0, '| Error:', memError?.message ?? 'ninguno');

    if (memError || !members || members.length === 0) {
      console.log('[chat-push] DETENIDO: No hay otros miembros en el grupo');
      return new Response(
        JSON.stringify({ success: true, message: 'No hay otros miembros a notificar', sentCount: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const memberIds = members.map((m) => m.profile_id);
    console.log('[chat-push] IDs de miembros destinatarios:', memberIds);

    // Obtener tokens válidos de esos miembros
    const { data: tokensData, error: tokError } = await supabaseAdmin
      .from('user_push_tokens')
      .select('expo_push_token, user_id')
      .in('user_id', memberIds);

    console.log('[chat-push] Tokens encontrados:', tokensData?.length ?? 0, '| Error:', tokError?.message ?? 'ninguno');
    if (tokensData) {
      console.log('[chat-push] Tokens detalle:', JSON.stringify(tokensData));
    }

    if (tokError || !tokensData || tokensData.length === 0) {
      console.log('[chat-push] DETENIDO: Ningún miembro tiene push token registrado');
      return new Response(
        JSON.stringify({ success: true, message: 'Ningún miembro tiene push token registrado', sentCount: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filtrar y eliminar tokens duplicados
    const uniqueTokens = Array.from(
      new Set(
        tokensData
          .map((t) => t.expo_push_token)
          .filter((token) => Boolean(token) && token.startsWith('ExponentPushToken['))
      )
    );

    if (uniqueTokens.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No hay tokens válidos de Expo Push', sentCount: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Construir mensajes de notificación para la API de Expo
    const notifications = uniqueTokens.map((token) => ({
      to: token,
      sound: 'default',
      title: `💬 ${groupName}`,
      body: `${senderName}: ${previewText}`,
      data: {
        groupId: grupoId,
        messageId: mensajeId,
        url: `/chat/${grupoId}`,
      },
      channelId: 'chat-messages',
      priority: 'high',
      _displayInForeground: true,
    }));

    // 5. Enviar a la API de Expo Push en lotes de 100
    const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
    const BATCH_SIZE = 100;
    const sendPromises = [];

    for (let i = 0; i < notifications.length; i += BATCH_SIZE) {
      const batch = notifications.slice(i, i + BATCH_SIZE);
      sendPromises.push(
        fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(batch),
        }).then((res) => res.json())
      );
    }

    const results = await Promise.all(sendPromises);

    return new Response(
      JSON.stringify({
        success: true,
        sentCount: uniqueTokens.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error en chat-push-notifications:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
