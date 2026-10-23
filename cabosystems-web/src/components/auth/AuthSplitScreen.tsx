import { useTranslation } from '../../context/LanguageContext';
import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2, MapPin, MessageSquare, ShieldCheck } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';

export const AuthSplitScreen: React.FC = () => {
  const { t } = useTranslation();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg(t("Por favor ingresa tu correo y contraseña."));
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
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

  return (
    <div className="relative min-h-dvh w-full bg-white font-outfit text-gray-800 antialiased flex">
      <div className="flex w-full lg:w-1/2 flex-col px-6 py-8 sm:px-12 sm:py-10 lg:px-14">
        <div className="flex w-full shrink-0 justify-center">
          <img src="/logo-cabosystems-light.svg" alt="CaboSystems Field Service" width={510} height={170} className="h-auto w-64 max-w-full object-contain sm:w-80" />
        </div>
       

        {/* Center: Auth Form Card */}
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 sm:py-14">
          <div>
            <div className="mb-5 sm:mb-8">
              <h1 className="mb-3 text-title-sm font-semibold text-gray-800 sm:text-title-md tracking-tight">
                {t("Iniciar sesión")}</h1>
              <p className="max-w-sm text-sm leading-relaxed text-gray-500">
                {t("Ingresa con tu cuenta para consultar al equipo y administrar las operaciones.")}</p>
            </div>

            {errorMsg && (
              <div role="alert" className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 animate-in fade-in duration-150">
                <p className="font-semibold">{t("Error de acceso")}</p>
                <p className="mt-0.5 text-xs text-red-600">{t(errorMsg)}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
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

              {/* Submit Button (TailAdmin styled) */}
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
            </form>

           
          </div>
        </div>

        
      </div>

      <div className="hidden lg:grid w-1/2 self-stretch bg-[#343e48] relative items-center justify-center px-10 py-14 text-white select-none">
        {/* TailAdmin SVG Grid shape */}


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
