import { useDialog } from '../ui/useDialog';
import React, { useState, useEffect, useRef } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useLanguage, type SupportedLanguage } from '../../context/LanguageContext';
import { cn } from '../../utils';
import { User, X, Check, UploadCloud, Trash2, AlertCircle, Camera, Globe } from 'lucide-react';
import '../AdminUsersModal.css';

export const AdminEditProfileModal: React.FC = () => {
  const {
    isEditProfileModalOpen,
    setIsEditProfileModalOpen,
    adminProfile,
    updateAdminProfile,
  } = useAdminAuth();

  const { language, setLanguage, t } = useLanguage();

  const [nombre, setNombre] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>(language);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adminProfile) {
      setNombre(adminProfile.nombre || '');
      setAvatarUrl(adminProfile.avatar_url || null);
      setSelectedLang(language);
    }
  }, [adminProfile, isEditProfileModalOpen, language]);

  const dialogRef = useDialog(isEditProfileModalOpen, () => { if (!saving) setIsEditProfileModalOpen(false); });

  if (!isEditProfileModalOpen) return null;

  const handleProcessFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setBanner({ type: 'error', text: t('modal.invalidImage') });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBanner({ type: 'error', text: t('modal.imageTooLarge') });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setAvatarUrl(result);
        setBanner(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setBanner({ type: 'error', text: t('modal.emptyName') });
      return;
    }

    setSaving(true);
    setBanner(null);

    // Guardar preferencia de idioma inmediatamente si cambió
    if (selectedLang !== language) {
      setLanguage(selectedLang);
    }

    const result = await updateAdminProfile({
      nombre: nombre.trim(),
      avatar_url: avatarUrl,
    });

    setSaving(false);

    if (result.success) {
      setBanner({ type: 'success', text: t('modal.saveSuccess') });
      setTimeout(() => {
        setIsEditProfileModalOpen(false);
        setBanner(null);
      }, 1000);
    } else {
      setBanner({ type: 'error', text: result.error || t('modal.saveError') });
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={() => setIsEditProfileModalOpen(false)}>
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("Editar perfil")} tabIndex={-1}
        className="minimal-modal admin-modal-card max-w-[650px] shadow-theme-md border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title-row">
            <div>
              <h2 className="admin-modal-title flex items-center gap-2">
                <User size={19} className="text-slate-600" />
                {t('modal.profileTitle')}
              </h2>
              <p className="admin-modal-subtitle">
                {t('modal.profileSubtitle')}
              </p>
            </div>
          </div>
          <button
            className="admin-modal-close"
            onClick={() => setIsEditProfileModalOpen(false)}
            title={t('modal.cancel')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="admin-modal-body">
          {banner && (
            <div className={`admin-global-banner ${banner.type}`}>
              {banner.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
              <span className="admin-banner-text">{banner.text}</span>
              <button className="admin-banner-close" onClick={() => setBanner(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          <form onSubmit={handleSave} className="flex flex-col gap-4">
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Drag and drop / Device upload box */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#343e48]">
                {t('modal.profilePhoto')}
              </label>

              {avatarUrl ? (
                /* Preview State when a photo is selected */
                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-3.5">
                  <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-xs">
                    <img
                      src={avatarUrl}
                      alt={t("Avatar Preview")}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#343e48] hover:border-slate-200 hover:text-slate-600 shadow-2xs transition-colors cursor-pointer"
                    >
                      <Camera size={13} />
                      <span>{t('modal.changePhoto')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAvatarUrl(null)}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-100 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>{t('modal.deletePhoto')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Dropzone State to upload from device */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-all cursor-pointer ${
                    isDragging
                      ? 'border-slate-600 bg-slate-50'
                      : 'border-slate-200 bg-white hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-50 border border-slate-200 text-slate-600 shadow-2xs">
                    <UploadCloud size={22} />
                  </div>
                  <p className="text-xs font-semibold text-[#343e48]">
                    {t('modal.uploadDropzone')}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {t('modal.uploadHint')}
                  </p>
                </div>
              )}
            </div>

            {/* Name Field */}
            <div className="form-field">
              <label>{t('modal.adminName')}</label>
              <input
                type="text"
                placeholder={t('modal.adminNamePlaceholder')}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
              />
            </div>

            {/* Language Preference Field */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#343e48] flex items-center gap-1.5">
                <Globe size={14} className="text-slate-600" />
                <span>{t('modal.languagePref')}</span>
              </label>
              <p className="text-[11px] text-slate-400">
                {t('modal.languagePrefDesc')}
              </p>
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedLang('es')}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-xs font-semibold transition-all cursor-pointer',
                    selectedLang === 'es'
                      ? 'border-slate-600 bg-slate-50 text-slate-600 shadow-2xs font-semibold'
                      : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300'
                  )}
                >
                  <span className="text-lg">🇲🇽</span>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-semibold truncate">Español</span>
                    <span className="text-[10px] text-slate-400 font-normal">Latinoamérica</span>
                  </div>
                  {selectedLang === 'es' && <Check size={14} className="shrink-0 text-slate-600" />}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedLang('en')}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border p-2.5 text-left text-xs font-semibold transition-all cursor-pointer',
                    selectedLang === 'en'
                      ? 'border-slate-600 bg-slate-50 text-slate-600 shadow-2xs font-semibold'
                      : 'border-slate-200 bg-slate-50/60 text-slate-600 hover:border-slate-300'
                  )}
                >
                  <span className="text-lg">🇺🇸</span>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-semibold truncate">English</span>
                    <span className="text-[10px] text-slate-400 font-normal">United States</span>
                  </div>
                  {selectedLang === 'en' && <Check size={14} className="shrink-0 text-slate-600" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsEditProfileModalOpen(false)}
                className="flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-600 transition-colors cursor-pointer"
              >
                {t('modal.cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-700 px-4 text-xs font-semibold text-white shadow-md transition-all transform  disabled:opacity-60 cursor-pointer"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {t('modal.saving')}
                  </span>
                ) : (
                  <>
                    <Check size={16} />
                    <span>{t('modal.save')}</span>
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
