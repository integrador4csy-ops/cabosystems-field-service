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
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (inv?.token) {
          token = inv.token;
        }
      }

      // Obtener datos de la invitación para mostrar información rica en el puente web
      let inviteRole = 'aux_instalacion';
      if (token) {
        const { data: inviteData } = await supabaseAdmin
          .from('invitaciones')
          .select('rol, email, estado')
          .eq('token', token)
          .maybeSingle();

        if (inviteData?.rol) inviteRole = inviteData.rol;
        if (inviteData?.email && !email) email = inviteData.email;
      }

      // Enlace para abrir directamente la app móvil de CaboSystems
      const appSchemeUrl = `cabosystemsmobile://register?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

      // Servir página interactiva de activación que funciona tanto en Web como en Móvil
      const roleLabels: Record<string, string> = {
        admin: 'Administrador',
        supervisor_instalacion: 'Supervisor de Instalación',
        instalador: 'Técnico Instalador',
        aux_instalacion: 'Auxiliar de Instalación',
        integrador: 'Integrador de Sistemas',
        aux_integracion: 'Auxiliar de Integración',
        infraestructura: 'Técnico de Infraestructura',
        aux_infraestructura: 'Auxiliar de Infraestructura',
        servicios: 'Técnico de Servicios',
        aux_servicios: 'Auxiliar de Servicios',
        aux_operaciones: 'Auxiliar de Operaciones',
      };
      const displayRole = roleLabels[inviteRole] || inviteRole;

      const bridgeHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Aceptar Invitación · CaboSystems Field Service</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0b0f17;
      color: #ffffff;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 24px 16px;
    }
    .card {
      background: #151c28;
      border: 1px solid #243043;
      border-radius: 20px;
      padding: 36px 28px;
      max-width: 460px;
      width: 100%;
      box-shadow: 0 20px 45px rgba(0,0,0,0.6);
      text-align: left;
    }
    .logo-container {
      text-align: center;
      margin-bottom: 22px;
    }
    .logo {
      width: 220px;
      max-width: 80%;
      height: auto;
      margin: 0 auto;
      display: block;
    }
    .badge {
      display: inline-block;
      background: rgba(247, 140, 38, 0.15);
      color: #f78c26;
      border: 1px solid rgba(247, 140, 38, 0.35);
      border-radius: 9999px;
      padding: 4px 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #ffffff;
      letter-spacing: -0.3px;
    }
    p.lead {
      font-size: 13.5px;
      color: #94a3b8;
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .info-box {
      background: #0d121c;
      border: 1px solid #1f2a3c;
      border-radius: 12px;
      padding: 14px 16px;
      margin-bottom: 22px;
      font-size: 13px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
    }
    .info-label { color: #64748b; font-size: 12px; }
    .info-val { color: #e2e8f0; font-weight: 600; font-size: 12.5px; word-break: break-all; }
    .mobile-banner {
      background: #182234;
      border: 1px solid #2e3e57;
      border-radius: 12px;
      padding: 12px 14px;
      margin-bottom: 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .mobile-banner-text { font-size: 12px; color: #cbd5e1; }
    .mobile-banner-btn {
      background: #2563eb;
      color: #ffffff;
      padding: 7px 12px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }
    .form-group {
      margin-bottom: 15px;
    }
    label {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #cbd5e1;
      margin-bottom: 6px;
    }
    label span { color: #f87171; }
    input {
      width: 100%;
      height: 44px;
      background: #0d121c;
      border: 1px solid #243043;
      border-radius: 10px;
      padding: 0 14px;
      color: #ffffff;
      font-size: 13.5px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus {
      border-color: #f78c26;
      box-shadow: 0 0 0 2px rgba(247, 140, 38, 0.15);
    }
    .btn-submit {
      width: 100%;
      height: 48px;
      background: #f78c26;
      color: #ffffff;
      border: none;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      margin-top: 10px;
      transition: background 0.2s, opacity 0.2s;
    }
    .btn-submit:hover { background: #e07616; }
    .btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .status-msg {
      margin-top: 15px;
      padding: 12px;
      border-radius: 10px;
      font-size: 13px;
      display: none;
      text-align: center;
      line-height: 1.4;
    }
    .status-msg.error {
      display: block;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #fca5a5;
    }
    .status-msg.success {
      display: block;
      background: rgba(34, 197, 94, 0.15);
      border: 1px solid rgba(34, 197, 94, 0.35);
      color: #86efac;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo-container">
      <img src="https://nyqlfgnblkmijxspkvpi.supabase.co/storage/v1/object/public/avatars/logo-cabosystems-on-white.svg" alt="CaboSystems" class="logo" />
    </div>

    <div style="text-align: center; margin-bottom: 14px;">
      <span class="badge">Registro de Colaborador</span>
      <h1>Completa tu Registro</h1>
      <p class="lead">Activa tu cuenta de CaboSystems Field Service desde la web o en la app móvil.</p>
    </div>

    <div class="info-box">
      <div class="info-row">
        <span class="info-label">Correo registrado:</span>
        <span class="info-val">${email || 'Verificando...'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Rol asignado:</span>
        <span class="info-val" style="color: #f78c26;">${displayRole}</span>
      </div>
    </div>

    <div class="mobile-banner" id="mobilePrompt" style="display: none;">
      <div class="mobile-banner-text">¿Estás en tu celular? Puedes abrir la app directamente:</div>
      <a href="${appSchemeUrl}" class="mobile-banner-btn">Abrir en App</a>
    </div>

    <form id="regForm">
      <div class="form-group">
        <label for="nombre">Nombre completo <span>*</span></label>
        <input type="text" id="nombre" name="nombre" placeholder="Ej. Juan Pérez González" required />
      </div>

      <div class="form-group">
        <label for="fechaNacimiento">Fecha de nacimiento (Cumpleaños) <span>*</span></label>
        <input type="date" id="fechaNacimiento" name="fechaNacimiento" required />
      </div>

      <div class="form-group">
        <label for="password">Contraseña <span>*</span></label>
        <input type="password" id="password" name="password" placeholder="Mínimo 6 caracteres" minlength="6" required />
      </div>

      <div class="form-group">
        <label for="confirmPassword">Confirmar contraseña <span>*</span></label>
        <input type="password" id="confirmPassword" name="confirmPassword" placeholder="Repite tu contraseña" minlength="6" required />
      </div>

      <button type="submit" id="submitBtn" class="btn-submit">Activar Cuenta y Registrar</button>
    </form>

    <div id="statusBox" class="status-msg"></div>
  </div>

  <script>
    // Detectar si está en móvil para sugerir app
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      document.getElementById('mobilePrompt').style.display = 'flex';
      // Intentar abrir la app en segundo plano
      setTimeout(function() {
        window.location.href = "${appSchemeUrl}";
      }, 350);
    }

    const regForm = document.getElementById('regForm');
    const submitBtn = document.getElementById('submitBtn');
    const statusBox = document.getElementById('statusBox');

    regForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      statusBox.className = 'status-msg';
      statusBox.style.display = 'none';

      const nombre = document.getElementById('nombre').value.trim();
      const fechaNacimiento = document.getElementById('fechaNacimiento').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (!nombre) {
        showError('Por favor ingresa tu nombre completo.');
        return;
      }
      if (!fechaNacimiento) {
        showError('Por favor ingresa tu fecha de nacimiento (cumpleaños).');
        return;
      }
      if (password.length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        showError('Las contraseñas no coinciden.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Registrando tu cuenta...';

      try {
        const response = await fetch('/functions/v1/invite-colaborador', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete-invite',
            token: "${encodeURIComponent(token)}",
            email: "${encodeURIComponent(email)}",
            password: password,
            nombre: nombre,
            fechaNacimiento: fechaNacimiento
          })
        });

        const resData = await response.json();
        if (!response.ok || resData.error) {
          throw new Error(resData.error || 'No se pudo completar el registro.');
        }

        regForm.style.display = 'none';
        statusBox.className = 'status-msg success';
        statusBox.innerHTML = '<strong>¡Registro completado con éxito!</strong><br><br>Tu cuenta ha sido activada y tus datos (incluyendo tu cumpleaños) han quedado registrados.<br><br>Ya puedes iniciar sesión en la app móvil o ingresar al panel web con tu correo y contraseña.';
        statusBox.style.display = 'block';
      } catch (err) {
        showError(err.message || 'Error al conectar con el servidor.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Activar Cuenta y Registrar';
      }
    });

    function showError(msg) {
      statusBox.className = 'status-msg error';
      statusBox.textContent = msg;
      statusBox.style.display = 'block';
    }
  </script>
</body>
</html>`;

      return new Response(bridgeHtml, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
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
          user_metadata: {
            nombre: nombre?.trim() || '',
            avatar_url: avatarUrl || null,
            fecha_nacimiento: cleanFechaNacimiento,
          },
        });
        if (updateErr) throw updateErr;
      } else {
        const { data: newUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
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
