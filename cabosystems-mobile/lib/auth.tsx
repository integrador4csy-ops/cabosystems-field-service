import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Linking, Alert } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { Profile } from '@/types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  refreshProfile: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithInvitation: (
    token: string,
    email: string,
    password: string,
    nombre: string,
    avatarUrl: string | null
  ) => Promise<{ error: Error | null }>;
  sendPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isApproved: boolean;
}

export function formatAuthError(error: any): string {
  if (!error) return 'Ocurrió un error inesperado.';
  const msg = typeof error === 'string' ? error : (error.message || '');
  const lower = msg.toLowerCase();

  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials') ||
    lower.includes('invalid credential')
  ) {
    return 'Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Tu correo electrónico aún no ha sido confirmado.';
  }
  if (lower.includes('user not found') || lower.includes('no user')) {
    return 'No se encontró ningún usuario registrado con este correo.';
  }
  if (lower.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (lower.includes('user already registered') || lower.includes('already exists')) {
    return 'Ya existe una cuenta registrada con este correo electrónico.';
  }
  if (lower.includes('rate limit') || lower.includes('over email rate limit') || lower.includes('too many requests')) {
    return 'Demasiados intentos. Por favor espera unos minutos antes de volver a intentar.';
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('timeout')) {
    return 'Error de conexión. Verifica tu acceso a internet e inténtalo de nuevo.';
  }
  if (lower.includes('token') && (lower.includes('expired') || lower.includes('invalid'))) {
    return 'El código de seguridad o enlace de invitación ha expirado o no es válido.';
  }
  if (lower.includes('desactivad') || lower.includes('inactiv')) {
    return 'Tu cuenta ha sido desactivada por un administrador de CaboSystems.';
  }

  return msg;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  authError: null,
  clearAuthError: () => {},
  refreshProfile: async () => {},
  signInWithEmail: async () => ({ error: null }),
  signUpWithInvitation: async () => ({ error: null }),
  sendPasswordReset: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  signOut: async () => {},
  isApproved: true,
});

