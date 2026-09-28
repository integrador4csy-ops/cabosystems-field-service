import React, { useState, useEffect, useCallback } from 'react';
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

interface InvitationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInviteModal?: () => void;
}

export const InvitationsModal: React.FC<InvitationsModalProps> = ({
  isOpen,
  onClose,
  onOpenInviteModal,
}) => {
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(false);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invitaciones')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setInvitaciones(data as Invitacion[]);
    } catch (e: any) {
      console.error('Error fetching invitations:', e);
      setGlobalBanner({
        type: 'error',
        text: `Error al cargar invitaciones: ${e?.message || e}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setGlobalBanner(null);
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

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
        text: `Correo de invitación reenviado automáticamente a ${inv.email}.`,
      });
    } catch (err: any) {
      console.error('Error al reenviar invitación:', err);
      setGlobalBanner({
        type: 'error',
        text: `Error al reenviar correo: ${err?.message || 'No se pudo conectar con el servidor de correo'}.`,
      });
    } finally {
      setResendingInviteId(null);
    }
  };

  // Revocar invitación
  const handleRevokeInvite = (invite: Invitacion) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Revocar Invitación y Anular Enlace?',
      message: `¿Deseas cancelar la invitación pendiente para ${invite.email}? El enlace enviado quedará invalidado de inmediato y ya no podrá ser utilizado para registrarse.`,
      confirmLabel: 'Sí, Revocar y Anular Enlace',
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
            text: `Invitación para ${invite.email} cancelada y enlace invalidado.`,
          });
          loadData();
        } catch (err: any) {
          console.error('Error revocando invitación:', err);
          setGlobalBanner({
            type: 'error',
            text: `Error al revocar invitación: ${err?.message || err}`,
          });
        }
      },
    });
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title-row">
            <div>
              <h2 className="admin-modal-title flex items-center gap-2">
                <Clock size={20} className="text-[#f78c26]" />
                Invitaciones Pendientes ({invitaciones.length})
              </h2>
              <p className="admin-modal-subtitle">
                Enlaces de acceso emitidos para nuevos colaboradores CaboSystems
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenInviteModal && (
              <button
                className="flex items-center gap-1.5 rounded-xl bg-[#f78c26] hover:bg-[#e07412] text-white px-3 py-1.5 text-xs font-bold shadow-2xs transition-colors"
                onClick={() => {
                  onClose();
                  onOpenInviteModal();
                }}
              >
                <UserPlus size={14} />
                <span>+ Nueva Invitación</span>
              </button>
            )}
            <button
              className="refresh-btn"
              onClick={loadData}
              disabled={loading}
              title="Recargar invitaciones"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
            <button className="admin-modal-close" onClick={onClose} title="Cerrar modal">
              <X size={18} />
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
            <div className="admin-users-table-wrapper">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>Correo Invitado</th>
                    <th>Fecha</th>
                    <th>Estatus</th>
                    <th style={{ textAlign: 'right' }}>Enlace / Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {invitaciones.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="empty-table">
                        {loading ? 'Cargando invitaciones...' : 'No hay invitaciones registradas actualmente.'}
                      </td>
                    </tr>
                  ) : (
                    invitaciones.map((inv) => {
                      const isPending = inv.estado === 'pendiente';

                      return (
                        <tr key={inv.id}>
                          <td>
                            <div className="flex flex-col gap-1">
                              <div className="invite-email-cell">
                                <Mail size={14} color="#f78c26" />
                                <strong>{inv.email}</strong>
                              </div>
                              <div className="pl-5">
                                <span className="role-tag">{inv.rol.replace(/_/g, ' ')}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="date-tag">
                              {new Date(inv.created_at).toLocaleDateString()}
                            </span>
                          </td>
                          <td>
                            <span className={`status-tag ${isPending ? 'pending' : 'accepted'}`}>
                              {isPending ? 'Pendiente' : 'Aceptada'}
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
                                    title="Reenviar correo automáticamente con el mismo enlace"
                                  >
                                    <Mail size={13} className={resendingInviteId === inv.id ? 'spin' : ''} />
                                    <span>{resendingInviteId === inv.id ? 'Reenviando...' : 'Reenviar Mail'}</span>
                                  </button>
                                  <button
                                    className="action-btn delete"
                                    onClick={() => handleRevokeInvite(inv)}
                                    title="Revocar invitación y anular enlace"
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
            <div className="admin-confirm-card" onClick={(e) => e.stopPropagation()}>
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
                  Cancelar
                </button>
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
                  {confirmLoading ? 'Procesando...' : confirmModal.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
