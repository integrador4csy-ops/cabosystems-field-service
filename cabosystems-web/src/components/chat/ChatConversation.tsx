import { useTranslation } from '../../context/LanguageContext';
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import {
  Pin, PinOff, X,
  Users,
  ArrowLeft,
  Info,
  Search,
  Video,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  getChatMessage, pinChatMessage, unpinChatMessage,
  deleteChatMessage,
  toggleChatReaction,
} from '../../lib/chatApi';
import type { ChatGroup, ChatMessage, ChatPin } from '../../types/chat';
import { ChatMessageItem } from './ChatMessageItem';
import { ReplyPreview } from './ReplyPreview';
import { useDialog } from '../ui/useDialog';
import { ChatInput } from './ChatInput';
import { ImageLightboxModal } from './ImageLightboxModal';
import { useSectionResources } from '../../context/SectionResources';
import { chatSnapshot } from '../../lib/chatSnapshot';

interface ChatConversationProps {
  group: ChatGroup;
  currentUserId: string;
  isGlobalAdmin: boolean;
  onBack: () => void;
  onOpenInfo: () => void;
  onGroupChanged: () => void;
}

export const ChatConversation: React.FC<ChatConversationProps> = ({
  group,
  currentUserId,
  isGlobalAdmin,
  onBack,
  onOpenInfo,
  onGroupChanged,
}) => {
  const { t } = useTranslation();
  const resources = useSectionResources();
  const cached = resources.queries.read<Awaited<ReturnType<typeof chatSnapshot>>>(`conversation:${group.id}`);
  const [messages, setMessages] = useState<ChatMessage[]>(cached?.messages || []);
  const [loading, setLoading] = useState(!cached);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    caption?: string | null;
  } | null>(null);
  const [searchInChat, setSearchInChat] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [pins, setPins] = useState<ChatPin[]>(cached?.pins || []);
  const [showPins, setShowPins] = useState(false);
  const [actionError, setActionError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deletingRef = useRef(false);
  const deleteDialogRef = useDialog(Boolean(deleteTarget), () => { if (!deletingRef.current) setDeleteTarget(null); });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const activeGroupRef = useRef(group.id);
  const loadedGroup = useRef('');
  useLayoutEffect(() => { activeGroupRef.current = group.id; }, [group.id]);
  const scrollToBottom = (smooth = true) => messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });

  const refresh = useCallback(async (force = true) => {
    const { messages: data, pins: pinned } = await resources.queries.load(`conversation:${group.id}`, () => chatSnapshot(group.id), force, 15_000);
    if (activeGroupRef.current !== group.id) return;
    setMessages(data);
    setPins(pinned);
    loadedGroup.current = group.id;
  }, [group.id, resources]);

  useEffect(() => {
    let active = true;
    const initial = loadedGroup.current !== group.id;
    if (initial) {
      const saved = resources.queries.read<Awaited<ReturnType<typeof chatSnapshot>>>(`conversation:${group.id}`);
      setLoading(!saved); setMessages(saved?.messages || []); setPins(saved?.pins || []); setReplyTo(null); setDeleteTarget(null); setShowPins(false);
    }
    setActionError('');
    const report = (error: unknown) => { console.error('Chat refresh failed:', JSON.stringify(error)); if (active) setActionError(t('No se pudo actualizar el chat. Intenta de nuevo.')); };
    refresh(false).then(() => { if (active && initial) requestAnimationFrame(() => scrollToBottom(false)); }).catch(report).finally(() => { if (active) setLoading(false); });
    const reload = () => refresh().catch(report);
    const focus = () => { if (document.visibilityState === 'visible') void refresh(false).catch(report); };
    window.addEventListener('focus', focus);
    const channel = supabase.channel(`chat_web_${group.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_mensajes', filter: `grupo_id=eq.${group.id}` }, () => {
        const container = chatContainerRef.current;
        const atBottom = !container || container.scrollHeight - container.scrollTop - container.clientHeight < 140;
        refresh().then(() => { if (active && atBottom) requestAnimationFrame(() => scrollToBottom()); }).catch(report);
        onGroupChanged();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chat_mensajes' }, (payload) => {
        setMessages((prev) => prev.filter((message) => message.id !== payload.old.id).map((message) => message.reply?.id === payload.old.id ? { ...message, reply: null, reply_to_id: null } : message));
        setReplyTo((prev) => prev?.id === payload.old.id ? null : prev);
        reload();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reacciones' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_pins' }, reload)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_grupos', filter: `id=eq.${group.id}` }, onGroupChanged)
      .subscribe();
    return () => { active = false; window.removeEventListener('focus', focus); supabase.removeChannel(channel); };
  }, [group.id, refresh, onGroupChanged, t, resources]);

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    setActionError('');
    try { await toggleChatReaction(messageId, currentUserId, emoji); await refresh(); }
    catch { setActionError(t('No se pudo guardar la reacción. Intenta de nuevo.')); }
  };
  const handlePin = async (message: ChatMessage) => {
    setActionError('');
    try {
      if (pins.some((pin) => pin.mensaje_id === message.id)) await unpinChatMessage(message.id);
      else await pinChatMessage(message, currentUserId);
      await refresh();
    } catch { setActionError(t('No se pudo cambiar el mensaje fijado. Revisa tus permisos e intenta de nuevo.')); }
  };
  const handleDeleteMessage = async () => {
    if (!deleteTarget || deletingRef.current) return;
    setDeleting(true); deletingRef.current = true; setActionError('');
    try {
      await deleteChatMessage(deleteTarget);
      setReplyTo((prev) => prev?.id === deleteTarget ? null : prev);
      setDeleteTarget(null);
      await refresh(); onGroupChanged();
    } catch { setActionError(t('No se pudo eliminar el mensaje. Revisa tus permisos e intenta de nuevo.')); }
    finally { setDeleting(false); deletingRef.current = false; }
  };
  const jumpToMessage = async (id: string) => {
    setSearchInChat(''); setIsSearching(false);
    try {
      if (!messages.some((message) => message.id === id)) {
        const target = await getChatMessage(id);
        if (!target || target.grupo_id !== group.id) { setActionError(t('El mensaje original ya no está disponible.')); return; }
        setMessages((prev) => prev.some((message) => message.id === id) ? prev : [...prev, target].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)));
      }
      requestAnimationFrame(() => {
        const element = document.getElementById(`chat-message-${id}`);
        element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element?.classList.add('chat-message-highlight');
        window.setTimeout(() => element?.classList.remove('chat-message-highlight'), 1800);
      });
    } catch { setActionError(t('El mensaje original ya no está disponible.')); }
  };

  const groupInitial = group.nombre.charAt(0).toUpperCase();

  const filteredMessages = messages.filter((m) => {
    if (!searchInChat.trim()) return true;
    const q = searchInChat.toLowerCase().trim();
    const content = (m.contenido || '').toLowerCase();
    const sender = (m.profiles?.nombre || '').toLowerCase();
    return content.includes(q) || sender.includes(q);
  });

  return (
    <div className="flex flex-1 flex-col h-full min-w-0 bg-slate-50/40 relative">
      {/* 1. TailAdmin Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 shadow-2xs z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onBack} aria-label={t("Volver a los grupos")} className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><ArrowLeft size={18} /></button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-brand-500 font-bold text-sm shrink-0 overflow-hidden border border-orange-200/80">
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
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#343e48] truncate">
                {group.nombre}
              </h2>
              {group.solo_multimedia && (
                <span className="hidden sm:flex items-center gap-1 rounded-md bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-800 border border-amber-200">
                  <Video size={10} />
                  <span>{t("Solo Multimedia")}</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 truncate">
              <Users size={11} />
              <span>{group.miembros_count || 1} {' '}{t("colaboradores")}</span>
              {group.descripcion && (
                <>
                  <span>•</span>
                  <span className="truncate">{group.descripcion}</span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2">
          {/* Search toggle in chat */}
          {isSearching ? (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1">
              <Search size={13} className="text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder={t("Buscar en el chat...")}
                value={searchInChat}
                onChange={(e) => setSearchInChat(e.target.value)}
                className="w-28 sm:w-44 text-xs font-medium text-[#343e48] outline-hidden bg-transparent"
              />
              <button
                type="button"
                onClick={() => {
                  setIsSearching(false);
                  setSearchInChat('');
                }}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsSearching(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-brand-500 hover:bg-orange-50 transition-colors"
              title={t("Buscar mensajes")}
            >
              <Search size={16} />
            </button>
          )}

          {/* Info Drawer Button */}
          <button
            type="button"
            onClick={onOpenInfo}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-brand-500 hover:bg-orange-50 transition-colors"
            title={t("Información y miembros del grupo")}
          >
            <Info size={16} />
          </button>
        </div>
      </div>

      {pins.length > 0 && <div className="border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
        <button type="button" onClick={() => setShowPins(!showPins)} aria-expanded={showPins} className="flex w-full items-center gap-2 text-left text-xs text-slate-600">
          <Pin size={15} className="shrink-0 text-brand-500" /><span className="font-semibold">{t('Mensajes fijados')}</span><span className="text-slate-400">{pins.length}</span>
          <span className="min-w-0 flex-1 truncate text-slate-400">{pins[0].message?.contenido || t('Multimedia')}</span>
        </button>
        {showPins && <div className="mt-2 max-h-48 space-y-2 overflow-auto">
          {pins.map((pin) => <div key={pin.mensaje_id} className="flex items-center gap-2">
            <button type="button" onClick={() => { setShowPins(false); void jumpToMessage(pin.mensaje_id); }} className="min-w-0 flex-1"><ReplyPreview message={pin.message} currentUserId={currentUserId} /></button>
            {(pin.pinned_by === currentUserId || isGlobalAdmin || group.mi_rol === 'admin') && <button type="button" aria-label={t('Desfijar mensaje')} onClick={() => void handlePin(pin.message)} className="p-2 text-slate-500 hover:bg-slate-50"><PinOff size={16} /></button>}
          </div>)}
        </div>}
      </div>}
      {actionError && <div role="alert" className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2 text-xs text-red-600"><span className="flex-1">{actionError}</span><button type="button" aria-label={t('Cerrar aviso')} onClick={() => setActionError('')}><X size={16} /></button></div>}
      {/* 2. Messages Scroll Area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <Loader2 size={24} className="animate-spin text-brand-500" />
            <span className="text-xs font-medium">{t("Cargando mensajes...")}</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-brand-500 mb-3 border border-orange-200/60">
              <MessageSquare size={24} />
            </div>
            <h4 className="text-sm font-bold text-[#343e48]">
              {searchInChat
                ? t("No se encontraron mensajes")
                : t("¡Inicia la conversación!")}
            </h4>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              {searchInChat
                ? t("Intenta buscar con otra palabra clave.")
                : t("Comparte avances, fotos de evidencia técnica o notas de coordinación.")}
            </p>
          </div>
        ) : (
          <>
            {filteredMessages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                currentUserId={currentUserId}
                isGlobalAdmin={isGlobalAdmin || group.mi_rol === 'admin'}
                onImageClick={(url, cap) =>
                  setLightboxImage({ url, caption: cap })
                }
                onToggleReaction={handleToggleReaction}
                onDeleteMessage={setDeleteTarget}
                onReply={setReplyTo}
                onPin={handlePin}
                onJumpToMessage={jumpToMessage}
                onError={() => setActionError(t('No se pudo copiar el mensaje.'))}
                pinned={pins.some((pin) => pin.mensaje_id === msg.id)}
                canUnpin={isGlobalAdmin || group.mi_rol === 'admin' || pins.some((pin) => pin.mensaje_id === msg.id && pin.pinned_by === currentUserId)}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 3. Input Bar */}
      <ChatInput
        key={group.id}
        groupId={group.id}
        currentUserId={currentUserId}
        isAdmin={isGlobalAdmin || group.mi_rol === 'admin'}
        soloMultimedia={group.solo_multimedia}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onMessageSent={() => {
          refresh().then(() => requestAnimationFrame(() => scrollToBottom())).catch(() => setActionError(t('No se pudo actualizar el chat. Intenta de nuevo.')));
          onGroupChanged();
        }}
      />

      {deleteTarget && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-slate-900/35 p-4" onClick={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null); }}>
        <div ref={deleteDialogRef} role="dialog" aria-modal="true" aria-labelledby="delete-message-title" className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 id="delete-message-title" className="text-base font-semibold text-slate-800">{t('Eliminar mensaje')}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{t('Se eliminará para todos los integrantes del grupo. Esta acción no se puede deshacer.')}</p>
          {actionError && <p role="alert" className="mt-3 text-xs text-red-600">{actionError}</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" disabled={deleting} onClick={() => setDeleteTarget(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600">{t('Cancelar')}</button>
            <button type="button" disabled={deleting} onClick={() => void handleDeleteMessage()} className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white disabled:opacity-50">{deleting ? t('Eliminando...') : t('Eliminar')}</button>
          </div>
        </div>
      </div>}
      {/* 4. Fullscreen Lightbox Modal */}
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
