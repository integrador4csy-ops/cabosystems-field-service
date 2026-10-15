import { getRoleLabel } from '../../lib/uiTranslations';
import { useTranslation } from '../../context/LanguageContext';
import { useDialog } from '../ui/useDialog';
import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RoleSelect } from '../ui/RoleSelect';
import {
  UserPlus,
  X,
  Check,
  Copy,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import '../AdminUsersModal.css';

interface InviteUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInviteCreated?: () => void;
}

export const InviteUserModal: React.FC<InviteUserModalProps> = ({
  isOpen,
  onClose,
  onInviteCreated,
}) => {
  const { t } = useTranslation();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('aux_instalacion');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<{ email: string; token: string; rol: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);



  const dialogRef = useDialog(isOpen, () => { if (!sendingInvite) onClose(); });
  if (!isOpen) return null;

  const handleOpenEmailClient = (email: string, token: string, rol: string) => {
    const directLink = `cabosystemsmobile://register?token=${token}&email=${encodeURIComponent(email)}`;
    const subject = encodeURIComponent(t('invite.emailSubject'));
    const body = encodeURIComponent(
      t('invite.emailBody', { role: getRoleLabel(rol, t), link: directLink, token })
    );

    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setCopiedLink(false);
    setSuccessBanner(null);

    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInviteError(t("Por favor ingresa un correo electrónico corporativo válido."));
      return;
    }

    setSendingInvite(true);
    try {
      const { data: existingProfiles } = await supabase
        .from('profiles')
        .select('id, nombre, email, activo')
        .ilike('email', cleanEmail)
        .eq('activo', true)
        .limit(1);

      if (existingProfiles && existingProfiles.length > 0) {
        setInviteError(
          t("El correo {value0} ya pertenece a un colaborador activo ({value1}).", { value0: cleanEmail, value1: existingProfiles[0].nombre || 'Colaborador' })
        );
        setSendingInvite(false);
        return;
      }

      let createdToken = '';
      let emailSentAutomatically = false;

      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_crear_invitacion', {
        p_email: cleanEmail,
        p_rol: inviteRole,
      });

      if (!rpcErr && rpcData?.success) {
        createdToken = rpcData.token;
      } else {
        const generatedTokenHex = Array.from({ length: 32 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join('');

        const { error: insertErr } = await supabase
          .from('invitaciones')
          .insert({
            email: cleanEmail,
            rol: inviteRole,
            token: generatedTokenHex,
            estado: 'pendiente',
          })
          .select()
          .single();

        if (insertErr) throw new Error(rpcErr?.message || insertErr.message);
        createdToken = generatedTokenHex;
      }

      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('invite-colaborador', {
          body: { email: cleanEmail, rol: inviteRole, token: createdToken },
        });
        if (!fnErr && fnData?.success) emailSentAutomatically = true;
      } catch {
        // Enlace persistido en BD
      }

      const inviteLink = `cabosystemsmobile://register?token=${createdToken}&email=${encodeURIComponent(cleanEmail)}`;
      setGeneratedLink(inviteLink);
      setGeneratedInvite({
        email: cleanEmail,
        token: createdToken,
        rol: inviteRole,
      });
      setInviteEmail('');
      setSuccessBanner(
        emailSentAutomatically
          ? t("¡Invitación enviada automáticamente a {value0} vía correo corporativo!", { value0: cleanEmail })
          : t("Invitación registrada para {value0}. Puedes compartir el enlace directo de activación.", { value0: cleanEmail })
      );
      onInviteCreated?.();
    } catch (err: any) {
      console.error('Error al generar invitación:', err);
      setInviteError(err?.message || t("Error al generar la invitación."));
    } finally {
      setSendingInvite(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={() => { if (!sendingInvite) onClose(); }}>
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("Nueva invitación")} tabIndex={-1}
        className="minimal-modal admin-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title-row">
            <div>
              <h2 className="admin-modal-title flex items-center gap-2">
                <UserPlus size={20} className="text-slate-600" />
                {t("Invitar Nuevo Colaborador")}</h2>
              <p className="admin-modal-subtitle">
                {t("Emisión de credenciales y activación para equipo técnico CaboSystems")}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={sendingInvite} className="admin-modal-close" aria-label={t("Cerrar invitación")}><X size={18} /></button>
        </div>

        {/* Modal Body */}
        <div className="admin-modal-body">
          {/* Feedback Banners */}
          {successBanner && (
            <div className="admin-global-banner success">
              <Check size={16} />
              <span className="admin-banner-text">{successBanner}</span>
              <button className="admin-banner-close" onClick={() => setSuccessBanner(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {inviteError && (
            <div className="admin-global-banner error">
              <AlertCircle size={16} />
              <span className="admin-banner-text">{t(inviteError)}</span>
              <button className="admin-banner-close" onClick={() => setInviteError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="form-field">
              <label>{t("Correo Electrónico Corporativo")}</label>
              <input
                type="email"
                  placeholder={t('ejemplo: tecnico@csy.mx')}
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>

            {/* Custom Role Selector */}
            <div className="form-field">
              <label>{t("Rol Asignado")}</label>
              <RoleSelect
                value={inviteRole}
                onChange={(val) => setInviteRole(val)}
              />
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={sendingInvite}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-500 hover:bg-brand-700 px-4 text-xs font-semibold text-white shadow-md transition-all transform  disabled:opacity-60 cursor-pointer"
              >
                {sendingInvite ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    {t("Generando Enlace Oficial...")}</span>
                ) : (
                  <>
                    <UserPlus size={16} strokeWidth={2.5} />
                    <span>{t("Generar Invitación y Enlace")}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Generated Link Card */}
          {generatedLink && generatedInvite && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-500 text-white shadow-xs">
                  <Check size={13} strokeWidth={3} />
                </div>
                <strong className="text-xs font-semibold text-slate-600">
                  {t("¡Invitación generada exitosamente!")}</strong>
              </div>
              <p className="text-[11.5px] text-slate-600 mb-3">
                {t("El colaborador")}{' '}<strong>{generatedInvite.email}</strong> {t("ya puede registrarse usando el siguiente enlace:")}</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="h-9.5 flex-1 rounded-lg border border-slate-200 bg-white px-3 font-mono text-[11px] text-slate-700 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(generatedLink)}
                  className="flex h-9.5 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:text-slate-600 hover:border-slate-200 shadow-2xs transition-colors shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check size={14} className="text-slate-600" />
                      <span className="text-slate-600">{t("Copiado")}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>{t("Copiar")}</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleOpenEmailClient(
                      generatedInvite.email,
                      generatedInvite.token,
                      generatedInvite.rol
                    )
                  }
                  title={t("Abrir tu cliente de correo con el mensaje listo")}
                  className="flex h-9.5 items-center gap-1.5 rounded-lg bg-slate-50 hover:bg-slate-50 border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition-colors shrink-0"
                >
                  <ExternalLink size={14} />
                  <span>{t("Enviar Mail")}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
