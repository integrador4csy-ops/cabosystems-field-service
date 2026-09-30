import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, Loader2, MapPin, MessageSquare, ShieldCheck } from 'lucide-react';
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
    <div className="relative min-h-screen w-screen bg-white font-outfit text-gray-800 antialiased overflow-hidden flex">
      {/* 1. Left Column: Sign In Form (TailAdmin SignUp/SignIn Typography & Style) */}
      <div className="no-scrollbar flex w-full lg:w-1/2 flex-1 flex-col justify-between p-6 sm:p-12 lg:p-16 z-10 overflow-y-auto">
        {/* Top: Header Brand */}
       

        {/* Center: Auth Form Card */}
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-8">
          <div>
            <div className="mb-5 sm:mb-8">
              <div className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 mb-3">
              
                <span>Acceso Administrativo</span>
              </div>
              <h1 className="mb-2 text-title-sm font-semibold text-gray-800 sm:text-title-md">
                Iniciar Sesión
              </h1>
              <p className="text-sm text-gray-500">
                Ingresa tus credenciales autorizadas para visualizar a los integrantes del equipo y administracion de la Operaciones  
              </p>
            </div>

            {errorMsg && (
              <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 animate-in fade-in duration-150">
                <p className="font-semibold">Error de acceso</p>
                <p className="mt-0.5 text-xs text-red-600">{errorMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Correo Electrónico <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="ejemplo@csy.mx"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-4 text-sm font-normal text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 transition"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">
                    Contraseña <span className="text-red-500">*</span>
                  </label>
                </div>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-gray-300 bg-transparent pl-10 pr-11 text-sm font-normal text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 transition cursor-pointer"
                    title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Keep Logged In Checkbox */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={keepLoggedIn}
                    onChange={(e) => setKeepLoggedIn(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 cursor-pointer accent-[#f78c26]"
                  />
                  <span className="text-theme-sm font-normal text-gray-700">
                    Mantener sesión activa
                  </span>
                </label>
              </div>

              {/* Submit Button (TailAdmin styled) */}
              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50 cursor-pointer"
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
              </div>
            </form>

           
          </div>
        </div>

        
      </div>

      {/* 2. Right Column: Hero Panel with #343e48 Background, GridShape & White Logo Card */}
      <div className="hidden lg:grid w-1/2 h-full bg-[#343e48] relative items-center justify-center p-12 text-white select-none overflow-hidden">
        {/* TailAdmin SVG Grid shape */}
        <GridShape />

        {/* Hero Content Container */}
        <div className="relative z-1 max-w-sm text-center flex flex-col items-center">
          {/* White Card holding the Official Logo */}
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-3xl bg-white shadow-2xl p-5 border border-white/20 ring-4 ring-white/10 transition-transform duration-300 hover:scale-105">
            <img
              src="/logo-cabosystems-icon.svg"
              alt="CaboSystems"
              className="h-full w-full object-contain"
            />
          </div>

          {/* Title in Outfit */}
          <h2 className="text-title-sm sm:text-title-md font-semibold text-white tracking-tight">
            CaboSystems Field Service
          </h2>

          {/* Subtitle in Outfit */}
          <p className="mt-3 text-sm text-gray-300 font-normal leading-relaxed">
            Plataforma centralizada de monitoreo satelital en vivo, Administración de cuadrillas y comunicación técnica en tiempo real.
          </p>

          {/* Feature Badges */}
          <div className="mt-8 grid grid-cols-3 gap-3 w-full">
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 shadow-xs hover:bg-white/10 transition">
              <ShieldCheck size={20} className="text-brand-500" />
              <span className="text-xs font-medium text-gray-200">Administración</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 shadow-xs hover:bg-white/10 transition">
              <MessageSquare size={20} className="text-brand-500" />
              <span className="text-xs font-medium text-gray-200">Chat Técnico</span>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 p-3 shadow-xs hover:bg-white/10 transition">
              <MapPin size={20} className="text-brand-500" />
              <span className="text-xs font-medium text-gray-200">Monitoreo GPS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
