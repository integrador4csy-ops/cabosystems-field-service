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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('aux_instalacion');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<{ email: string; token: string; rol: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOpenEmailClient = (email: string, token: string, rol: string) => {
    const directLink = `cabosystemsmobile://register?token=${token}&email=${encodeURIComponent(email)}`;
    const subject = encodeURIComponent('Invitación al equipo de campo · CaboSystems Field Service');
    const body = encodeURIComponent(
      `Hola,\n\nHas sido registrado e invitado para unirte al equipo de operaciones de CaboSystems con rol: ${rol}.\n\nPara activar tu cuenta y configurar tu contraseña y foto de perfil en la aplicación móvil, haz clic en el siguiente enlace desde tu teléfono móvil:\n\n${directLink}\n\nSi abres la app manualmente, puedes validar tu registro con tu código de invitación:\n${token}\n\nAtentamente,\nDirección de Operaciones · CaboSystems`
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
      setInviteError('Por favor ingresa un correo electrónico corporativo válido.');
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
          `El correo ${cleanEmail} ya pertenece a un colaborador activo (${existingProfiles[0].nombre || 'Colaborador'}).`
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
          ? `¡Invitación enviada automáticamente a ${cleanEmail} vía correo corporativo!`
          : `Invitación registrada para ${cleanEmail}. Puedes compartir el enlace directo de activación.`
      );
      onInviteCreated?.();
    } catch (err: any) {
      console.error('Error al generar invitación:', err);
      setInviteError(err?.message || 'Error al generar la invitación.');
    } finally {
      setSendingInvite(false);
    }
  };

  const handleClose = () => {
    setGeneratedLink(null);
    setGeneratedInvite(null);
    setInviteError(null);
    setSuccessBanner(null);
    onClose();
  };

  return (
    <div className="admin-modal-backdrop" onClick={handleClose}>
      <div
        className="admin-modal-card max-w-[650px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title-row">
            <div>
              <h2 className="admin-modal-title flex items-center gap-2">
                <UserPlus size={20} className="text-[#f78c26]" />
                Invitar Nuevo Colaborador
              </h2>
              <p className="admin-modal-subtitle">
                Emisión de credenciales y activación para equipo técnico CaboSystems
              </p>
            </div>
          </div>
          <button className="admin-modal-close" onClick={handleClose} title="Cerrar ventana">
            <X size={18} />
          </button>
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
              <span className="admin-banner-text">{inviteError}</span>
              <button className="admin-banner-close" onClick={() => setInviteError(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSendInvite} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="form-field">
              <label>Correo Electrónico Corporativo</label>
              <input
                type="email"
                placeholder="ejemplo: tecnico@csy.mx"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>

            {/* Custom Role Selector */}
            <div className="form-field">
              <label>Rol Asignado</label>
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
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#f78c26] hover:bg-[#e07412] px-4 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-all transform active:scale-[0.99] disabled:opacity-60 cursor-pointer"
              >
                {sendingInvite ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Generando Enlace Oficial...
                  </span>
                ) : (
                  <>
                    <UserPlus size={16} strokeWidth={2.5} />
                    <span>Generar Invitación y Enlace</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Generated Link Card */}
          {generatedLink && generatedInvite && (
            <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                  <Check size={13} strokeWidth={3} />
                </div>
                <strong className="text-xs font-bold text-emerald-900">
                  ¡Invitación generada exitosamente!
                </strong>
              </div>
              <p className="text-[11.5px] text-slate-600 mb-3">
                El colaborador <strong>{generatedInvite.email}</strong> ya puede registrarse usando el siguiente enlace:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedLink}
                  className="h-9.5 flex-1 rounded-xl border border-slate-200 bg-white px-3 font-mono text-[11px] text-slate-700 focus:outline-none select-all"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(generatedLink)}
                  className="flex h-9.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:text-[#f78c26] hover:border-orange-300 shadow-2xs transition-colors shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check size={14} className="text-emerald-600" />
                      <span className="text-emerald-700">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copiar</span>
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
                  title="Abrir tu cliente de correo con el mensaje listo"
                  className="flex h-9.5 items-center gap-1.5 rounded-xl bg-orange-100 hover:bg-orange-200 border border-orange-200 px-3 text-xs font-bold text-[#f78c26] transition-colors shrink-0"
                >
                  <ExternalLink size={14} />
                  <span>Enviar Mail</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
