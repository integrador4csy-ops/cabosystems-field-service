import { getRoleLabel } from '../../lib/uiTranslations';
import { useTranslation } from '../../context/LanguageContext';
import { useDialog } from '../ui/useDialog';
import { ChatAudioPlayer } from './ChatAudioPlayer';
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
  FileText,
  Paperclip,
  Download,
  Eye,
  Play,
  Mic,
} from 'lucide-react';
import { getProjects } from '../../lib/projectsApi';
import type { Proyecto } from '../../types/projects';
import {
  getGroupMembers,
  getGroupAttachments,
  updateChatGroup,
  addChatGroupMembers,
  removeChatGroupMember,
  deleteChatGroup,
  getAllProfilesForInvite,
} from '../../lib/chatApi';
import type { ChatGroup, ChatMember, ChatMessage } from '../../types/chat';
import type { Profile } from '../../types/fleet';
import { getDocumentInfo } from '../../lib/chatDocumentTypes';
import { downloadRemoteFile } from '../../lib/fileDownload';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { ImageLightboxModal } from './ImageLightboxModal';
import { GroupTaskActivitySection } from './GroupTaskActivitySection';

interface GroupInfoDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  group: ChatGroup | null;
  currentUserId: string;
  isGlobalAdmin: boolean;
  onGroupUpdated: () => void;
  onGroupDeleted: () => void;
}

type GroupInfoTab = 'members' | 'tasks' | 'media';

