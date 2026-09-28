// supabase/functions/invite-colaborador/index.ts
// Función en el servidor de Supabase para envío, reenvío, revocación y puente web de invitaciones
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // =========================================================================
  // MANEJADOR GET: Puente Web Oficial CaboSystems para Teléfonos Móviles
  // =========================================================================
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const type = (url.searchParams.get('type') || '').trim();

      // Si es flujo de recuperación de contraseña, servir puente web que preserve el hash con los tokens
      if (type === 'recovery') {
        const recoveryHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Restablecer Contraseña · CaboSystems Field Service</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background-color: #090b0f; color: #ffffff; font-family: 'Montserrat', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #151921; border: 1px solid #262d35; border-radius: 20px; padding: 36px 28px; text-align: center; max-width: 420px; width: 100%; box-shadow: 0 16px 36px rgba(0,0,0,0.5); }
    .logo { width: 220px; max-width: 80%; height: auto; margin: 0 auto 20px auto; display: block; }
    h2 { font-size: 20px; margin-bottom: 10px; color: #ffffff; }
    p { font-size: 13.5px; color: #94a3b8; line-height: 1.5; margin-bottom: 24px; }
    .btn { display: block; width: 100%; background: #f78c26; color: #ffffff; text-decoration: none; padding: 15px; border-radius: 12px; font-weight: 700; text-transform: uppercase; font-size: 13px; letter-spacing: 0.8px; }
  </style>
</head>
<body>
  <div class="card">
    <img src="https://nyqlfgnblkmijxspkvpi.supabase.co/storage/v1/object/public/avatars/logo-cabosystems-on-white.svg" alt="CaboSystems" class="logo" />
    <h2>Restablecer Contraseña</h2>
    <p>Redirigiendo a la app móvil de CaboSystems para configurar tu nueva clave...</p>
    <a id="openBtn" href="cabosystemsmobile://reset-password?mode=recovery" class="btn">Abrir en la App</a>
  </div>
  <script>
    const hash = window.location.hash || '';
    const search = window.location.search || '';
    let appUrl = 'cabosystemsmobile://reset-password?mode=recovery';
    if (search && search.length > 1) {
      appUrl += '&' + search.substring(1);
    }
    if (hash) {
      appUrl += hash;
    }
    document.getElementById('openBtn').href = appUrl;
    setTimeout(function() {
      window.location.href = appUrl;
    }, 250);
  </script>
</body>
</html>`;
        return new Response(recoveryHtml, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      }

      let email = (url.searchParams.get('email') || '').trim().toLowerCase();
      let token = (url.searchParams.get('token') || '').trim();

      // Si tenemos email pero no token, buscar el token pendiente en la base de datos
      if (email && !token) {
        const { data: inv } = await supabaseAdmin
          .from('invitaciones')
          .select('token')
          .eq('email', email)
          .eq('estado', 'pendiente')
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inv?.token) {
          token = inv.token;
        }
      }

      // Enlace para abrir directamente la app móvil de CaboSystems
      const appSchemeUrl = `cabosystemsmobile://register?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

      // Redirigir de inmediato al esquema de la aplicación móvil
      return new Response(null, {
        status: 302,
        headers: {
          'Location': appSchemeUrl,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (err: any) {
      return new Response(`Error redirigiendo a la app: ${err.message}`, { status: 500 });
    }
  }

  // =========================================================================
  // MANEJADOR POST: Operaciones de Administración y Registro
  // =========================================================================
  try {
    const body = await req.json();
    const { email, rol, resendOnly, action, token, password, nombre, avatarUrl } = body;
    const cleanEmail = (email || '').trim().toLowerCase();

    // -----------------------------------------------------------------------
    // ACCIÓN 1: Completar registro desde la App Móvil
    // -----------------------------------------------------------------------
    if (action === 'complete-invite') {
      if (!token || !cleanEmail || !password) {
        return new Response(JSON.stringify({ error: 'Faltan campos obligatorios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validar invitación pendiente
      const { data: invite, error: inviteErr } = await supabaseAdmin
        .from('invitaciones')
        .select('*')
        .eq('token', token.trim())
        .eq('estado', 'pendiente')
        .single();

      if (inviteErr || !invite) {
        return new Response(JSON.stringify({ error: 'La invitación no es válida o ya fue utilizada.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar si el usuario ya existe en auth.users
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = (usersData?.users || []).find(
        (u) => (u.email || '').toLowerCase() === cleanEmail
      );

      let userId = '';
      if (existingUser) {
        userId = existingUser.id;
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: { nombre: nombre?.trim() || '', avatar_url: avatarUrl || null },
        });
        if (updateErr) throw updateErr;
      } else {
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          password,
          email_confirm: true,
          user_metadata: { nombre: nombre?.trim() || '', avatar_url: avatarUrl || null },
        });
        if (createErr) throw createErr;
        userId = newUser.user.id;
      }

      // Upsert perfil
      await supabaseAdmin.from('profiles').upsert({
        id: userId,
        nombre: nombre?.trim() || '',
        rol: invite.rol || 'aux_instalacion',
        activo: true,
        avatar_url: avatarUrl || null,
      });

      // Marcar invitación como aceptada
      await supabaseAdmin
        .from('invitaciones')
        .update({ estado: 'aceptada' })
        .eq('id', invite.id);

      return new Response(
        JSON.stringify({ success: true, message: 'Usuario registrado exitosamente', userId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'Correo electrónico inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // -----------------------------------------------------------------------
    // ACCIÓN 2: Revocar invitación y anular acceso
    // -----------------------------------------------------------------------
    if (action === 'revoke') {
      await supabaseAdmin.from('invitaciones').delete().eq('email', cleanEmail);
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = (usersData?.users || []).find(
          (u) => (u.email || '').toLowerCase() === cleanEmail && !u.email_confirmed_at
        );
        if (existingAuthUser) {
          await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
        }
      } catch (err) {
        console.warn('Error purgando auth user en revocación:', err);
      }
      return new Response(
        JSON.stringify({ success: true, message: 'Invitación y enlace revocados exitosamente' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Helper para limpiar usuario previo incompleto en auth.users si no ha completado perfil
    const purgeIncompleteAuthUser = async (userEmail: string) => {
      try {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const existingAuthUser = (usersData?.users || []).find(
          (u) => (u.email || '').toLowerCase() === userEmail
        );
        if (existingAuthUser) {
          const { data: prof } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('id', existingAuthUser.id)
            .maybeSingle();

          // Si no tiene perfil, es un registro incompleto o invitación previa: purgar para permitir reenvío
          if (!prof) {
            await supabaseAdmin.auth.admin.deleteUser(existingAuthUser.id);
          }
        }
      } catch (err) {
        console.warn('Error purgando usuario auth incompleto:', err);
      }
    };

    // -----------------------------------------------------------------------
    // ACCIÓN 3: Reenvío de correo (conserva el mismo registro y token existente)
    // -----------------------------------------------------------------------
    if (resendOnly) {
      let activeToken = token;
      if (!activeToken) {
        const { data: inv } = await supabaseAdmin
          .from('invitaciones')
          .select('token')
          .eq('email', cleanEmail)
          .eq('estado', 'pendiente')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        activeToken = inv?.token || '';
      }

      // Purgar intento previo incompleto en auth.users para evitar error de "already registered"
      await purgeIncompleteAuthUser(cleanEmail);

      const bridgeRedirectUrl = `https://nyqlfgnblkmijxspkvpi.supabase.co/functions/v1/invite-colaborador?email=${encodeURIComponent(cleanEmail)}&token=${encodeURIComponent(activeToken)}`;

      const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
        data: { rol: rol || 'aux_instalacion', token: activeToken },
        redirectTo: bridgeRedirectUrl,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Correo reenviado automáticamente con el enlace oficial',
          user: data.user,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -----------------------------------------------------------------------
    // ACCIÓN 4: Nueva invitación
    // -----------------------------------------------------------------------
    const { data: existingInvite } = await supabaseAdmin
      .from('invitaciones')
      .select('id, token, estado')
      .eq('email', cleanEmail)
      .eq('estado', 'pendiente')
      .maybeSingle();

    // Si existe una invitación pendiente PREVIA con un token diferente, bloquear duplicado
    if (existingInvite && (!token || existingInvite.token !== token)) {
      return new Response(
        JSON.stringify({
          error: 'Ya existe una invitación pendiente para este correo en la pestaña "Invitaciones". Puedes reenviarle el correo desde allí sin generar una nueva.',
          existingToken: existingInvite.token,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const assignedToken = token || existingInvite?.token || '';
    const bridgeRedirectUrl = `https://nyqlfgnblkmijxspkvpi.supabase.co/functions/v1/invite-colaborador?email=${encodeURIComponent(cleanEmail)}&token=${encodeURIComponent(assignedToken)}`;

    // Purgar intento previo incompleto en auth.users si existiera
    await purgeIncompleteAuthUser(cleanEmail);

    // Enviar invitación oficial con Supabase Auth (dispara el email template con SMTP)
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
      data: { rol: rol || 'aux_instalacion', token: assignedToken },
      redirectTo: bridgeRedirectUrl,
    });

    if (error) {
      console.error('Error al invitar con auth.admin:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Correo enviado automáticamente con éxito',
        user: data.user,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