async function handleDeepLink(url: string) {
  try {
    const hashIndex = url.indexOf('#');
    if (hashIndex === -1) {
      const queryIndex = url.indexOf('?');
      if (queryIndex !== -1) {
        const query = url.substring(queryIndex + 1);
        const params = new URLSearchParams(query);
        const code = params.get('code');
        if (code) {
          const { error, data } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error('Code exchange error:', error);
          else console.log('Session established with query code:', data.user?.email);
          return;
        }
      }
      return;
    }

    // Si la URL es de tipo invitación o registro, no intentar setSession con JWTs de invitación
    if (url.includes('register') || url.includes('type=invite') || url.includes('token=')) {
      return;
    }

    const hash = url.substring(hashIndex + 1);
    const params = new URLSearchParams(hash);

    const code = params.get('code');
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const errorDescription = params.get('error_description');

    if (errorDescription) {
      console.warn('Auth deep link status:', errorDescription);
      Alert.alert(
        'Enlace Expirado o Revocado',
        'Este enlace de invitación ya no es válido porque fue revocado o ya se utilizó. Si solicitaste un nuevo reenvío, asegúrate de abrir el correo más reciente en tu bandeja de entrada.'
      );
      return;
    }

    if (code) {
      const { error, data } = await supabase.auth.exchangeCodeForSession(code);
      if (error) console.error('Code exchange error:', error);
      else console.log('Session established, user:', data.user?.email);
      return;
    }

    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) console.error('Session error:', error);
    }
  } catch (e) {
    console.error('handleDeepLink error:', e);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const clearAuthError = () => setAuthError(null);

  useEffect(() => {
    mountedRef.current = true;
    const sub = Linking.addEventListener('url', ({ url }) => {
      if (mountedRef.current) handleDeepLink(url);
    });

    Linking.getInitialURL().then((url) => {
      if (mountedRef.current && url) handleDeepLink(url);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      setSession(session);
      if (session?.user) fetchProfile(session.user);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      setSession(session);
      if (session?.user) fetchProfile(session.user);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mountedRef.current = false;
      sub.remove();
      subscription.unsubscribe();
    };
  }, []);

  // Suscripción Realtime a cambios en el perfil (fotos, nombres, roles, estatus)
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    const channel = supabase
      .channel(`profile-live-sync-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new && mountedRef.current) {
            const updated = payload.new as Profile;
            if (updated.activo === false) {
              supabase.auth.signOut();
              setSession(null);
              setProfile(null);
              setAuthError('Tu cuenta ha sido desactivada o revocada por un administrador de CaboSystems.');
            } else {
              setProfile(updated);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  async function refreshProfile() {
    if (session?.user) {
      await fetchProfile(session.user, 1);
    }
  }

  async function fetchProfile(user: User, retries = 3) {
    for (let i = 0; i < retries; i++) {
      if (!mountedRef.current) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        if (!mountedRef.current) return;

        // Si el usuario está inactivo o fue expulsado por el administrador
        if (data.activo === false) {
          await supabase.auth.signOut();
          setSession(null);
          setProfile(null);
          setLoading(false);
          setAuthError('Tu cuenta ha sido desactivada o revocada por un administrador de CaboSystems.');
          return;
        }

        setProfile(data as Profile);
        setLoading(false);
        return;
      }

      if (i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    if (!mountedRef.current) return;
    setLoading(false);
  }

  // 1. Iniciar sesión con correo y contraseña
  async function signInWithEmail(email: string, password: string): Promise<{ error: Error | null }> {
    clearAuthError();
    try {
      const cleanEmail = email.trim().toLowerCase();
      let { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      // Si falló y la contraseña tenía espacios al inicio o final (común en teclados móviles)
      if (error && password !== password.trim()) {
        const retry = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password.trim(),
        });
        if (!retry.error) {
          data = retry.data;
          error = null;
        }
      }

      if (error) {
        const formattedMsg = formatAuthError(error);
        setAuthError(formattedMsg);
        return { error: new Error(formattedMsg) };
      }

      if (data.user) {
        // Verificar estatus activo del perfil
        const { data: prof } = await supabase
          .from('profiles')
          .select('activo')
          .eq('id', data.user.id)
          .single();

        if (prof && prof.activo === false) {
          await supabase.auth.signOut();
          const inactiveMsg = 'Tu cuenta ha sido desactivada por un administrador de CaboSystems.';
          setAuthError(inactiveMsg);
          return { error: new Error(inactiveMsg) };
        }
      }

      return { error: null };
    } catch (err: any) {
      const formattedMsg = formatAuthError(err?.message || 'Error al iniciar sesión.');
      setAuthError(formattedMsg);
      return { error: new Error(formattedMsg) };
    }
  }

  // 2. Registro de nuevo usuario mediante invitación
  async function signUpWithInvitation(
    token: string,
    email: string,
    password: string,
    nombre: string,
    avatarUrl: string | null
  ): Promise<{ error: Error | null }> {
    clearAuthError();
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Validar invitación
      const { data: invite, error: inviteError } = await supabase
        .from('invitaciones')
        .select('*')
        .eq('token', token)
        .eq('estado', 'pendiente')
        .single();

      if (inviteError || !invite) {
        const invalidMsg = 'La invitación no es válida, ya fue utilizada o ha expirado.';
        setAuthError(invalidMsg);
        return { error: new Error(invalidMsg) };
      }

      // Intento 1: Completar registro vía Edge Function con service role (evita colisiones si ya fue invitado por Supabase Auth)
      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('invite-colaborador', {
          body: {
            action: 'complete-invite',
            token: token.trim(),
            email: cleanEmail,
            password,
            nombre: nombre.trim(),
            avatarUrl,
          },
        });

        if (!fnErr && fnData?.success) {
          // Iniciar sesión inmediatamente con las credenciales establecidas
          const { error: signInErr } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password,
          });

          if (signInErr) {
            const formattedMsg = formatAuthError(signInErr);
            setAuthError(formattedMsg);
            return { error: new Error(formattedMsg) };
          }

          return { error: null };
        }
      } catch (fnEx) {
        console.warn('Fallback a registro local de cliente:', fnEx);
      }

      // Intento 2 (Fallback): Crear usuario directamente en Supabase Auth
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            nombre,
            avatar_url: avatarUrl,
          },
        },
      });

      if (signUpError) {
        const formattedMsg = formatAuthError(signUpError);
        setAuthError(formattedMsg);
        return { error: new Error(formattedMsg) };
      }

      const userId = authData.user?.id;
      if (userId) {
        // Crear perfil con el rol asignado en la invitación y estatus activo
        await supabase
          .from('profiles')
          .upsert({
            id: userId,
            nombre,
            rol: invite.rol || 'aux_instalacion',
            activo: true,
            avatar_url: avatarUrl,
          });

        // Marcar invitación como aceptada
        await supabase
          .from('invitaciones')
          .update({ estado: 'aceptada' })
          .eq('id', invite.id);
      }

      return { error: null };
    } catch (err: any) {
      const formattedMsg = formatAuthError(err?.message || 'Error en el proceso de registro.');
      setAuthError(formattedMsg);
      return { error: new Error(formattedMsg) };
    }
  }

  // 3. Envío de correo para recuperar contraseña
  async function sendPasswordReset(email: string): Promise<{ error: Error | null }> {
    clearAuthError();
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: 'https://nyqlfgnblkmijxspkvpi.supabase.co/functions/v1/invite-colaborador?type=recovery',
      });

      if (error) {
        const formattedMsg = formatAuthError(error);
        setAuthError(formattedMsg);
        return { error: new Error(formattedMsg) };
      }

      return { error: null };
    } catch (err: any) {
      const formattedMsg = formatAuthError(err?.message || 'Error al enviar correo de recuperación.');
      setAuthError(formattedMsg);
      return { error: new Error(formattedMsg) };
    }
  }

  // 4. Actualizar contraseña del usuario autenticado
  async function updatePassword(newPassword: string): Promise<{ error: Error | null }> {
    clearAuthError();
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        const formattedMsg = formatAuthError(error);
        setAuthError(formattedMsg);
        return { error: new Error(formattedMsg) };
      }

      return { error: null };
    } catch (err: any) {
      const formattedMsg = formatAuthError(err?.message || 'Error al actualizar contraseña.');
      setAuthError(formattedMsg);
      return { error: new Error(formattedMsg) };
    }
  }

  // 5. Cerrar sesión
  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    clearAuthError();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        authError,
        clearAuthError,
        refreshProfile,
        signInWithEmail,
        signUpWithInvitation,
        sendPasswordReset,
        updatePassword,
        signOut,
        isApproved: profile?.activo ?? true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);