export const GroupInfoDrawer: React.FC<GroupInfoDrawerProps> = ({
  isOpen,
  onClose,
  group,
  currentUserId,
  isGlobalAdmin,
  onGroupUpdated,
  onGroupDeleted,
}) => {
  const { t } = useTranslation();
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [attachments, setAttachments] = useState<ChatMessage[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [activeTab, setActiveTab] = useState<GroupInfoTab>('members');
  const [mediaFilter, setMediaFilter] = useState<'all' | 'media' | 'docs' | 'audio'>('all');
  const [previewDoc, setPreviewDoc] = useState<{ url: string; fileName?: string; fileSize?: number; mimeType?: string } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; caption?: string | null } | null>(null);

  // Edit Group State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editSoloMulti, setEditSoloMulti] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [availableProjects, setAvailableProjects] = useState<Proyecto[]>([]);
  const [editProjectId, setEditProjectId] = useState<string>('');

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
      setActiveTab('members');
      setEditName(group.nombre);
      setEditDesc(group.descripcion || '');
      setEditSoloMulti(group.solo_multimedia);
      setEditPhotoFile(null);
      setEditPhotoPreview(group.foto_url);
      setEditProjectId(group.proyecto_id || '');
      if (isAdminOfGroup) {
        getProjects().then(setAvailableProjects).catch(() => []);
      }
      loadMembers();
      loadAttachments();
    }
  }, [isOpen, group?.id]);

  const loadAttachments = async () => {
    if (!group) return;
    try {
      setLoadingAttachments(true);
      const data = await getGroupAttachments(group.id);
      setAttachments(data);
    } catch (err) {
      console.error('Error loading group attachments:', err);
    } finally {
      setLoadingAttachments(false);
    }
  };

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
        t("¿Estás seguro de expulsar a {value0} de este grupo de trabajo?", { value0: memberName })
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
        proyecto_id: editProjectId || null,
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

  const dialogRef = useDialog(isOpen && !!group, onClose);

  if (!isOpen || !group) return null;

  const groupInitial = group.nombre.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[10000] flex justify-end bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("Detalles del grupo")} tabIndex={-1}
        className="minimal-modal w-full max-w-md bg-white shadow-theme-md h-full flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-slate-50/60">
          <h3 className="text-sm font-semibold text-[#343e48] flex items-center gap-2">
            <Users size={17} className="text-slate-600" />
            <span>{t("Detalles del Grupo")}</span>
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
            <form onSubmit={handleSaveGroupEdit} className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-600">
                  {t("Editar Información")}</h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-[11px] font-semibold text-slate-500 hover:underline"
                >
                  {t("Cancelar")}</button>
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
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-dashed border-[#f78c26] bg-white overflow-hidden text-slate-400 hover:text-slate-600"
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
                  <p className="font-semibold text-[#343e48]">{t("Foto del Grupo")}</p>
                  <p className="text-[10px]">{t("Haz clic para cambiar imagen")}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#343e48] mb-1">
                  {t("Nombre del Grupo")}</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#343e48] focus:border-[#f78c26] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#343e48] mb-1">
                  {t("Descripción")}</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#343e48] focus:border-[#f78c26] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#343e48] mb-1">
                  {t("Villa vinculada (opcional)")}</label>
                <select
                  value={editProjectId}
                  onChange={(e) => setEditProjectId(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-[#343e48] focus:border-[#f78c26] outline-hidden"
                >
                  <option value="">{t("Ninguna (Chat general)")}</option>
                  {availableProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.desarrollo} · {p.villa}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 font-medium mt-1">
                  {t("Solo puedes vincular villas que tienes permitido consultar.")}
                </p>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Video size={15} className="text-slate-600" />
                    <span className="text-xs font-semibold text-[#343e48]">
                      {t("Solo Multimedia")}</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={editSoloMulti}
                    onChange={(e) => setEditSoloMulti(e.target.checked)}
                    className="h-4 w-4 rounded text-slate-600 focus:ring-[#f78c26]"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  {t("Cancelar")}</button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingEdit ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Check size={13} />
                  )}
                  <span>{t("Guardar")}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col items-center text-center p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="relative mb-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 border-2 border-[#f78c26] text-slate-600 font-extrabold text-2xl shadow-xs overflow-hidden">
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

              <h3 className="text-base font-semibold text-[#343e48]">
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
                  <span className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 border border-slate-200">
                    <Video size={12} />
                    <span>{t("Solo Multimedia")}</span>
                  </span>
                )}
                <span className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-600 border border-slate-200">
                  <Users size={12} />
                  <span>{members.length} {' '}{t("colaboradores")}</span>
                </span>
              </div>

              {/* Edit Button for Admins */}
              {isAdminOfGroup && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="mt-3.5 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-600 hover:border-slate-200 shadow-2xs transition-all"
                >
                  <Settings size={13} />
                  <span>{t("Editar Grupo")}</span>
                </button>
              )}
            </div>
          )}

          <div
            role="tablist"
            aria-label={t('Detalles del Grupo')}
            className="grid grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1"
          >
            {([
              { id: 'members', label: t('Colaboradores') },
              { id: 'tasks', label: t('Tareas realizadas') },
              { id: 'media', label: t('Archivos y multimedia') },
            ] satisfies { id: GroupInfoTab; label: string }[]).map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  id={`group-info-${tab.id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`group-info-${tab.id}-panel`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-11 rounded-lg px-2 py-2 text-[11px] font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f78c26] ${
                    isActive
                      ? 'bg-[#f78c26] text-white shadow-xs'
                      : 'text-slate-600 hover:bg-white hover:text-[#343e48]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tareas realizadas de la villa vinculada */}
          {activeTab === 'tasks' ? (
            <div
              id="group-info-tasks-panel"
              role="tabpanel"
              aria-labelledby="group-info-tasks-tab"
            >
              {group.proyecto_id ? (
                <GroupTaskActivitySection
                  groupId={group.id}
                  onImageClick={(url, caption) => setLightboxImage({ url, caption })}
                />
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-xs font-medium text-slate-500">
                  {t('Vincula una villa para consultar sus tareas realizadas.')}
                </div>
              )}
            </div>
          ) : null}

          {/* Attachments & Media Section */}
          {activeTab === 'media' ? (
          <div
            id="group-info-media-panel"
            role="tabpanel"
            aria-labelledby="group-info-media-tab"
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip size={15} className="text-brand-500" />
                <h4 className="text-xs font-bold text-[#343e48] tracking-wider uppercase">
                  {t("Archivos y multimedia")}
                </h4>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {attachments.length}
              </span>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
              {[
                { id: 'all', label: t('Todos') },
                { id: 'media', label: t('Fotos y videos') },
                { id: 'docs', label: t('Documentos') },
                { id: 'audio', label: t('Audios') },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMediaFilter(tab.id as 'all' | 'media' | 'docs' | 'audio')}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                    mediaFilter === tab.id
                      ? 'bg-brand-500 text-white'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Filtered Content */}
            {loadingAttachments ? (
              <div className="flex items-center justify-center py-6 text-slate-400">
                <Loader2 size={20} className="animate-spin text-brand-500" />
              </div>
            ) : (() => {
              const filtered = attachments.filter((att) => {
                if (mediaFilter === 'media') return att.tipo === 'imagen' || att.tipo === 'video';
                if (mediaFilter === 'docs') return att.tipo === 'archivo';
                if (mediaFilter === 'audio') return att.tipo === 'audio';
                return true;
              });

              if (filtered.length === 0) {
                return (
                  <p className="py-4 text-center text-xs text-slate-400">
                    {t("No hay archivos adjuntos en este grupo")}
                  </p>
                );
              }

              return (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {/* Photo/Video Grid */}
                  {filtered.some((a) => a.tipo === 'imagen' || a.tipo === 'video') && (mediaFilter === 'media' || mediaFilter === 'all') && (
                    <div className="grid grid-cols-3 gap-2 pb-2">
                      {filtered
                        .filter((a) => a.tipo === 'imagen' || a.tipo === 'video')
                        .map((att) => (
                          <div
                            key={att.id}
                            className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100 border border-slate-200 cursor-pointer"
                            onClick={() => {
                              if (att.tipo === 'imagen') {
                                setLightboxImage({ url: att.media_url!, caption: att.contenido });
                              } else {
                                setPreviewDoc({
                                  url: att.media_url!,
                                  fileName: att.media_meta?.fileName || 'Video',
                                  mimeType: att.media_meta?.mimeType || 'video/mp4',
                                });
                              }
                            }}
                          >
                            {att.tipo === 'video' ? (
                              <>
                                <video src={att.media_url!} className="h-full w-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
                                    <Play size={14} className="fill-white translate-x-0.5" />
                                  </div>
                                </div>
                              </>
                            ) : (
                              <img src={att.media_url!} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Documents & Audio List */}
                  {filtered
                    .filter((a) => a.tipo === 'archivo' || a.tipo === 'audio')
                    .map((att) => {
                      if (att.tipo === 'audio') {
                        return (
                          <div key={att.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                              <Mic size={18} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-slate-700">
                                {t('Nota de voz')}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {new Date(att.created_at).toLocaleDateString()}
                              </p>
                            </div>
                            <ChatAudioPlayer src={att.media_url!} compact className="max-w-[200px]" />
                          </div>
                        );
                      }

                      const docInfo = getDocumentInfo(att.media_meta?.fileName, att.media_meta?.mimeType, att.media_url);
                      const fileName = att.media_meta?.fileName || att.contenido || t('Documento');
                      return (
                        <div key={att.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5 hover:bg-slate-100/70 transition-colors">
                          <div
                            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border cursor-pointer"
                            style={{ backgroundColor: docInfo.bgColor, borderColor: docInfo.borderColor }}
                            onClick={() => setPreviewDoc({ url: att.media_url!, fileName, fileSize: att.media_meta?.fileSize, mimeType: att.media_meta?.mimeType })}
                          >
                            <FileText size={18} style={{ color: docInfo.primaryColor }} />
                            <span
                              className="absolute -bottom-1 px-1 py-0.2 rounded text-[6.5px] font-bold text-white uppercase"
                              style={{ backgroundColor: docInfo.primaryColor }}
                            >
                              {docInfo.badgeLabel}
                            </span>
                          </div>
                          <div
                            className="min-w-0 flex-1 cursor-pointer"
                            onClick={() => setPreviewDoc({ url: att.media_url!, fileName, fileSize: att.media_meta?.fileSize, mimeType: att.media_meta?.mimeType })}
                          >
                            <p className="truncate text-xs font-semibold text-[#1e293b]" title={fileName}>
                              {fileName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {att.media_meta?.fileSize
                                ? (att.media_meta.fileSize > 1024 * 1024
                                    ? (att.media_meta.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
                                    : (att.media_meta.fileSize / 1024).toFixed(0) + ' KB')
                                : docInfo.typeName}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc({ url: att.media_url!, fileName, fileSize: att.media_meta?.fileSize, mimeType: att.media_meta?.mimeType })}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-brand-500 transition-colors cursor-pointer"
                              title={t('Vista previa')}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => void downloadRemoteFile(att.media_url!, fileName)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-white hover:text-brand-500 transition-colors cursor-pointer"
                              title={t('Descargar archivo')}
                            >
                              <Download size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              );
            })()}
          </div>
          ) : null}

          {/* Members List Section */}
          {activeTab === 'members' ? (
          <div
            id="group-info-members-panel"
            role="tabpanel"
            aria-labelledby="group-info-members-tab"
            className="space-y-5"
          >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-[#343e48] tracking-wider uppercase">
                {t("Colaboradores (")}{members.length})
              </h4>
              {isAdminOfGroup && !isAddingMembers && (
                <button
                  type="button"
                  onClick={handleOpenAddMembers}
                  className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:underline"
                >
                  <UserPlus size={14} />
                  <span>{t("Agregar")}</span>
                </button>
              )}
            </div>

            {/* Add Members Sub-Panel */}
            {isAddingMembers && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#343e48]">
                    {t("Seleccionar colaboradores")}</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingMembers(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:underline"
                  >
                    {t("Cerrar")}</button>
                </div>

                <div className="relative">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder={t("Buscar por nombre o rol...")}
                    value={searchMemberQuery}
                    onChange={(e) => setSearchMemberQuery(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white pl-7.5 pr-2.5 py-1 text-xs font-medium text-[#343e48] outline-hidden focus:border-[#f78c26]"
                  />
                </div>

                <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                  {availableProfiles.length === 0 ? (
                    <div className="p-3 text-center text-xs text-slate-400">
                      {t("Todos los técnicos ya están en este grupo")}</div>
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
                              isSelected ? 'bg-slate-50' : ''
                            }`}
                          >
                            <span className="font-semibold text-[#343e48]">
                              {p.nombre}
                            </span>
                            <div
                              className={`flex h-4.5 w-4.5 items-center justify-center rounded-md border ${
                                isSelected
                                  ? 'bg-brand-500 border-[#f78c26] text-white'
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
                    {t("Cancelar")}</button>
                  <button
                    type="button"
                    disabled={savingNewMembers || selectedToAdd.length === 0}
                    onClick={handleSaveAddMembers}
                    className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {savingNewMembers ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                    <span>{t("Agregar (")}{selectedToAdd.length})</span>
                  </button>
                </div>
              </div>
            )}

            {/* List of Current Members */}
            <div className="rounded-2xl border border-slate-200 divide-y divide-slate-100 overflow-hidden bg-white">
              {loadingMembers ? (
                <div className="flex items-center justify-center p-6 text-xs text-slate-400 gap-2">
                  <Loader2 size={15} className="animate-spin text-slate-600" />
                  <span>{t("Cargando miembros...")}</span>
                </div>
              ) : members.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  {t("Sin miembros registrados")}</div>
              ) : (
                members.map((m) => {
                  const prof = m.profiles;
                  const name = prof?.nombre || t("Técnico");
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
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 text-slate-600 text-xs font-semibold shrink-0 overflow-hidden">
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
                          <p className="text-xs font-semibold text-[#343e48] truncate">
                            {name}
                          </p>
                          <p className="text-[10px] text-slate-400 capitalize">
                            {getRoleLabel(prof?.rol, t)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isMemberAdmin && (
                          <span className="flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
                            <Shield size={10} />
                            <span>{t("Admin")}</span>
                          </span>
                        )}

                        {canRemove && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.profile_id, name)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title={t("Expulsar del grupo")}
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
                    <span className="text-xs font-semibold">
                      {t("¿Confirmar eliminación del grupo?")}</span>
                  </div>
                  <p className="text-[11px] text-rose-600 leading-relaxed">
                    {t("Esta acción eliminará el grupo y todos los mensajes y fotos compartidos para siempre.")}</p>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      {t("Cancelar")}</button>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={handleDeleteGroup}
                      className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50 shadow-xs"
                    >
                      {deleting ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      <span>{t("Eliminar Definitivamente")}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50/50 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-100/60 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>{t("Eliminar Grupo de Trabajo")}</span>
                </button>
              )}
            </div>
          )}
          </div>
          ) : null}
        </div>
      </div>

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          url={previewDoc.url}
          fileName={previewDoc.fileName}
          fileSize={previewDoc.fileSize}
          mimeType={previewDoc.mimeType}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Fullscreen Image Lightbox Modal */}
      {lightboxImage && (
        <ImageLightboxModal
          imageUrl={lightboxImage.url}
          caption={lightboxImage.caption}
          onClose={() => setLightboxImage(null)}
        />
      )}
    </div>
  );
};
