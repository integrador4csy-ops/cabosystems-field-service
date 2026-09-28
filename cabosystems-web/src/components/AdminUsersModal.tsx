import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/fleet';
import {
  Users,
  UserPlus,
  Mail,
  Edit2,
  Trash2,
  X,
  Check,
  Copy,
  Clock,
  UserX,
  UserCheck,
  Search,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import './AdminUsersModal.css';

interface Invitacion {
  id: string;
  email: string;
  rol: string;
  token: string;
  estado: string;
  created_at: string;
}

const ROLES_LIST = [
  { id: 'admin', label: 'Administrador' },
  { id: 'supervisor_instalacion', label: 'Supervisor Instalación' },
  { id: 'instalador', label: 'Técnico Instalador' },
  { id: 'aux_instalacion', label: 'Auxiliar Instalación' },
  { id: 'integrador', label: 'Especialista Integrador' },
  { id: 'aux_integracion', label: 'Auxiliar Integración' },
  { id: 'infraestructura', label: 'Infraestructura' },
  { id: 'aux_infraestructura', label: 'Auxiliar Infraestructura' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'aux_servicios', label: 'Auxiliar Servicios' },
  { id: 'aux_operaciones', label: 'Auxiliar Operaciones' },
];

interface AdminUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserListChanged?: () => void;
}

