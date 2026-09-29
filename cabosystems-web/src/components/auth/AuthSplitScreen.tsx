import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2, ShieldCheck, MapPin, MessageSquare, Radio } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { GridShape } from '../common/GridShape';

export const AuthSplitScreen: React.FC = () => {
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor ingresa tu correo y contraseña.');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await login(email, password);
      if (!res.success) {
        setErrorMsg(res.error || 'Credenciales inválidas. Verifica tu correo y contraseña.');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMsg(err?.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-screen bg-white font-sans text-slate-800 antialiased overflow-hidden flex">
      {/* 1. Left Column: Sign In Form (TailAdmin Style) */}
      <div className="flex w-full lg:w-1/2 flex-col justify-between p-6 sm:p-12 lg:p-16 z-10 overflow-y-auto">
        {/* Top: Header Brand */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-cabosystems-light.svg"
              alt="CaboSystems"
              className="h-10 w-auto object-contain"
            />
          </div>
          <span className="rounded-full bg-orange-50 border border-orange-200/80 px-2.5 py-1 text-[11px] font-bold text-[#f78c26]">
            v1.0.0 Web
          </span>
        </div>

        {/* Center: Auth Form Card */}
        <div className="mx-auto w-full max-w-md my-auto py-8">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 mb-3">
              <ShieldCheck size={14} className="text-[#f78c26]" />
              <span className="font-heading">Acceso Administrativo</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-[#343e48] tracking-tight">
              Iniciar Sesión
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
              Ingresa tus credenciales autorizadas de supervisor o administrador para acceder al radar de flota y chat técnico.
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/90 p-4 text-xs font-semibold text-rose-700 animate-in fade-in slide-from-top-2 duration-150">
              <p className="font-bold">Error de acceso</p>
              <p className="mt-0.5 text-rose-600 font-medium">{errorMsg}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-[#343e48] mb-1.5">
                Correo Electrónico <span className="text-[#f78c26]">*</span>
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type="email"
                  required
                  autoFocus
                  placeholder="ejemplo@csy.mx"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 text-xs font-medium text-[#343e48] placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 outline-hidden transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#343e48]">
                  Contraseña <span className="text-[#f78c26]">*</span>
                </label>
              </div>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-11 text-xs font-medium text-[#343e48] placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 outline-hidden transition-all shadow-2xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Keep Logged In Checkbox */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepLoggedIn}
                  onChange={(e) => setKeepLoggedIn(e.target.checked)}
                  className="h-4 w-4 rounded-md border-slate-300 text-[#f78c26] focus:ring-[#f78c26] cursor-pointer"
                />
                <span className="text-xs font-medium text-slate-600">
                  Mantener sesión activa
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full flex items-center justify-center gap-2 rounded-xl bg-[#f78c26] hover:bg-[#ea580c] font-bold text-xs text-white shadow-md shadow-orange-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verificando credenciales...</span>
                </>
              ) : (
                <span>Iniciar Sesión</span>
              )}
            </button>
          </form>

          {/* Bottom Security Note */}
          <div className="mt-8 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-center">
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              🔒 <strong>Acceso restringido</strong> a personal técnico y directivo de CaboSystems.
            </p>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="text-center lg:text-left text-[11px] text-slate-400 font-medium">
          © {new Date().getFullYear()} CaboSystems Field Service. Todos los derechos reservados.
        </div>
      </div>

      {/* 2. Right Column: CaboSystems Orange Branding & Hero Grid (50% Split) */}
      <div className="hidden lg:flex w-1/2 h-full bg-gradient-to-br from-[#f78c26] via-[#f78c26] to-[#ea580c] relative flex-col items-center justify-center p-12 text-white select-none overflow-hidden">
        {/* SVG Decorative Background Grids */}
        <GridShape />

        {/* Subtle Ambient Radial Glow */}
        <div className="absolute h-96 w-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />

        {/* Hero Content Container */}
        <div className="relative z-10 max-w-md text-center flex flex-col items-center">
          {/* White Card holding the Official Logo */}
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-3xl bg-white shadow-2xl p-5 border border-white/40 ring-4 ring-white/20 transition-transform duration-300 hover:scale-105">
            <img
              src="/logo-cabosystems-icon.svg"
              alt="CaboSystems"
              className="h-full w-full object-contain"
            />
          </div>

          {/* Title in Montserrat */}
          <h2 className="text-2xl sm:text-3xl font-heading font-extrabold text-white tracking-tight drop-shadow-xs">
            CaboSystems Field Service
          </h2>

          {/* Subtitle */}
          <p className="mt-3 text-xs sm:text-sm text-white/95 font-medium leading-relaxed drop-shadow-2xs">
            Plataforma centralizada de telemetría satelital en vivo, radar de cuadrillas y comunicación técnica en tiempo real.
          </p>

          {/* Feature Badges */}
          <div className="mt-8 grid grid-cols-3 gap-3 w-full">
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/25 bg-white/15 p-3 backdrop-blur-md shadow-xs hover:bg-white/20 transition-all">
              <Radio size={20} className="text-white" />
              <span className="text-[11px] font-bold text-white">Radar GPS</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/25 bg-white/15 p-3 backdrop-blur-md shadow-xs hover:bg-white/20 transition-all">
              <MessageSquare size={20} className="text-white" />
              <span className="text-[11px] font-bold text-white">Chat Técnico</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/25 bg-white/15 p-3 backdrop-blur-md shadow-xs hover:bg-white/20 transition-all">
              <MapPin size={20} className="text-white" />
              <span className="text-[11px] font-bold text-white">En Tiempo Real</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
