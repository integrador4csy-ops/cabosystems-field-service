import { useTranslation } from '../../context/LanguageContext';
import React from 'react';
import {
  Users,
  Video,
  Camera,
  Sparkles,
  MessageSquare,
} from 'lucide-react';
import type { ChatGroup } from '../../types/chat';

interface GroupListProps {
  groups: ChatGroup[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string) => void;
  searchQuery: string;
  isGlobalAdmin: boolean;
  loading: boolean;
  onIntentGroup?: (groupId: string) => void;
}

export const GroupList: React.FC<GroupListProps> = ({
  groups,
  selectedGroupId,
  onSelectGroup,
  searchQuery,
  isGlobalAdmin,
  loading,
  onIntentGroup,
}) => {
  const intentTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  React.useEffect(() => () => clearTimeout(intentTimer.current), []);
  const { t, locale } = useTranslation();
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
          {t("Sin mensajes aún · ¡Inicia el chat!")}</span>
      );
    }

    if (lastMsg.tipo === 'audio' || lastMsg.tipo === 'archivo') return <span className="truncate">{lastMsg.tipo === 'audio' ? t('Nota de voz') : lastMsg.media_meta?.fileName || lastMsg.contenido || t('Documento')}</span>;
    const sender = lastMsg.profiles?.nombre?.split(' ')[0] || t("Técnico");

    if (lastMsg.tipo === 'imagen') {
      return (
        <span className="flex items-center gap-1 text-brand-500 font-semibold">
          <Camera size={11} />
          <span>{sender}{t(": Foto de evidencia")}</span>
        </span>
      );
    }

    if (lastMsg.tipo === 'video') {
      return (
        <span className="flex items-center gap-1 text-brand-500 font-semibold">
          <Video size={11} />
          <span>{sender}{t(": Video técnico")}</span>
        </span>
      );
    }

    if (lastMsg.tipo === 'sticker') {
      return (
        <span className="flex items-center gap-1 text-brand-500 font-semibold">
          <Sparkles size={11} />
          <span>{sender}{t(": Sticker")}</span>
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
    <div className="flex flex-col h-full w-full bg-white select-none">
      {/* 1. List context */}
      <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[#343e48]">
            {t("Grupos de Trabajo")}</h2>
          <p className="text-[11px] text-slate-400 font-medium">
            {groups.length} {groups.length === 1 ? t("grupo activo") : t("grupos activos")}
          </p>
        </div>

        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold tabular-nums text-slate-600">{groups.length}</span>
      </div>

      {/* 2. Groups list */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-400">
            {t("Cargando grupos...")}</div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-2">
              <MessageSquare size={20} />
            </div>
            <p className="text-xs font-bold text-[#343e48]">
              {searchQuery ? t("Sin resultados") : t("Sin grupos creados")}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
              {searchQuery
                ? t("Intenta con otro término de búsqueda.")
                : isGlobalAdmin
                ? t('Usa “Nuevo grupo” en la barra superior para comenzar.')
                : t("Tu supervisor te asignará a los grupos correspondientes.")}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const isSelected = selectedGroupId === group.id;
            const groupInitial = group.nombre.charAt(0).toUpperCase();
            const lastMsgTime = group.ultimo_mensaje
              ? new Date(group.ultimo_mensaje.created_at).toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';

            return (
              <div
                key={group.id}
                role="button" tabIndex={0} aria-label={t("Abrir grupo {value0}", { value0: group.nombre })}
                  onPointerEnter={event => { if (event.pointerType !== 'touch') { clearTimeout(intentTimer.current); intentTimer.current = setTimeout(() => onIntentGroup?.(group.id), 120); } }}
                  onPointerLeave={() => clearTimeout(intentTimer.current)}
                  onFocus={() => onIntentGroup?.(group.id)}
                  onTouchStart={() => onIntentGroup?.(group.id)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelectGroup(group.id); } }}
                onClick={() => onSelectGroup(group.id)}
                className={`flex items-start gap-3 p-3.5 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-orange-50/70 border-l border-l-[#f78c26]'
                    : 'hover:bg-slate-50 border-l border-l-transparent'
                }`}
              >
                {/* Group Avatar */}
                <div className="relative shrink-0 mt-0.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-brand-500 font-bold text-xs overflow-hidden border border-orange-200/60 shadow-2xs">
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

                {/* Info Container */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-0.5">
                    <h3
                      className={`text-xs font-bold truncate ${
                        isSelected ? 'text-brand-500' : 'text-[#343e48]'
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
                        <span>{t("Multimedia")}</span>
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
