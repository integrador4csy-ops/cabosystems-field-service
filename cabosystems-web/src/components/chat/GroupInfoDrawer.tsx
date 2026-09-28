import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  Shield,
  Trash2,
  UserPlus,
  UserMinus,
  Settings,
  Video,
  Camera,
  Check,
  Search,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import {
  getGroupMembers,
  updateChatGroup,
  addChatGroupMembers,
  removeChatGroupMember,
  deleteChatGroup,
  getAllProfilesForInvite,
} from '../../lib/chatApi';
import type { ChatGroup, ChatMember } from '../../types/chat';
import type { Profile } from '../../types/fleet';

interface GroupInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  group: ChatGroup | null;
  currentUserId: string;
  isGlobalAdmin: boolean;
  onGroupUpdated: () => void;
  onGroupDeleted: () => void;
}

export const GroupInfoDrawer: React.FC<GroupInfoDrawerProps> = ({
  isOpen,
  onClose,
  group,
  currentUserId,
  isGlobalAdmin,
  onGroupUpdated,
  onGroupDeleted,
}) => {
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Edit Group State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSoloMulti, setEditSoloMulti] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Add Members State
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [availableProfiles, setAvailableProfiles] = useState<Profile[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
  const [searchMemberQuery, setSearchMemberQuery] = useState('');
  const [savingNewMembers, setSavingNewMembers] = useState(false);

  // Delete Confirmation State
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdminOfGroup =
    isGlobalAdmin ||
    group?.mi_rol === 'admin' ||
    group?.creado_por === currentUserId;

  useEffect(() => {
    if (isOpen && group) {
      setIsEditing(false);
      setIsAddingMembers(false);
      setIsConfirmingDelete(false);
      setEditName(group.nombre);
      setEditDesc(group.descripcion || '');
      setEditSoloMulti(group.solo_multimedia);
      setEditPhotoFile(null);
      setEditPhotoPreview(group.foto_url);
      loadMembers();
    }
  }, [isOpen, group?.id]);

  const loadMembers = async () => {
    if (!group) return;
    try {
      setLoadingMembers(true);
      const data = await getGroupMembers(group.id);
      setMembers(data);
    } catch (err) {
      console.error('Error loading group members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleOpenAddMembers = async () => {
    try {
      setIsAddingMembers(true);
      setSelectedToAdd([]);
      setSearchMemberQuery('');
      const allProfiles = await getAllProfilesForInvite();
      const existingMemberIds = new Set(members.map((m) => m.profile_id));
      setAvailableProfiles(
        allProfiles.filter((p) => !existingMemberIds.has(p.id))
      );
    } catch (err) {
      console.error('Error loading available profiles:', err);
    }
  };

  const handleSaveAddMembers = async () => {
    if (!group || selectedToAdd.length === 0) return;
    try {
      setSavingNewMembers(true);
      await addChatGroupMembers(group.id, selectedToAdd);
      setIsAddingMembers(false);
      loadMembers();
      onGroupUpdated();
    } catch (err) {
      console.error('Error adding members:', err);
    } finally {
      setSavingNewMembers(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!group) return;
    if (
      !window.confirm(
        `¿Estás seguro de expulsar a ${memberName} de este grupo de trabajo?`
      )
    ) {
      return;
    }

    try {
      await removeChatGroupMember(group.id, memberId);
      loadMembers();
      onGroupUpdated();
    } catch (err) {
      console.error('Error removing member:', err);
    }
  };

  const handleSaveGroupEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group || !editName.trim()) return;

    try {
      setSavingEdit(true);
      await updateChatGroup(group.id, {
        nombre: editName.trim(),
        descripcion: editDesc.trim() || undefined,
        solo_multimedia: editSoloMulti,
        fotoFile: editPhotoFile,
      });

      setIsEditing(false);
      onGroupUpdated();
    } catch (err) {
      console.error('Error updating group:', err);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!group) return;
    try {
      setDeleting(true);
      await deleteChatGroup(group.id);
      onGroupDeleted();
      onClose();
    } catch (err) {
      console.error('Error deleting group:', err);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !group) return null;

  const groupInitial = group.nombre.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white shadow-2xl h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/60">
          <h3 className="text-sm font-bold text-[#343e48] flex items-center gap-2">
            <Users size={17} className="text-[#f78c26]" />
            <span>Detalles del Grupo</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Main Info Card / Edit Form */}
          {isEditing ? (
            <form onSubmit={handleSaveGroupEdit} className="space-y-4 rounded-2xl border border-orange-200 bg-orange-50/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold text-[#f78c26]">
                  Editar Información
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-[11px] font-semibold text-slate-500 hover:underline"
                >
                  Cancelar
                </button>
              </div>

              {/* Photo Input */}
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setEditPhotoFile(f);
                      setEditPhotoPreview(URL.createObjectURL(f));
                    }
                  }}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-[#f78c26] bg-white overflow-hidden text-slate-400 hover:text-[#f78c26]"
                >
                  {editPhotoPreview ? (
                    <img
                      src={editPhotoPreview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Camera size={20} />
                  )}
                </button>
                <div className="text-xs text-slate-500">
                  <p className="font-bold text-[#343e48]">Foto del Grupo</p>
                  <p className="text-[10px]">Haz clic para cambiar imagen</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#343e48] mb-1">
                  Nombre del Grupo
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#343e48] focus:border-[#f78c26] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#343e48] mb-1">
                  Descripción
                </label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#343e48] focus:border-[#f78c26] outline-hidden"
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Video size={15} className="text-amber-700" />
                    <span className="text-xs font-bold text-[#343e48]">
                      Solo Multimedia
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editSoloMulti}
                    onChange={(e) => setEditSoloMulti(e.target.checked)}
                    className="h-4 w-4 rounded text-[#f78c26] focus:ring-[#f78c26]"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 rounded-xl bg-[#f78c26] px-4 py-1.5 text-xs font-bold text-white hover:bg-[#ea580c] disabled:opacity-50"
                >
                  {savingEdit ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
              <div className="relative mb-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-100 border-2 border-[#f78c26] text-[#f78c26] font-extrabold text-2xl shadow-xs overflow-hidden">
                  {group.foto_url ? (
                    <img
                      src={group.foto_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{groupInitial}</span>
                  )}
                </div>
              </div>

              <h3 className="text-base font-bold text-[#343e48]">
                {group.nombre}
              </h3>
              {group.descripcion && (
                <p className="mt-1 text-xs text-slate-500 font-medium">
                  {group.descripcion}
                </p>
              )}

              {/* Status Badges */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                {group.solo_multimedia && (
                  <span className="flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-800 border border-amber-200">
                    <Video size={12} />
                    <span>Solo Multimedia</span>
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-bold text-slate-600 border border-slate-200">
                  <Users size={12} />
                  <span>{members.length} colaboradores</span>
                </span>
              </div>

              {/* Edit Button for Admins */}
              {isAdminOfGroup && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="mt-3.5 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#f78c26] hover:border-orange-200 shadow-2xs transition-all"
                >
                  <Settings size={13} />
                  <span>Editar Grupo</span>
                </button>
              )}
            </div>
          )}

          {/* Members List Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[#343e48] tracking-wider uppercase">
                Colaboradores ({members.length})
              </h4>
              {isAdminOfGroup && !isAddingMembers && (
                <button
                  type="button"
                  onClick={handleOpenAddMembers}
                  className="flex items-center gap-1 text-xs font-bold text-[#f78c26] hover:underline"
                >
                  <UserPlus size={14} />
                  <span>Agregar</span>
                </button>
              )}
            </div>

            {/* Add Members Sub-Panel */}
            {isAddingMembers && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#343e48]">
                    Seleccionar colaboradores
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsAddingMembers(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:underline"
                  >
                    Cerrar
                  </button>
                </div>

                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Buscar por nombre o rol..."
                    value={searchMemberQuery}
                    onChange={(e) => setSearchMemberQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-7.5 pr-2.5 py-1 text-xs font-medium text-[#343e48] outline-hidden focus:border-[#f78c26]"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                  {availableProfiles.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Todos los técnicos ya están en este grupo
                    </div>
                  ) : (
                    availableProfiles
                      .filter((p) => {
                        const q = searchMemberQuery.toLowerCase();
                        return (
                          (p.nombre || '').toLowerCase().includes(q) ||
                          (p.rol || '').toLowerCase().includes(q)
                        );
                      })
                      .map((p) => {
                        const isSelected = selectedToAdd.includes(p.id);
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedToAdd((prev) =>
                                prev.includes(p.id)
                                  ? prev.filter((id) => id !== p.id)
                                  : [...prev, p.id]
                              );
                            }}
                            className={`flex items-center justify-between p-2 cursor-pointer text-xs hover:bg-slate-50 ${
                              isSelected ? 'bg-orange-50/60' : ''
                            }`}
                          >
                            <span className="font-bold text-[#343e48]">
                              {p.nombre}
                            </span>
                            <div
                              className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border ${
                                isSelected
                                  ? 'bg-[#f78c26] border-[#f78c26] text-white'
                                  : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check size={11} strokeWidth={3} />}
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingMembers(false)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={savingNewMembers || selectedToAdd.length === 0}
                    onClick={handleSaveAddMembers}
                    className="flex items-center gap-1.5 rounded-lg bg-[#f78c26] px-3 py-1 text-xs font-bold text-white hover:bg-[#ea580c] disabled:opacity-50"
                  >
                    {savingNewMembers ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    <span>Agregar ({selectedToAdd.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* List of Current Members */}
            <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white">
              {loadingMembers ? (
                <div className="flex items-center justify-center p-6 text-xs text-slate-400 gap-2">
                  <Loader2 size={15} className="animate-spin text-[#f78c26]" />
                  <span>Cargando miembros...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  Sin miembros registrados
                </div>
              ) : (
                members.map((m) => {
                  const prof = m.profiles;
                  const name = prof?.nombre || 'Técnico';
                  const initials = name
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();
                  const isMemberAdmin = m.rol === 'admin';
                  const canRemove =
                    isAdminOfGroup &&
                    m.profile_id !== currentUserId &&
                    m.profile_id !== group.creado_por;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-[#f78c26] text-xs font-bold shrink-0 overflow-hidden">
                          {prof?.avatar_url ? (
                            <img
                              src={prof.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-bold text-[#343e48] truncate">
                            {name}
                          </p>
                          <p className="text-[10px] text-slate-400 capitalize">
                            {prof?.rol?.replace(/_/g, ' ') || 'Técnico'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isMemberAdmin && (
                          <span className="flex items-center gap-1 rounded-md bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-[#f78c26] border border-orange-200">
                            <Shield size={10} />
                            <span>Admin</span>
                          </span>
                        )}

                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.profile_id, name)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Expulsar del grupo"
                          >
                            <UserMinus size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Danger Zone: Delete Group */}
          {isAdminOfGroup && (
            <div className="pt-4 border-t border-slate-100">
              {isConfirmingDelete ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-rose-700">
                    <AlertTriangle size={17} />
                    <span className="text-xs font-bold">
                      ¿Confirmar eliminación del grupo?
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-600 leading-relaxed">
                    Esta acción eliminará el grupo y todos los mensajes y fotos compartidos para siempre.
                  </p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDeleteGroup}
                      className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs"
                    >
                      {deleting ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      <span>Eliminar Definitivamente</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50/50 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-100/60 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Eliminar Grupo de Trabajo</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
