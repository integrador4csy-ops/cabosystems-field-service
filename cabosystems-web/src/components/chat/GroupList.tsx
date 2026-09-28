import React from 'react';
import {
  Search,
  Plus,
  Users,
  Video,
  Camera,
  Sparkles,
  MessageSquare,
  Shield,
} from 'lucide-react';
import type { ChatGroup } from '../../types/chat';

interface GroupListProps {
  groups: ChatGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  onOpenCreateGroup: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isGlobalAdmin: boolean;
  loading: boolean;
}

export const GroupList: React.FC<GroupListProps> = ({
  groups,
  selectedGroupId,
  onSelectGroup,
  onOpenCreateGroup,
  searchQuery,
  onSearchChange,
  isGlobalAdmin,
  loading,
}) => {
  const filteredGroups = groups.filter((g) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      g.nombre.toLowerCase().includes(q) ||
      (g.descripcion && g.descripcion.toLowerCase().includes(q))
    );
  });

  const renderLastMessagePreview = (group: ChatGroup) => {
    const lastMsg = group.ultimo_mensaje;
    if (!lastMsg) {
      return (
        <span className="text-slate-400 italic">
          Sin mensajes aún · ¡Inicia el chat!
        </span>
      );
    }

    const sender = lastMsg.profiles?.nombre?.split(' ')[0] || 'Técnico';

    if (lastMsg.tipo === 'imagen') {
      return (
        <span className="flex items-center gap-1 text-[#f78c26] font-semibold">
          <Camera size={11} />
          <span>{sender}: Foto de evidencia</span>
        </span>
      );
    }

    if (lastMsg.tipo === 'video') {
      return (
        <span className="flex items-center gap-1 text-[#f78c26] font-semibold">
          <Video size={11} />
          <span>{sender}: Video técnico</span>
        </span>
      );
    }

    if (lastMsg.tipo === 'sticker') {
      return (
        <span className="flex items-center gap-1 text-[#f78c26] font-semibold">
          <Sparkles size={11} />
          <span>{sender}: Sticker</span>
        </span>
      );
    }

    return (
      <span className="truncate">
        <span className="font-semibold text-slate-600">{sender}: </span>
        <span>{lastMsg.contenido}</span>
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white select-none shrink-0">
      {/* 1. Header with Title & Action Button */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#343e48]">
            Grupos de Trabajo
          </h2>
          <p className="text-[11px] text-slate-400 font-medium">
            {groups.length} {groups.length === 1 ? 'grupo activo' : 'grupos activos'}
          </p>
        </div>

        {isGlobalAdmin && (
          <button
            type="button"
            onClick={onOpenCreateGroup}
            className="flex items-center gap-1.5 rounded-xl bg-[#f78c26] hover:bg-[#ea580c] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-all cursor-pointer"
            title="Crear nuevo grupo"
          >
            <Plus size={14} strokeWidth={3} />
            <span>Nuevo</span>
          </button>
        )}
      </div>

      {/* 2. Search Input */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Buscar grupo o proyecto..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white pl-8.5 pr-3 py-1.5 text-xs font-medium text-[#343e48] placeholder-slate-400 focus:border-[#f78c26] focus:ring-2 focus:ring-orange-100 outline-hidden transition-all"
          />
        </div>
      </div>

      {/* 3. Groups List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Cargando grupos...
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-2">
              <MessageSquare size={20} />
            </div>
            <p className="text-xs font-bold text-[#343e48]">
              {searchQuery ? 'Sin resultados' : 'Sin grupos creados'}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? 'Intenta con otro término de búsqueda.'
                : isGlobalAdmin
                ? 'Crea tu primer grupo con el botón "+ Nuevo" arriba.'
                : 'Tu supervisor te asignará a los grupos correspondientes.'}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isSelected = selectedGroupId === group.id;
            const groupInitial = group.nombre.charAt(0).toUpperCase();
            const lastMsgTime = group.ultimo_mensaje
              ? new Date(group.ultimo_mensaje.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div
                key={group.id}
                onClick={() => onSelectGroup(group.id)}
                className={`flex items-start gap-3 p-3.5 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-orange-50/70 border-l-4 border-l-[#f78c26]'
                    : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                }`}
              >
                {/* Group Avatar */}
                <div className="relative shrink-0 mt-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-[#f78c26] font-bold text-xs overflow-hidden border border-orange-200/60 shadow-2xs">
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
                  {group.mi_rol === 'admin' && (
                    <div
                      className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#f78c26] text-white border-2 border-white shadow-2xs"
                      title="Administrador del grupo"
                    >
                      <Shield size={8} />
                    </div>
                  )}
                </div>

                {/* Info Container */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3
                      className={`text-xs font-bold truncate ${
                        isSelected ? 'text-[#f78c26]' : 'text-[#343e48]'
                      }`}
                    >
                      {group.nombre}
                    </h3>
                    {lastMsgTime && (
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        {lastMsgTime}
                      </span>
                    )}
                  </div>

                  {/* Badges row */}
                  <div className="flex items-center gap-1.5 mb-1">
                    {group.solo_multimedia && (
                      <span className="flex items-center gap-0.5 rounded-sm bg-amber-50 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-700 border border-amber-200/80">
                        <Video size={9} />
                        <span>Multimedia</span>
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-medium flex items-center gap-0.5">
                      <Users size={10} />
                      <span>{group.miembros_count || 1}</span>
                    </span>
                  </div>

                  {/* Last Message Preview */}
                  <div className="text-[11px] text-slate-500 truncate">
                    {renderLastMessagePreview(group)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
