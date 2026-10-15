import { useTranslation } from '../../context/LanguageContext';
import React, { useState } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Lock, Mail, Eye, EyeOff, AlertCircle } from 'lucide-react';
import '../AdminUsersModal.css';

export const AdminLoginModal: React.FC = () => {
  const { t } = useTranslation();
  const { isLoginModalOpen, login, user } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isLoginModalOpen && user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage(t("Por favor ingresa tu correo y contraseña."));
      return;
    }

    setLoading(true);
    const result = await login(email, password);
    setLoading(false);

    if (!result.success) {
      setErrorMessage(
        result.error === 'Invalid login credentials'
          ? t("Credenciales inválidas. Revisa tu correo y contraseña.")
          : result.error || t("Error al iniciar sesión de administrador.")
      );
    }
  };

  return (
    <div className="admin-modal-backdrop">
      <div
        className="minimal-modal admin-modal-card max-w-[650px] shadow-2xl border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header with Official Logo */}
        <div className="px-8 pt-8 pb-5 text-center border-b border-slate-100 bg-gradient-to-b from-slate-50/70 to-white">
          <div className="mx-auto mb-4 flex items-center justify-center">
            <img
              src="/logo-cabosystems-light.svg"
              alt="CaboSystems Field Service"
              className="h-16 w-auto max-w-[280px] object-contain"
            />
          </div>
          <h2 className="text-lg font-semibold text-[#343e48] tracking-tight">
            {t("Acceso de Administrador")}</h2>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {t("GPS Satelital & Operaciones CaboSystems")}</p>
        </div>

        {/* Modal Body */}
        <div className="p-7">
          {errorMessage && (
            <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800 animate-in fade-in duration-200">
              <AlertCircle size={17} className="text-rose-600 shrink-0" />
              <span className="flex-1 text-xs">{t(errorMessage)}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="form-field">
              <label className="text-[13px] font-semibold text-slate-700">
                {t("Correo Electrónico Corporativo")}</label>
              <div className="field-icon-wrapper">
                <span className="field-icon-left">
                  <Mail size={17} />
                </span>
                <input
                  type="email"
                  placeholder="admin@csy.mx"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="h-12! text-[13.5px]!"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="form-field">
              <label className="text-[13px] font-semibold text-slate-700">
                {t("Contraseña")}</label>
              <div className="field-icon-wrapper has-right-icon">
                <span className="field-icon-left">
                  <Lock size={17} />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-12! text-[13.5px]!"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="field-icon-right"
                  title={showPassword ? t("Ocultar contraseña") : t("Ver contraseña")}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            
           

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-brand-500 hover:bg-brand-700 px-5 text-[13.5px] font-semibold text-white shadow-md transition-all transform  disabled:opacity-60 cursor-pointer"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {t("Validando Credenciales...")}</span>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>{t("Iniciar Sesión de Administrador")}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
