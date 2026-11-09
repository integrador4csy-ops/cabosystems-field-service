import { useTranslation } from '../../context/LanguageContext';
import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2, MapPin, MessageSquare, ShieldCheck, User, CheckCircle2, KeyRound } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { supabase } from '../../lib/supabase';
import { getRoleLabel } from '../../lib/uiTranslations';
import { AgendaDateTimeField } from '../agenda/AgendaDateTimeField';

export const AuthSplitScreen: React.FC = () => {
  const { t, locale } = useTranslation();
  const { login } = useAdminAuth();

  // Mode: login or register
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Login form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Register form state
  const [token, setToken] = useState('');
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [validatingToken, setValidatingToken] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('aux_instalacion');

  const [regFullName, setRegFullName] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);

  const validateToken = useCallback(async (tokenToValidate: string) => {
    const cleanToken = tokenToValidate.trim();
    if (!cleanToken) return;
    setValidatingToken(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('invitaciones')
        .select('*')
        .eq('token', cleanToken)
        .eq('estado', 'pendiente')
        .single();

      if (error || !data) {
        setTokenValid(false);
        setErrorMsg(t('El enlace de invitación no es válido o ya fue utilizado.'));
      } else {
        setTokenValid(true);
        setToken(data.token);
        setInviteEmail(data.email);
        setInviteRole(data.rol || 'aux_instalacion');
      }
    } catch (err: any) {
      setTokenValid(false);
      setErrorMsg(err?.message || t('El enlace de invitación no es válido o ya fue utilizado.'));
    } finally {
      setValidatingToken(false);
    }
  }, [t]);

  // Read URL params on load (e.g. ?token=... or ?action=register)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token') || '';
      const urlEmail = params.get('email') || '';
      const modeParam = params.get('mode') || params.get('action') || '';
      const errorParam = params.get('error') || '';

      if (errorParam === 'invitacion_invalida') {
        setErrorMsg(t('El enlace de invitación no es válido o ya fue utilizado.'));
      }

      if (urlToken || modeParam === 'register') {
        setAuthMode('register');
        if (urlEmail) setInviteEmail(urlEmail);
        if (urlToken) {
          setToken(urlToken);
          validateToken(urlToken);
        }
      }
    } catch {
      // ignore
    }
  }, [validateToken]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg(t("Por favor ingresa tu correo y contraseña."));
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      setSuccessBanner(null);
      const res = await login(email, password);
      if (!res.success) {
        setErrorMsg(res.error || t("Credenciales inválidas. Verifica tu correo y contraseña."));
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err?.message || t("Error al conectar con el servidor."));
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessBanner(null);

    if (!token.trim()) {
      setErrorMsg(t('Por favor valida tu código de invitación.'));
      return;
    }
    if (!regFullName.trim()) {
      setErrorMsg(t('Por favor ingresa tu nombre completo.'));
      return;
    }
    if (!regBirthDate.trim()) {
      setErrorMsg(t('Por favor ingresa tu fecha de nacimiento (cumpleaños).'));
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMsg(t('La contraseña debe tener al menos 6 caracteres.'));
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setErrorMsg(t('Las contraseñas no coinciden.'));
      return;
    }

    setRegLoading(true);
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('invite-colaborador', {
        body: {
          action: 'complete-invite',
          token: token.trim(),
          email: inviteEmail.trim().toLowerCase(),
          password: regPassword,
          nombre: regFullName.trim(),
          fechaNacimiento: regBirthDate.trim(),
        },
      });

      if (fnErr || fnData?.error) {
        throw new Error(fnErr?.message || fnData?.error || t('Error al conectar con el servidor.'));
      }

      setSuccessBanner(t('¡Registro completado con éxito! Iniciando sesión...'));

      const res = await login(inviteEmail.trim().toLowerCase(), regPassword);
      if (!res.success) {
        setEmail(inviteEmail.trim().toLowerCase());
        setPassword(regPassword);
        setAuthMode('login');
      }
    } catch (err: any) {
      console.error('Registration error:', err);
      setErrorMsg(err?.message || t('Error al conectar con el servidor.'));
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh w-full bg-white font-outfit text-gray-800 antialiased flex">
      <div className="flex w-full lg:w-1/2 flex-col px-6 py-8 sm:px-12 sm:py-10 lg:px-14">
        {/* Center: Auth Form Card */}
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 sm:py-14">
          <div>
            {/* Header depending on mode */}
            {authMode === 'login' ? (
              <div className="mb-5 sm:mb-8">
                <h1 className="mb-3 text-title-sm font-semibold text-gray-800 sm:text-title-md tracking-tight">
                  {t("Iniciar sesión")}</h1>
                <p className="max-w-sm text-sm leading-relaxed text-gray-500">
                  {t("Ingresa con tu cuenta para consultar al equipo y administrar las operaciones.")}</p>
              </div>
            ) : (
              <div className="mb-5 sm:mb-8">
                <h1 className="mb-3 text-title-sm font-semibold text-gray-800 sm:text-title-md tracking-tight">
                  {t("Completa tu Registro")}</h1>
                <p className="max-w-sm text-sm leading-relaxed text-gray-500">
                  {t("Activa tu cuenta de CaboSystems Field Service con tu código de invitación.")}</p>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 animate-in fade-in duration-150">
                <p className="font-semibold">{t("Error de acceso")}</p>
                <p className="mt-0.5 text-xs text-red-600">{t(errorMsg)}</p>
              </div>
            )}

            {/* Success Banner */}
            {successBanner && (
              <div role="status" className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-700 animate-in fade-in duration-150">
                <p className="font-semibold">{successBanner}</p>
              </div>
            )}

            {/* LOGIN FORM */}
            {authMode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label htmlFor="login-email" className="mb-1.5 block text-sm font-medium text-gray-700">
                    {t("Correo electrónico")}<span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <input
                      type="email"
                      id="login-email"
                      autoComplete="username"
                      required
                      autoFocus
                      placeholder="ejemplo@csy.mx"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-4 text-sm font-normal text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 transition-colors"
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
                      {t("Contraseña")}<span className="text-red-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                    />
                    <input
                      id="login-password"
                      autoComplete="current-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-10 pr-12 text-sm font-normal text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-0.5 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center rounded-lg text-gray-500 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-brand-500 transition-colors cursor-pointer"
                      title={showPassword ? t("Ocultar contraseña") : t("Ver contraseña")}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>{t("Verificando credenciales...")}</span>
                      </>
                    ) : (
                      <span>{t("Iniciar sesión")}</span>
                    )}
                  </button>
                </div>

                {/* Switch to Register */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('register');
                      setErrorMsg(null);
                    }}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 hover:underline cursor-pointer transition-colors"
                  >
                    {t("¿Recibiste una invitación por correo? Completar registro aquí")}
                  </button>
                </div>
              </form>
            )}

            {/* REGISTRATION FORM */}
            {authMode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4">
                {/* Token Validation Section if not valid yet */}
                {!tokenValid ? (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label htmlFor="reg-token" className="block text-xs font-semibold text-slate-700">
                      {t("Código de invitación")}<span className="text-red-500">*</span>
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          id="reg-token"
                          type="text"
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          placeholder={t("Pega aquí tu código de invitación")}
                          className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => validateToken(token)}
                        disabled={validatingToken || !token.trim()}
                        className="flex h-10 items-center justify-center rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50 cursor-pointer transition-colors"
                      >
                        {validatingToken ? t("Validando...") : t("Validar código")}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Verified invitation badge */
                  <div className="rounded-xl border border-green-200 bg-green-50/70 p-3.5 flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-green-600 shrink-0" />
                    <div className="min-w-0 flex-1 text-xs">
                      <p className="font-semibold text-green-900">{t("Invitación confirmada")}</p>
                      <p className="text-green-700 truncate">{inviteEmail} · {t("Rol: {value0}", { value0: getRoleLabel(inviteRole, t) })}</p>
                    </div>
                  </div>
                )}

                {/* Form fields enabled once token is valid */}
                {tokenValid && (
                  <>
                    {/* Full Name */}
                    <div>
                      <label htmlFor="reg-name" className="mb-1 block text-xs font-medium text-gray-700">
                        {t("Nombre completo")}<span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          id="reg-name"
                          type="text"
                          required
                          value={regFullName}
                          onChange={(e) => setRegFullName(e.target.value)}
                          placeholder={t("Ej. Juan Pérez")}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-xs font-normal text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden transition-colors"
                        />
                      </div>
                    </div>

                    {/* Birthday (Cumpleaños) */}
                    <div>
                      <label htmlFor="reg-birthdate" className="mb-1 block text-xs font-medium text-gray-700">
                        {t("Fecha de nacimiento (Cumpleaños)")}<span className="text-red-500">*</span>
                      </label>
                      <AgendaDateTimeField
                        type="date"
                        required
                        min="1900-01-01"
                        value={regBirthDate}
                        label={t("Fecha de nacimiento (Cumpleaños)")}
                        locale={locale}
                        onChange={setRegBirthDate}
                      />
                    </div>

                    {/* Password */}
                    <div>
                      <label htmlFor="reg-password" className="mb-1 block text-xs font-medium text-gray-700">
                        {t("Crea tu contraseña")}<span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          id="reg-password"
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          placeholder={t("Mínimo 6 caracteres")}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-10 text-xs font-normal text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword(!showRegPassword)}
                          className="absolute right-0.5 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer"
                        >
                          {showRegPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label htmlFor="reg-confirm-password" className="mb-1 block text-xs font-medium text-gray-700">
                        {t("Confirmar contraseña")}<span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        <input
                          id="reg-confirm-password"
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          placeholder={t("Repite la contraseña")}
                          value={regConfirmPassword}
                          onChange={(e) => setRegConfirmPassword(e.target.value)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 text-xs font-normal text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden transition-colors"
                        />
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={regLoading}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 disabled:cursor-wait cursor-pointer"
                      >
                        {regLoading ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            <span>{t("Registrando cuenta...")}</span>
                          </>
                        ) : (
                          <span>{t("Completar registro y acceder")}</span>
                        )}
                      </button>
                    </div>
                  </>
                )}

                {/* Switch back to Login */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode('login');
                      setErrorMsg(null);
                    }}
                    className="text-xs font-semibold text-gray-500 hover:text-gray-800 hover:underline cursor-pointer transition-colors"
                  >
                    {t("¿Ya tienes una cuenta activa? Iniciar sesión")}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <div className="hidden lg:grid w-1/2 self-stretch bg-[#343e48] relative items-center justify-center px-10 py-14 text-white select-none">
        {/* Hero Content Container */}
        <div className="relative z-1 w-full max-w-md text-center flex flex-col items-center">
          {/* White Card holding the Official Logo */}
          <div className="mb-8 flex h-36 w-36 items-center justify-center rounded-2xl bg-white p-6 xl:h-40 xl:w-40">
            <img
              src="/logo-cabosystems-icon.svg"
              alt="CaboSystems"
              width={60}
              height={60}
              className="h-full w-full object-contain"
            />
          </div>

          {/* Title in Outfit */}
          <h2 className="max-w-sm text-title-sm xl:text-title-md font-semibold text-white tracking-tight text-balance">
            CaboSystems Field Service
          </h2>

          {/* Subtitle in Outfit */}
          <p className="mt-4 max-w-sm text-sm text-white/80 font-normal leading-relaxed text-pretty">
            {t("Plataforma centralizada de monitoreo satelital en vivo, Administración de cuadrillas y comunicación técnica en tiempo real.")}</p>

          {/* Feature Badges */}
          <div className="mt-10 grid grid-cols-3 gap-4 w-full border-t border-white/15 pt-6">
            <div className="flex flex-col items-center gap-2">
              <ShieldCheck size={20} className="text-brand-500" />
              <span className="text-xs font-medium text-gray-200">{t("Administración")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <MessageSquare size={20} className="text-brand-500" />
              <span className="text-xs font-medium text-gray-200">{t("Chat Técnico")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <MapPin size={20} className="text-brand-500" />
              <span className="text-xs font-medium text-gray-200">{t("Monitoreo GPS")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