export const AdminUsersModal: React.FC<AdminUsersModalProps> = ({
  isOpen,
  onClose,
  onUserListChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'invites' | 'new-invite'>('users');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invitaciones, setInvitaciones] = useState<Invitacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Mensaje de notificación global
  const [globalBanner, setGlobalBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Formulario Invitar
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('aux_instalacion');
  const [sendingInvite, setSendingInvite] = useState(false);
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [generatedInvite, setGeneratedInvite] = useState<{ email: string; token: string; rol: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Formulario Editar
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState('');
  const [editActivo, setEditActivo] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);

  // Modal de Confirmación Corporativo
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

  // Cargar datos de usuarios e invitaciones
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profilesRes, invitesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('invitaciones').select('*').order('created_at', { ascending: false }),
      ]);

      if (profilesRes.data) {
        setProfiles(profilesRes.data as Profile[]);
      }
      if (invitesRes.data) {
        setInvitaciones(invitesRes.data as Invitacion[]);
      }
    } catch (e: any) {
      console.error('Error fetching admin data:', e);
      setGlobalBanner({
        type: 'error',
        text: `Error al cargar datos del sistema: ${e?.message || e}`,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadData();
      setGeneratedLink(null);
      setGeneratedInvite(null);
      setInviteError(null);
      setGlobalBanner(null);
    }
  }, [isOpen, loadData]);

  if (!isOpen) return null;

  // 1. Enviar / Generar Invitación
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setCopiedLink(false);

    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInviteError('Por favor ingresa un correo electrónico válido.');
      return;
    }

    // Validación A: ¿El correo ya pertenece a un colaborador activo?
    const existingActive = profiles.find(
      (p) => (p.email || '').toLowerCase() === cleanEmail && p.activo !== false
    );
    if (existingActive) {
      setInviteError(
        `El correo ${cleanEmail} ya pertenece a un colaborador activo en el sistema (${existingActive.nombre || 'Colaborador'}).`
      );
      return;
    }

    // Validación B: ¿Ya existe una invitación pendiente para este correo?
    const existingPending = invitaciones.find(
      (inv) => inv.email.toLowerCase() === cleanEmail && inv.estado === 'pendiente'
    );
    if (existingPending) {
      setInviteError(
        `Ya existe una invitación pendiente para ${cleanEmail} en la pestaña "Invitaciones". Puedes reenviarle el correo desde esa pestaña sin generar una nueva.`
      );
      return;
    }

    setSendingInvite(true);
    try {
      let createdToken = '';
      let emailSentAutomatically = false;

      // 1. Registrar la invitación en base de datos para la app móvil y obtener token
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_crear_invitacion', {
        p_email: cleanEmail,
        p_rol: inviteRole,
      });

      if (!rpcErr && rpcData?.success) {
        createdToken = rpcData.token;
      } else {
        // Fallback: Inserción directa en tabla invitaciones
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

        if (insertErr) {
          const detail = rpcErr?.message || insertErr.message;
          throw new Error(detail);
        }

        createdToken = generatedTokenHex;
      }

      // 2. Disparar envío automático mediante Edge Function con SMTP vinculando el token
      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('invite-colaborador', {
          body: { email: cleanEmail, rol: inviteRole, token: createdToken },
        });
        if (!fnErr && fnData?.success) {
          emailSentAutomatically = true;
        }
      } catch {
        // Si la Edge Function no está disponible, el link queda registrado en BD
      }

      const inviteLink = `cabosystemsmobile://register?token=${createdToken}&email=${encodeURIComponent(cleanEmail)}`;
      setGeneratedLink(inviteLink);
      setGeneratedInvite({
        email: cleanEmail,
        token: createdToken,
        rol: inviteRole,
      });
      setInviteEmail('');
      setGlobalBanner({
        type: 'success',
        text: emailSentAutomatically
          ? `¡Invitación enviada automáticamente a ${cleanEmail} por correo corporativo!`
          : `Invitación registrada para ${cleanEmail}. Puedes copiar el link o enviarlo por correo.`,
      });
      loadData();
    } catch (err: any) {
      console.error('Error al generar invitación:', err);
      setInviteError(err?.message || 'Error al generar la invitación.');
    } finally {
      setSendingInvite(false);
    }
  };

  // Función para abrir cliente de correo con la invitación redactada
  const handleOpenEmailClient = (email: string, token: string, rol: string) => {
    const roleLabel = ROLES_LIST.find((r) => r.id === rol)?.label || rol;
    const directLink = `cabosystemsmobile://register?token=${token}&email=${encodeURIComponent(email)}`;
    
    const subject = encodeURIComponent('Invitación al equipo de campo · CaboSystems Field Service');
    const body = encodeURIComponent(
      `Hola,\n\nHas sido registrado e invitado para unirte al equipo de operaciones de CaboSystems como: ${roleLabel}.\n\nPara activar tu cuenta y configurar tu contraseña y foto de perfil en la aplicación móvil, haz clic en el siguiente enlace desde tu teléfono móvil:\n\n${directLink}\n\nSi abres la app manualmente, puedes validar tu registro con tu código de invitación:\n${token}\n\nAtentamente,\nDirección de Operaciones · CaboSystems`
    );

    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  // Reenviar correo de invitación existente automáticamente (conserva el mismo token)
  const handleResendInvite = async (inv: Invitacion) => {
    setResendingInviteId(inv.id);
    try {
      const { error: fnErr } = await supabase.functions.invoke('invite-colaborador', {
        body: { email: inv.email, rol: inv.rol, token: inv.token, resendOnly: true },
      });

      if (fnErr) {
        throw new Error(fnErr.message);
      }

      setGlobalBanner({
        type: 'success',
        text: `Correo de invitación reenviado automáticamente a ${inv.email} con su enlace oficial de activación.`,
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

  // Copiar al portapapeles
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Iniciar edición de usuario
  const startEdit = (user: Profile) => {
    setEditingUser(user);
    setEditNombre(user.nombre || '');
    setEditRol(user.rol || 'aux_instalacion');
    setEditActivo(user.activo !== false);
  };

  // Guardar edición
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      // Intento 1: RPC admin_editar_colaborador
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_editar_colaborador', {
        p_user_id: editingUser.id,
        p_nombre: editNombre.trim(),
        p_rol: editRol,
        p_activo: editActivo,
      });

      if (rpcErr || (rpcData && !rpcData.success)) {
        // Fallback: update directo
        const { error: directErr } = await supabase
          .from('profiles')
          .update({
            nombre: editNombre.trim(),
            rol: editRol,
            activo: editActivo,
          })
          .eq('id', editingUser.id);

        if (directErr) {
          throw new Error(rpcErr?.message || directErr.message);
        }
      }

      setGlobalBanner({
        type: 'success',
        text: `Datos de ${editNombre.trim() || 'colaborador'} actualizados correctamente.`,
      });
      setEditingUser(null);
      loadData();
      onUserListChanged?.();
    } catch (err: any) {
      console.error('Error guardando edición:', err);
      setGlobalBanner({
        type: 'error',
        text: `Error al actualizar usuario: ${err?.message || err}`,
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // 2. Expulsar y eliminar definitivamente al usuario
  const handleExpelUser = (user: Profile) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Expulsar Colaborador?',
      message: `¿Estás seguro de que deseas expulsar y eliminar a ${user.nombre || user.email || 'este usuario'}? Su cuenta será borrada del sistema y desaparecerá por completo de la lista de colaboradores.`,
      confirmLabel: 'Sí, Expulsar Definitivamente',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          // Intento 1: RPC admin_expulsar_colaborador
          const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_expulsar_colaborador', {
            p_user_id: user.id,
          });

          if (rpcErr || (rpcData && !rpcData.success)) {
            // Fallback directo: borrar telemetría y borrar perfil
            await supabase
              .from('ubicaciones_usuarios')
              .delete()
              .eq('usuario_id', user.id);

            const { error: profErr } = await supabase
              .from('profiles')
              .delete()
              .eq('id', user.id);

            if (profErr) {
              throw new Error(rpcErr?.message || profErr.message);
            }
          }

          // Eliminar del estado local inmediatamente para que DESAPAREZCA de la tabla
          setProfiles((prev) => prev.filter((p) => p.id !== user.id));

          setGlobalBanner({
            type: 'success',
            text: `El colaborador ${user.nombre || user.email || 'seleccionado'} ha sido expulsado y eliminado del sistema.`,
          });

          loadData();
          onUserListChanged?.();
        } catch (err: any) {
          console.error('Error expulsando usuario:', err);
          setGlobalBanner({
            type: 'error',
            text: `Error al expulsar colaborador: ${err?.message || err}`,
          });
        }
      },
    });
  };

  // 3. Reactivar usuario
  const handleReactivateUser = async (user: Profile) => {
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_reactivar_colaborador', {
        p_user_id: user.id,
      });

      if (rpcErr || (rpcData && !rpcData.success)) {
        const { error: directErr } = await supabase
          .from('profiles')
          .update({ activo: true })
          .eq('id', user.id);

        if (directErr) {
          throw new Error(rpcErr?.message || directErr.message);
        }
      }

      setProfiles((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, activo: true } : p))
      );

      setGlobalBanner({
        type: 'success',
        text: `Acceso reactivado para ${user.nombre || 'el colaborador'}.`,
      });

      loadData();
      onUserListChanged?.();
    } catch (err: any) {
      console.error('Error reactivando usuario:', err);
      setGlobalBanner({
        type: 'error',
        text: `Error al reactivar usuario: ${err?.message || err}`,
      });
    }
  };

  // 4. Revocar invitación pendiente y anular enlace
  const handleRevokeInvite = (invite: Invitacion) => {
    setConfirmModal({
      isOpen: true,
      title: '¿Revocar Invitación y Anular Enlace?',
      message: `¿Deseas cancelar la invitación pendiente para ${invite.email}? El enlace enviado quedará invalidado de inmediato y ya no podrá ser utilizado para registrarse.`,
      confirmLabel: 'Sí, Revocar y Anular Enlace',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          // 1. Notificar a la Edge Function para purgar cuenta temporal en auth.users
          try {
            await supabase.functions.invoke('invite-colaborador', {
              body: { email: invite.email, action: 'revoke' },
            });
          } catch (e) {
            console.warn('Error en función revoke:', e);
          }

          // 2. Eliminar de la tabla invitaciones
          const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_revocar_invitacion', {
            p_invite_id: invite.id,
          });

          if (rpcErr || (rpcData && !rpcData.success)) {
            const { error: directErr } = await supabase
              .from('invitaciones')
              .delete()
              .eq('id', invite.id);

            if (directErr) {
              throw new Error(rpcErr?.message || directErr.message);
            }
          }

          setInvitaciones((prev) => prev.filter((i) => i.id !== invite.id));

          setGlobalBanner({
            type: 'success',
            text: `Invitación para ${invite.email} cancelada. El enlace ha quedado revocado e invalidado.`,
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

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.rol || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  });

  const pendingInvites = invitaciones.filter((i) => i.estado === 'pendiente');

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title-row">
            <div>
              <h2 className="admin-modal-title">Gestión de Personal y Accesos</h2>
              <p className="admin-modal-subtitle">
                Panel de control de administradores · CaboSystems
              </p>
            </div>
          </div>
          <button className="admin-modal-close" onClick={onClose} title="Cerrar modal">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="admin-modal-tabs-bar">
          <div className="admin-modal-tabs">
            <button
              className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('users');
                setGlobalBanner(null);
              }}
            >
              <Users size={15} />
              <span>Colaboradores ({profiles.length})</span>
            </button>
            <button
              className={`admin-tab ${activeTab === 'invites' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('invites');
                setGlobalBanner(null);
              }}
            >
              <Clock size={15} />
              <span>Invitaciones ({pendingInvites.length})</span>
            </button>
            <button
              className={`admin-tab ${activeTab === 'new-invite' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('new-invite');
                setGlobalBanner(null);
              }}
            >
              <UserPlus size={15} />
              <span>+ Invitar Colaborador</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="admin-modal-body">
          {/* Global feedback banner */}
          {globalBanner && (
            <div className={`admin-global-banner ${globalBanner.type}`}>
              {globalBanner.type === 'error' ? (
                <AlertCircle size={16} />
              ) : (
                <Check size={16} />
              )}
              <span className="admin-banner-text">{globalBanner.text}</span>
              <button
                className="admin-banner-close"
                onClick={() => setGlobalBanner(null)}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* TAB 1: LISTA DE COLABORADORES */}
          {activeTab === 'users' && (
            <div className="admin-tab-pane">
              <div className="admin-search-bar">
                <Search size={15} className="search-icon" />
                <input
                  type="text"
                  placeholder="Buscar colaborador por nombre o rol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button className="clear-search" onClick={() => setSearchQuery('')}>
                    <X size={13} />
                  </button>
                )}
                <button
                  className="refresh-btn"
                  onClick={loadData}
                  disabled={loading}
                  title="Recargar datos"
                >
                  <RefreshCw size={14} className={loading ? 'spin' : ''} />
                </button>
              </div>

              <div className="admin-users-table-wrapper">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Rol</th>
                      <th>Estatus</th>
                      <th style={{ textAlign: 'right' }}>Acciones de Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProfiles.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="empty-table">
                          {loading ? 'Cargando colaboradores...' : 'No se encontraron colaboradores registrados.'}
                        </td>
                      </tr>
                    ) : (
                      filteredProfiles.map((user) => {
                        const isInactive = user.activo === false;
                        const initials = (user.nombre || 'CS')
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .join('')
                          .substring(0, 2)
                          .toUpperCase();

                        return (
                          <tr key={user.id} className={isInactive ? 'row-inactive' : ''}>
                            <td>
                              <div className="user-cell">
                                <div className="user-cell-avatar">
                                  {user.avatar_url ? (
                                    <img src={user.avatar_url} alt={user.nombre || ''} />
                                  ) : (
                                    <div className="avatar-fallback">{initials}</div>
                                  )}
                                </div>
                                <div className="user-cell-info">
                                  <div className="user-name">{user.nombre}</div>
                                  <div className="user-email">{user.email || user.id.substring(0, 8)}</div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="role-tag">
                                {(user.rol || 'aux_instalacion').replace('_', ' ')}
                              </span>
                            </td>
                            <td>
                              <span className={`status-tag ${isInactive ? 'inactive' : 'active'}`}>
                                {isInactive ? 'Inactivo / Expulsado' : 'Activo'}
                              </span>
                            </td>
                            <td>
                              <div className="actions-cell">
                                <button
                                  className="action-btn edit"
                                  onClick={() => startEdit(user)}
                                  title="Editar datos del colaborador"
                                >
                                  <Edit2 size={13} />
                                  <span>Editar</span>
                                </button>

                                {isInactive && (
                                  <button
                                    className="action-btn reactivate"
                                    onClick={() => handleReactivateUser(user)}
                                    title="Reactivar acceso al sistema"
                                  >
                                    <UserCheck size={13} />
                                    <span>Reactivar</span>
                                  </button>
                                )}

                                <button
                                  className="action-btn expel"
                                  onClick={() => handleExpelUser(user)}
                                  title="Expulsar y eliminar definitivamente del sistema"
                                >
                                  <UserX size={13} />
                                  <span>Expulsar</span>
                                </button>
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
          )}

          {/* TAB 2: INVITACIONES PENDIENTES */}
          {activeTab === 'invites' && (
            <div className="admin-tab-pane">
              <div className="invites-header-row">
                <p className="invites-desc">
                  Invitaciones generadas para nuevos colaboradores pendientes de completar registro en la app.
                </p>
                <button className="primary-sm-btn" onClick={() => setActiveTab('new-invite')}>
                  <UserPlus size={14} /> Nueva Invitación
                </button>
              </div>

              <div className="admin-users-table-wrapper">
                <table className="admin-users-table">
                  <thead>
                    <tr>
                      <th>Correo Invitado</th>
                      <th>Rol Asignado</th>
                      <th>Fecha</th>
                      <th>Estatus</th>
                      <th style={{ textAlign: 'right' }}>Enlace / Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invitaciones.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="empty-table">
                          {loading ? 'Cargando invitaciones...' : 'No hay invitaciones registradas.'}
                        </td>
                      </tr>
                    ) : (
                      invitaciones.map((inv) => {
                        const isPending = inv.estado === 'pendiente';

                        return (
                          <tr key={inv.id}>
                            <td>
                              <div className="invite-email-cell">
                                <Mail size={14} color="#f78c26" />
                                <strong>{inv.email}</strong>
                              </div>
                            </td>
                            <td>
                              <span className="role-tag">{inv.rol.replace('_', ' ')}</span>
                            </td>
                            <td>
                              <span className="date-tag">
                                {new Date(inv.created_at).toLocaleDateString()}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`status-tag ${isPending ? 'pending' : 'accepted'}`}
                              >
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
          )}

          {/* TAB 3: NUEVA INVITACIÓN */}
          {activeTab === 'new-invite' && (
            <div className="admin-tab-pane">
              <form className="invite-form" onSubmit={handleSendInvite}>
                <h3 className="form-heading">Enviar Invitación a Nuevo Colaborador</h3>
                <p className="form-subheading">
                  El colaborador recibirá un enlace directo a la aplicación móvil donde podrá elegir su foto de perfil y contraseña.
                </p>

                {inviteError && (
                  <div className="form-error-banner">
                    <AlertCircle size={16} />
                    <span>{inviteError}</span>
                  </div>
                )}

                <div className="form-grid">
                  <div className="form-field">
                    <label>Correo Electrónico del Colaborador</label>
                    <div className="form-input-box">
                      <Mail size={16} className="field-icon" />
                      <input
                        type="email"
                        placeholder="colaborador@csy.mx"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-field">
                    <label>Rol Asignado en CaboSystems</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="form-select"
                    >
                      {ROLES_LIST.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-submit-row">
                  <button
                    type="submit"
                    className="submit-invite-btn"
                    disabled={sendingInvite}
                  >
                    {sendingInvite ? (
                      'Generando Invitación...'
                    ) : (
                      <>
                        <UserPlus size={16} /> Generar Invitación
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Enlace generado con éxito */}
              {generatedLink && generatedInvite && (
                <div className="generated-link-card">
                  <div className="success-header">
                    <Check size={18} color="#10b981" />
                    <strong>¡Invitación generada exitosamente!</strong>
                  </div>
                  <p>
                    El colaborador <strong>{generatedInvite.email}</strong> ya está registrado para unirse. Puedes enviarle el correo con las instrucciones o copiar el enlace:
                  </p>
                  <div className="link-copy-box">
                    <input type="text" readOnly value={generatedLink} />
                    <button
                      className="copy-btn"
                      onClick={() => handleCopy(generatedLink)}
                    >
                      {copiedLink ? (
                        <>
                          <Check size={14} /> Copiado
                        </>
                      ) : (
                        <>
                          <Copy size={14} /> Copiar Link
                        </>
                      )}
                    </button>
                    <button
                      className="send-email-direct-btn"
                      onClick={() =>
                        handleOpenEmailClient(
                          generatedInvite.email,
                          generatedInvite.token,
                          generatedInvite.rol
                        )
                      }
                      title="Abrir tu cliente de correo con el mensaje listo"
                    >
                      <ExternalLink size={14} /> Enviar Mail
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal interno para Editar Usuario */}
        {editingUser && (
          <div className="admin-edit-submodal">
            <div className="admin-edit-card">
              <div className="edit-card-header">
                <h3>Editar Colaborador</h3>
                <button onClick={() => setEditingUser(null)}>
                  <X size={16} />
                </button>
              </div>

              <div className="edit-card-body">
                <div className="form-field">
                  <label>Nombre Completo</label>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                  />
                </div>

                <div className="form-field">
                  <label>Rol Asignado</label>
                  <select
                    value={editRol}
                    onChange={(e) => setEditRol(e.target.value)}
                    className="form-select"
                  >
                    {ROLES_LIST.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-field toggle-field">
                  <label>Estado de Acceso</label>
                  <button
                    type="button"
                    className={`toggle-pill ${editActivo ? 'active' : 'inactive'}`}
                    onClick={() => setEditActivo(!editActivo)}
                  >
                    {editActivo ? 'Permitido (Activo)' : 'Bloqueado (Inactivo)'}
                  </button>
                </div>
              </div>

              <div className="edit-card-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setEditingUser(null)}
                  disabled={savingEdit}
                >
                  Cancelar
                </button>
                <button
                  className="save-btn"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL DE CONFIRMACIÓN CORPORATIVO */}
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
