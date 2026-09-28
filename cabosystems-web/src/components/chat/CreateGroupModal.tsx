import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Users,
  Camera,
  Search,
  Check,
  Video,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { createChatGroup, getAllProfilesForInvite } from '../../lib/chatApi';
import type { Profile } from '../../types/fleet';
import type { ChatGroup } from '../../types/chat';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorId: string;
  onGroupCreated: (group: ChatGroup) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  creatorId,
  onGroupCreated,
}) => {
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [soloMultimedia, setSoloMultimedia] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setNombre('');
      setDescripcion('');
      setSoloMultimedia(false);
      setFotoFile(null);
      setFotoPreview(null);
      setSelectedMemberIds([]);
      setSearchQuery('');
      setErrorMsg(null);
      loadProfiles();
    }
  }, [isOpen]);

  const loadProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const data = await getAllProfilesForInvite();
      // Filter out creator from selection list since creator is auto-added
      setProfiles(data.filter((p) => p.id !== creatorId));
    } catch (err) {
      console.error('Error loading profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFotoFile(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const toggleMember = (profileId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedMemberIds.length === filteredProfiles.length) {
      setSelectedMemberIds([]);
    } else {
      setSelectedMemberIds(filteredProfiles.map((p) => p.id));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      setErrorMsg('Por favor ingresa un nombre para el grupo.');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const newGroup = await createChatGroup({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || undefined,
        fotoFile,
        solo_multimedia: soloMultimedia,
        creatorId,
        memberIds: selectedMemberIds,
      });

      onGroupCreated(newGroup);
      onClose();
    } catch (err: any) {
      console.error('Error creating group:', err);
      setErrorMsg(err?.message || 'Error al crear el grupo de trabajo.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProfiles = profiles.filter((p) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const name = (p.nombre || p.full_name || '').toLowerCase();
    const role = (p.rol || '').toLowerCase();
    return name.includes(q) || role.includes(q);
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - TailAdmin style */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-[#f78c26]">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#343e48]">
                Crear Grupo de Trabajo
              </h3>
              <p className="text-xs text-slate-500">
                Canal de comunicación y coordinación en tiempo real
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Group Photo & Basic Details */}
          <div className="flex items-start gap-4">
            <div className="relative group shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-orange-50 hover:border-[#f78c26] text-slate-400 hover:text-[#f78c26] transition-all overflow-hidden"
              >
                {fotoPreview ? (
                  <img
                    src={fotoPreview}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Camera size={22} />
                )}
              </button>
              <div className="mt-1 text-[10px] text-center text-slate-400 font-medium">
                {fotoPreview ? 'Cambiar' : 'Foto'}
              </div>
            </div>

            <div className="flex-1 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#343e48] mb-1">
                  Nombre del Grupo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Instalaciones Villa 402 - Pedregal"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-[#343e48] placeholder-slate-400 focus:border-[#f78c26] focus:ring-2 focus:ring-orange-100 outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#343e48] mb-1">
                  Descripción (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Objetivo, detalles del proyecto o instrucciones"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-[#343e48] placeholder-slate-400 focus:border-[#f78c26] focus:ring-2 focus:ring-orange-100 outline-hidden transition-all"
                />
              </div>
            </div>
          </div>

          {/* Modo Solo Multimedia Switch */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/50 p-4 transition-all">
            <label className="flex items-center justify-between cursor-pointer">
              <div className="flex items-start gap-3 pr-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0 mt-0.5">
                  <Video size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-[#343e48] flex items-center gap-1.5">
                    Modo "Solo Multimedia" (Fotos y Videos de Evidencia)
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                    Los técnicos sólo podrán enviar fotografías y videos técnicos. El texto está restringido únicamente para coordinadores y administradores.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={soloMultimedia}
                onChange={(e) => setSoloMultimedia(e.target.checked)}
                className="h-5 w-5 rounded-md border-slate-300 text-[#f78c26] focus:ring-[#f78c26] cursor-pointer"
              />
            </label>
          </div>

          {/* Member Selection List */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#343e48] flex items-center gap-2">
                <span>Agregar Colaboradores</span>
                <span className="rounded-full bg-orange-100 text-[#f78c26] px-2 py-0.5 text-[10px] font-extrabold">
                  {selectedMemberIds.length} seleccionados
                </span>
              </label>
              {filteredProfiles.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-[#f78c26] hover:underline"
                >
                  {selectedMemberIds.length === filteredProfiles.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
              )}
            </div>

            {/* Member Search Bar */}
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Buscar colaboradores por nombre o rol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-8.5 pr-3 py-1.5 text-xs font-medium text-[#343e48] placeholder-slate-400 focus:border-[#f78c26] focus:bg-white focus:ring-2 focus:ring-orange-100 outline-hidden transition-all"
              />
            </div>

            {/* Collaborators List */}
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
              {loadingProfiles ? (
                <div className="flex items-center justify-center p-6 text-xs text-slate-400 gap-2">
                  <Loader2 size={16} className="animate-spin text-[#f78c26]" />
                  <span>Cargando colaboradores...</span>
                </div>
              ) : filteredProfiles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400">
                  {searchQuery
                    ? 'No se encontraron colaboradores con esa búsqueda'
                    : 'No hay colaboradores registrados'}
                </div>
              ) : (
                filteredProfiles.map((p) => {
                  const isSelected = selectedMemberIds.includes(p.id);
                  const name = p.nombre || p.full_name || 'Técnico';
                  const initials = name
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .substring(0, 2)
                    .toUpperCase();

                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleMember(p.id)}
                      className={`flex items-center justify-between p-2.5 px-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                        isSelected ? 'bg-orange-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7.5 w-7.5 items-center justify-center rounded-xl bg-orange-100 text-[#f78c26] text-xs font-bold shrink-0 overflow-hidden">
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{initials}</span>
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#343e48]">{name}</p>
                          <p className="text-[10px] font-medium text-slate-400 capitalize">
                            {p.rol?.replace(/_/g, ' ') || 'Técnico'}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                          isSelected
                            ? 'bg-[#f78c26] border-[#f78c26] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && <Check size={13} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-[#f78c26] hover:bg-[#ea580c] px-5 py-2 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Creando...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Crear Grupo</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
