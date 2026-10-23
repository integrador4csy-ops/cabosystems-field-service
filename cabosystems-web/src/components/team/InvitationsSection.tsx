import { useSectionResources } from '../../context/SectionResources';
import { teamInvitations } from '../../lib/teamSnapshot';
import { getRoleLabel } from '../../lib/uiTranslations';
import { useTranslation } from '../../context/LanguageContext';
import { useDialog } from '../ui/useDialog';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Invitacion } from '../../types/admin';
import {
  Clock,
  UserPlus,
  Mail,
  Trash2,
  X,
  Check,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import '../AdminUsersModal.css';

interface InvitationsSectionProps {
  active: boolean;
  refreshVersion?: number;
  onOpenInvite?: () => void;
}

export const InvitationsSection: React.FC<InvitationsSectionProps> = ({
  active,
  refreshVersion = 0,
  onOpenInvite,
}) => {
  const { t, locale } = useTranslation();
  const resources = useSectionResources();
  const cached = resources.queries.read<Invitacion[]>('invitations');
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const hasLoaded = useRef(Boolean(cached));
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [globalBanner, setGlobalBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Confirm Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    confirmVariant: 'danger' | 'warning';
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmLabel: '',
    confirmVariant: 'danger',
    onConfirm: () => {},
  });
  const [confirmLoading, setConfirmLoading] = useState(false);

  const loadData = useCallback(async (force = true) => {
    if (!hasLoaded.current) setLoading(true);
    try {
      const data = await resources.queries.load('invitations', teamInvitations, force);
      if (data) { setInvitaciones(data as Invitacion[]); hasLoaded.current = true; }
    } catch (e: any) {
      console.error('Error fetching invitations:', e);
      setGlobalBanner({
        type: 'error',
        text: t("Error al cargar invitaciones: {value0}", { value0: e?.message || e }),
      });
    } finally {
      setLoading(false);
      resources.markReady();
    }
  }, [t, resources]);

  useEffect(() => {
    if (active) {
      void loadData(refreshVersion > 0);
      setGlobalBanner(null);
      const focus = () => { if (document.visibilityState === 'visible') void loadData(false); };
      window.addEventListener('focus', focus);
      return () => window.removeEventListener('focus', focus);
    }
  }, [active, refreshVersion, loadData]);

  const pendingInvitations = invitaciones.filter((inv) => inv.estado === 'pendiente');
  const confirmDialogRef = useDialog(confirmModal.isOpen, () => { if (!confirmLoading) setConfirmModal((previous) => ({ ...previous, isOpen: false })); });


  // Reenviar correo de invitación existente
  const handleResendInvite = async (inv: Invitacion) => {
    setResendingInviteId(inv.id);
    try {
      const { error: fnErr } = await supabase.functions.invoke('invite-colaborador', {
        body: { email: inv.email, rol: inv.rol, token: inv.token, resendOnly: true },
      });

      if (fnErr) throw new Error(fnErr.message);

      setGlobalBanner({
        type: 'success',
        text: t("Correo de invitación reenviado automáticamente a {value0}.", { value0: inv.email }),
      });
    } catch (err: any) {
      console.error('Error al reenviar invitación:', err);
      setGlobalBanner({
        type: 'error',
        text: t("Error al reenviar correo: {value0}.", { value0: err?.message || 'No se pudo conectar con el servidor de correo' }),
      });
    } finally {
      setResendingInviteId(null);
    }
  };

  // Revocar invitación
  const handleRevokeInvite = (invite: Invitacion) => {
    setConfirmModal({
      isOpen: true,
      title: t("¿Revocar Invitación y Anular Enlace?"),
      message: t("¿Deseas cancelar la invitación pendiente para {value0}? El enlace enviado quedará invalidado de inmediato y ya no podrá ser utilizado para registrarse.", { value0: invite.email }),
      confirmLabel: t("Sí, Revocar y Anular Enlace"),
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          try {
            await supabase.functions.invoke('invite-colaborador', {
              body: { email: invite.email, action: 'revoke' },
            });
          } catch (e) {
            console.warn('Error en función revoke:', e);
          }

          const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_revocar_invitacion', {
            p_invite_id: invite.id,
          });

          if (rpcErr || (rpcData && !rpcData.success)) {
            const { error: directErr } = await supabase
              .from('invitaciones')
              .delete()
              .eq('id', invite.id);

            if (directErr) throw new Error(rpcErr?.message || directErr.message);
          }

          setInvitaciones((prev) => prev.filter((i) => i.id !== invite.id));
          setGlobalBanner({
            type: 'success',
            text: t("Invitación para {value0} cancelada y enlace invalidado.", { value0: invite.email }),
          });
          loadData();
        } catch (err: any) {
          console.error('Error revocando invitación:', err);
          setGlobalBanner({
            type: 'error',
            text: t("Error al revocar invitación: {value0}", { value0: err?.message || err }),
          });
        }
      },
    });
  };

  return (
    <div className="team-section">
      <div className="minimal-modal team-section-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title-row">
            <div>
              <h2 className="admin-modal-title flex items-center gap-2">
                <Clock size={20} className="text-slate-600" />
                {t("Invitaciones Pendientes (")}{pendingInvitations.length})
              </h2>
              <p className="admin-modal-subtitle">
                {t("Enlaces de acceso emitidos para nuevos colaboradores CaboSystems")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenInvite && (
              <button
                className="team-invite-button flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
                onClick={() => {
                  onOpenInvite();
                }}
              >
                <UserPlus size={14} />
                <span>{t("+ Nueva Invitación")}</span>
              </button>
            )}
            <button
              className="refresh-btn"
              onClick={() => void loadData()}
              disabled={loading}
              title={t("Recargar invitaciones")}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="admin-modal-body">
          {globalBanner && (
            <div className={`admin-global-banner ${globalBanner.type}`}>
              {globalBanner.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
              <span className="admin-banner-text">{globalBanner.text}</span>
              <button className="admin-banner-close" onClick={() => setGlobalBanner(null)}>
                <X size={14} />
              </button>
            </div>
          )}

          <div className="admin-tab-pane">
            <div className="admin-users-table-wrapper" tabIndex={0} role="region" aria-label={t("Invitaciones pendientes; desplázate horizontalmente para ver todas las acciones")}>
              <table className="admin-users-table">
                <thead className="sr-only">
                  <tr>
                    <th>{t("Correo Invitado")}</th>
                    <th>{t("Fecha")}</th>
                    <th>{t("Estatus")}</th>
                    <th style={{ textAlign: 'right' }}>{t("Enlace / Acciones")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-table">
                        {loading ? t("Cargando invitaciones...") : t("No hay invitaciones pendientes.")}
                      </td>
                    </tr>
                  ) : (
                    pendingInvitations.map((inv) => {
                      const isPending = inv.estado === 'pendiente';

                      return (
                        <tr key={inv.id}>
                          <td>
                            <div className="flex flex-col gap-1">
                              <div className="invite-email-cell">
                                <Mail size={14} color="currentColor" />
                                <strong>{inv.email}</strong>
                              </div>
                              <div className="pl-5">
                                <span className="role-tag">{getRoleLabel(inv.rol, t)}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="date-tag">
                              {new Date(inv.created_at).toLocaleDateString(locale)}
                            </span>
                          </td>
                          <td>
                            <span className={`status-tag ${isPending ? 'pending' : 'accepted'}`}>
                              {isPending ? t("Pendiente") : t("Aceptada")}
                            </span>
                          </td>
                          <td>
                            <div className="actions-cell">
                              {isPending && (
                                <>
                                  <button
                                    className="action-btn email"
                                    onClick={() => handleResendInvite(inv)}
                                    disabled={resendingInviteId === inv.id}
                                    title={t("Reenviar correo automáticamente con el mismo enlace")}
                                  >
                                    <Mail size={13} className={resendingInviteId === inv.id ? 'spin' : ''} />
                                    <span>{resendingInviteId === inv.id ? t("Reenviando...") : t("Reenviar Mail")}</span>
                                  </button>
                                  <button
                                    className="action-btn delete"
                                    onClick={() => handleRevokeInvite(inv)}
                                    title={t("Revocar invitación y anular enlace")}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal Confirmación */}
        {confirmModal.isOpen && (
          <div
            className="admin-confirm-backdrop"
            onClick={() => !confirmLoading && setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
          >
            <div ref={confirmDialogRef} role="dialog" aria-modal="true" aria-label={t("Confirmar acción")} tabIndex={-1} className="admin-confirm-card" onClick={(e) => e.stopPropagation()}>
              <div className={`confirm-icon-badge ${confirmModal.confirmVariant}`}>
                <AlertTriangle size={28} />
              </div>
              <h3 className="confirm-title">{confirmModal.title}</h3>
              <p className="confirm-message">{confirmModal.message}</p>

              <div className="confirm-actions-row">
                <button
                  type="button"
                  className="confirm-btn-cancel"
                  disabled={confirmLoading}
                  onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                >
                  {t("Cancelar")}</button>
                <button
                  type="button"
                  className={`confirm-btn-action ${confirmModal.confirmVariant}`}
                  disabled={confirmLoading}
                  onClick={async () => {
                    setConfirmLoading(true);
                    try {
                      await confirmModal.onConfirm();
                      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                    } finally {
                      setConfirmLoading(false);
                    }
                  }}
                >
                  {confirmLoading ? t("Procesando...") : confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
