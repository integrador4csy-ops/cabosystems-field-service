// supabase/functions/invite-colaborador/index.ts
// Función en el servidor de Supabase para envío, reenvío, revocación y puente web de invitaciones
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const htmlHeaders = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
};

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const inlineJson = (value: string) => JSON.stringify(value)
  .replaceAll('<', '\\u003c')
  .replaceAll('>', '\\u003e')
  .replaceAll('&', '\\u0026')
  .replaceAll('\u2028', '\\u2028')
  .replaceAll('\u2029', '\\u2029');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  const requireInviteManager = async () => {
    const authorization = req.headers.get('Authorization') || '';
    const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || '';
    if (!accessToken) return { allowed: false, status: 401 };

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) return { allowed: false, status: 401 };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('rol, activo')
      .eq('id', authData.user.id)
      .maybeSingle();
    const allowedRoles = ['admin', 'supervisor_instalacion', 'aux_operaciones'];
    return {
      allowed: !profileError && profile?.activo === true && allowedRoles.includes(profile.rol || ''),
      status: 403,
    };
  };

  // =========================================================================
  // MANEJADOR GET: Redirección Inteligente Oficial (Web en PC / App en Móvil)
  // =========================================================================
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url);
      const type = (url.searchParams.get('type') || '').trim();
      const webAppUrl = (Deno.env.get('WEB_APP_URL') || Deno.env.get('SITE_URL') || 'https://cabosystems-field-service.pages.dev').replace(/\/+$/, '');
      const userAgent = req.headers.get('user-agent') || '';
      const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);

      // Si es flujo de recuperación de contraseña
      if (type === 'recovery') {
        const search = url.search || '';
        const targetUrl = isMobile
          ? `cabosystemsmobile://reset-password?mode=recovery${search ? '&' + search.replace(/^\?/, '') : ''}`
          : `${webAppUrl}/?mode=recovery${search ? '&' + search.replace(/^\?/, '') : ''}`;

        return new Response(null, {
          status: 302,
          headers: {
            'Location': targetUrl,
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
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inv?.token) {
          token = inv.token;
        }
      }

      // Validar datos de la invitación
      let inviteState = '';
      if (token) {
        const { data: inviteData } = await supabaseAdmin
          .from('invitaciones')
          .select('email, estado')
          .eq('token', token)
          .maybeSingle();

        if (inviteData?.email && !email) email = inviteData.email.trim().toLowerCase();
        if (inviteData?.estado) inviteState = inviteData.estado;
      }

      // Si la invitación no es válida o ya no está pendiente, enviar a la web con mensaje explicativo
      if (!token || !email || inviteState !== 'pendiente') {
        return new Response(null, {
          status: 302,
          headers: {
            'Location': `${webAppUrl}/?error=invitacion_invalida`,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        });
      }

      // Redirigir a la app si el usuario abre desde su celular, o a la web si abre en una PC/laptop
      const targetUrl = isMobile
        ? `cabosystemsmobile://register?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
        : `${webAppUrl}/?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&mode=register`;

      return new Response(null, {
        status: 302,
        headers: {
          'Location': targetUrl,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    } catch (err: any) {
      return new Response(`Error redirigiendo: ${err.message}`, { status: 500 });
    }
  }

  // =========================================================================
  // MANEJADOR POST: Operaciones de Administración y Registro
  // =========================================================================
  try {
    const body = await req.json();
    const { email, rol, resendOnly, action, token, password, nombre, avatarUrl, fechaNacimiento, fecha_nacimiento } = body;
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanFechaNacimiento = ((fechaNacimiento || fecha_nacimiento || '') as string).trim() || null;

    // -----------------------------------------------------------------------
    // ACCIÓN 1: Completar registro desde la App Móvil o Web
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

      const invitedEmail = String(invite.email || '').trim().toLowerCase();
      if (!invitedEmail || invitedEmail !== cleanEmail) {
        return new Response(JSON.stringify({ error: 'El correo no corresponde a esta invitación.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar si el usuario ya existe en auth.users
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const existingUser = (usersData?.users || []).find(
        (u) => (u.email || '').toLowerCase() === invitedEmail
      );

      let userId = '';
      if (existingUser) {
        userId = existingUser.id;
        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password,
          email_confirm: true,
          user_metadata: {
            nombre: nombre?.trim() || '',
            avatar_url: avatarUrl || null,
            fecha_nacimiento: cleanFechaNacimiento,
          },
        });
        if (updateErr) throw updateErr;
      } else {
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: invitedEmail,
          password,
          email_confirm: true,
          user_metadata: {
            nombre: nombre?.trim() || '',
            avatar_url: avatarUrl || null,
            fecha_nacimiento: cleanFechaNacimiento,
          },
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
        fecha_nacimiento: cleanFechaNacimiento,
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

    // La función es pública para que el enlace del correo y el alta por token funcionen.
    // Las operaciones administrativas sí requieren una sesión y un perfil autorizado.
    const manager = await requireInviteManager();
    if (!manager.allowed) {
      return new Response(JSON.stringify({ error: manager.status === 401 ? 'Sesión requerida.' : 'No tienes permiso para gestionar invitaciones.' }), {
        status: manager.status,
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
