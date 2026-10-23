import { useSectionResources } from '../../context/SectionResources';
import { teamProfiles } from '../../lib/teamSnapshot';
import { getRoleLabel } from '../../lib/uiTranslations';
import { useTranslation } from '../../context/LanguageContext';
import { useDialog } from '../ui/useDialog';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/fleet';
import { RoleSelect } from '../ui/RoleSelect';
import {
  Users,
  UserPlus,
  Edit2,
  X,
  Check,
  UserX,
  UserCheck,
  Search,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Camera,
  UploadCloud,
  Trash2,
} from 'lucide-react';
import '../AdminUsersModal.css';

interface CollaboratorsSectionProps {
  active: boolean;
  onOpenInvite?: () => void;
  onUserListChanged?: () => void;
}

export const CollaboratorsSection: React.FC<CollaboratorsSectionProps> = ({
  active,
  onOpenInvite,
  onUserListChanged,
}) => {
  const { t } = useTranslation();
  const resources = useSectionResources();
  const cached = resources.queries.read<Profile[]>('collaborators');
  const [profiles, setProfiles] = useState<Profile[]>(cached || []);
  const [loading, setLoading] = useState(!cached);
  const hasLoaded = useRef(Boolean(cached));
  const [searchQuery, setSearchQuery] = useState('');
  const [globalBanner, setGlobalBanner] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Formulario Editar
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editNombre, setEditNombre] = useState('');
  const [editRol, setEditRol] = useState('');
  const [editActivo, setEditActivo] = useState(true);
  const [editAvatarUrl, setEditAvatarUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (force) { resources.queries.invalidate('tasks'); resources.queries.invalidate('directory:true'); resources.queries.invalidate('directory:false'); }
    if (!hasLoaded.current) setLoading(true);
    try {
      const data = await resources.queries.load('collaborators', teamProfiles, force);
      if (data) { setProfiles(data as Profile[]); hasLoaded.current = true; }
    } catch (e: any) {
      console.error('Error fetching profiles:', e);
      setGlobalBanner({
        type: 'error',
        text: t("Error al cargar colaboradores: {value0}", { value0: e?.message || e }),
      });
    } finally {
      setLoading(false);
      resources.markReady();
    }
  }, [t, resources]);

  useEffect(() => {
    if (active) {
      void loadData(false);
      setGlobalBanner(null);
      setEditingUser(null);
      const focus = () => { if (document.visibilityState === 'visible') void loadData(false); };
      window.addEventListener('focus', focus);
      return () => window.removeEventListener('focus', focus);
    }
  }, [active, loadData]);

  const editDialogRef = useDialog(!!editingUser, () => { if (!savingEdit) setEditingUser(null); });
  const confirmDialogRef = useDialog(confirmModal.isOpen, () => { if (!confirmLoading) setConfirmModal((previous) => ({ ...previous, isOpen: false })); });


  // Iniciar edición
  const startEdit = (user: Profile) => {
    setEditingUser(user);
    setEditNombre(user.nombre || '');
    setEditRol(user.rol || 'aux_instalacion');
    setEditActivo(user.activo !== false);
    setEditAvatarUrl(user.avatar_url || null);
  };

  const handleProcessFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setGlobalBanner({ type: 'error', text: t("Por favor selecciona un archivo de imagen válido (PNG, JPG, WEBP).") });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setGlobalBanner({ type: 'error', text: t("La imagen es demasiado grande. Tamaño máximo: 5 MB.") });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) {
        setEditAvatarUrl(result);
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

  // Guardar edición
  const handleSaveEdit = async () => {
    if (!editingUser) return;
    setSavingEdit(true);
    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_editar_colaborador', {
        p_user_id: editingUser.id,
        p_nombre: editNombre.trim(),
        p_rol: editRol,
        p_activo: editActivo,
      });

      const { error: directErr } = await supabase
        .from('profiles')
        .update({
          nombre: editNombre.trim(),
          rol: editRol,
          activo: editActivo,
          avatar_url: editAvatarUrl,
        })
        .eq('id', editingUser.id);

      if (directErr && (rpcErr || (rpcData && !rpcData.success))) {
        throw new Error(rpcErr?.message || directErr.message);
      }

      setGlobalBanner({
        type: 'success',
        text: t("Datos de {value0} actualizados correctamente.", { value0: editNombre.trim() || 'colaborador' }),
      });
      setEditingUser(null);
      loadData();
      onUserListChanged?.();
    } catch (err: any) {
      console.error('Error guardando edición:', err);
      setGlobalBanner({
        type: 'error',
        text: t("Error al actualizar usuario: {value0}", { value0: err?.message || err }),
      });
    } finally {
      setSavingEdit(false);
    }
  };

  // Expulsar y eliminar
  const handleExpelUser = (user: Profile) => {
    setConfirmModal({
      isOpen: true,
      title: t("¿Expulsar Colaborador?"),
      message: t("¿Estás seguro de que deseas expulsar y eliminar a {value0}? Su cuenta será borrada del sistema y desaparecerá por completo de la lista de colaboradores.", { value0: user.nombre || user.email || 'este usuario' }),
      confirmLabel: t("Sí, Expulsar Definitivamente"),
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_expulsar_colaborador', {
            p_user_id: user.id,
          });

          if (rpcErr || (rpcData && !rpcData.success)) {
            await supabase
              .from('ubicaciones_usuarios')
              .delete()
              .eq('usuario_id', user.id);

            const { error: profErr } = await supabase
              .from('profiles')
              .delete()
              .eq('id', user.id);

            if (profErr) throw new Error(rpcErr?.message || profErr.message);
          }

          setProfiles((prev) => prev.filter((p) => p.id !== user.id));
          setGlobalBanner({
            type: 'success',
            text: t("El colaborador {value0} ha sido expulsado del sistema.", { value0: user.nombre || user.email || 'seleccionado' }),
          });
          loadData();
          onUserListChanged?.();
        } catch (err: any) {
          console.error('Error expulsando usuario:', err);
          setGlobalBanner({
            type: 'error',
            text: t("Error al expulsar colaborador: {value0}", { value0: err?.message || err }),
          });
        }
      },
    });
  };

  // Reactivar
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

        if (directErr) throw new Error(rpcErr?.message || directErr.message);
      }

      setProfiles((prev) =>
        prev.map((p) => (p.id === user.id ? { ...p, activo: true } : p))
      );
      setGlobalBanner({
        type: 'success',
        text: t("Acceso reactivado para {value0}.", { value0: user.nombre || 'el colaborador' }),
      });
      loadData();
      onUserListChanged?.();
    } catch (err: any) {
      console.error('Error reactivando usuario:', err);
      setGlobalBanner({
        type: 'error',
        text: t("Error al reactivar usuario: {value0}", { value0: err?.message || err }),
      });
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (p.nombre || '').toLowerCase().includes(q) ||
      (p.rol || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="team-section">
      <div className="minimal-modal team-section-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="admin-modal-header">
          <div className="admin-modal-title-row">
            <div>
              <h2 className="admin-modal-title flex items-center gap-2">
                <Users size={20} className="text-slate-600" />
                {t("Colaboradores Registrados (")}{profiles.length})
              </h2>
              <p className="admin-modal-subtitle">
                {t("Equipo técnico y personal operativo activo en CaboSystems")}</p>
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
                <span>{t("Invitar")}</span>
              </button>
            )}
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
            <div className="admin-search-bar">
              <Search size={15} className="search-icon" />
              <input
                type="text"
                placeholder={t("Buscar colaborador por nombre, correo o rol...")}
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
                onClick={() => void loadData()}
                disabled={loading}
                title={t("Recargar colaboradores")}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>

            <div className="admin-users-table-wrapper" tabIndex={0} role="region" aria-label={t("Tabla de personal; desplázate horizontalmente para ver todas las acciones")}>
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>{t("Colaborador")}</th>
                    <th>{t("Estatus")}</th>
                    <th style={{ textAlign: 'right' }}>{t("Acciones de Control")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="empty-table">
                        {loading
                          ? t("Cargando colaboradores...")
                          : t("No se encontraron colaboradores registrados.")}
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
                                <div className="user-name">{user.nombre || user.email || t("Sin nombre")}</div>
                                <div className="mt-1 flex items-center">
                                  <span className="role-tag">
                                    {getRoleLabel(user.rol || 'aux_instalacion', t)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`status-tag ${isInactive ? 'inactive' : 'active'}`}>
                              {isInactive ? t("Inactivo / Expulsado") : t("Activo")}
                            </span>
                          </td>
                          <td>
                            <div className="actions-cell">
                              <button
                                className="action-btn edit"
                                onClick={() => startEdit(user)}
                                title={t("Editar datos del colaborador")}
                              >
                                <Edit2 size={13} />
                                <span>{t("Editar")}</span>
                              </button>

                              {isInactive && (
                                <button
                                  className="action-btn reactivate"
                                  onClick={() => handleReactivateUser(user)}
                                  title={t("Reactivar acceso al sistema")}
                                >
                                  <UserCheck size={13} />
                                  <span>{t("Reactivar")}</span>
                                </button>
                              )}

                              <button
                                className="action-btn expel"
                                onClick={() => handleExpelUser(user)}
                                title={t("Expulsar y eliminar del sistema")}
                              >
                                <UserX size={13} />
                                <span>{t("Expulsar")}</span>
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
        </div>

        {/* Submodal Editar Usuario */}
        {editingUser && (
          <div className="admin-edit-submodal" onClick={() => setEditingUser(null)}>
            <div ref={editDialogRef} role="dialog" aria-modal="true" aria-label={t("Editar colaborador")} tabIndex={-1} className="admin-edit-card" onClick={(e) => e.stopPropagation()}>
              <div className="edit-card-header">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
                    <Edit2 size={16} />
                  </div>
                  <h3>{t("Editar Colaborador")}</h3>
                </div>
                <button onClick={() => setEditingUser(null)} title={t("Cerrar")}>
                  <X size={16} />
                </button>
              </div>

              <div className="edit-card-body">
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Avatar Uploader / Drag & Drop */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-[#343e48]">
                    {t("Foto de Perfil del Colaborador")}</label>

                  {editAvatarUrl ? (
                    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-50 shadow-xs">
                        <img
                          src={editAvatarUrl}
                          alt={t("Avatar Colaborador")}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#343e48] hover:border-slate-200 hover:text-slate-600 shadow-2xs transition-colors cursor-pointer"
                        >
                          <Camera size={13} />
                          <span>{t("Cambiar Foto")}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditAvatarUrl(null)}
                          className="flex items-center gap-1.5 rounded-lg border border-rose-100 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        >
                          <Trash2 size={13} />
                          <span>{t("Eliminar Foto")}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all cursor-pointer ${
                        isDragging
                          ? 'border-slate-600 bg-slate-50'
                          : 'border-slate-200 bg-white hover:border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-600 shadow-2xs">
                        <UploadCloud size={18} />
                      </div>
                      <p className="text-xs font-semibold text-[#343e48]">
                        {t("Haz clic o arrastra una foto aquí")}</p>
                      <p className="mt-0.5 text-[10.5px] text-slate-400">
                        {t("PNG, JPG o WEBP (máx. 5MB)")}</p>
                    </div>
                  )}
                </div>

                <div className="form-field">
                  <label>{t("Nombre Completo")}</label>
                  <input
                    type="text"
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    placeholder={t("Nombre del técnico")}
                  />
                </div>

                <div className="form-field">
                  <label>{t("Rol Asignado")}</label>
                  <RoleSelect
                    value={editRol}
                    onChange={(val) => setEditRol(val)}
                  />
                </div>

                <div className="form-field toggle-field">
                  <div>
                    <label>{t("Estado de Acceso")}</label>
                    <span className="text-[11px] text-slate-400 block">{t("Habilitar ingreso a la app")}</span>
                  </div>
                  <button
                    type="button"
                    className={`toggle-pill ${editActivo ? 'active' : 'inactive'}`}
                    onClick={() => setEditActivo(!editActivo)}
                  >
                    {editActivo ? t("Permitido (Activo)") : t("Bloqueado (Inactivo)")}
                  </button>
                </div>
              </div>

              <div className="edit-card-footer">
                <button
                  className="cancel-btn"
                  onClick={() => setEditingUser(null)}
                  disabled={savingEdit}
                >
                  {t("Cancelar")}</button>
                <button
                  className="save-btn"
                  onClick={handleSaveEdit}
                  disabled={savingEdit}
                >
                  {savingEdit ? t("Guardando...") : t("Guardar Cambios")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmación */}
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
