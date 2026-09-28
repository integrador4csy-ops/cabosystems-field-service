import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  Info,
  Search,
  Video,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  getGroupMessages,
  deleteChatMessage,
  toggleChatReaction,
} from '../../lib/chatApi';
import type { ChatGroup, ChatMessage } from '../../types/chat';
import { ChatMessageItem } from './ChatMessageItem';
import { ChatInput } from './ChatInput';
import { ImageLightboxModal } from './ImageLightboxModal';

interface ChatConversationProps {
  group: ChatGroup;
  currentUserId: string;
  isGlobalAdmin: boolean;
  onOpenInfo: () => void;
  onGroupChanged: () => void;
}

export const ChatConversation: React.FC<ChatConversationProps> = ({
  group,
  currentUserId,
  isGlobalAdmin,
  onOpenInfo,
  onGroupChanged,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    caption?: string | null;
  } | null>(null);
  const [searchInChat, setSearchInChat] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = (smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  };

  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getGroupMessages(group.id, 100);
      setMessages(data);
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
      setTimeout(() => scrollToBottom(false), 100);
    }
  }, [group.id]);

  useEffect(() => {
    loadMessages();

    // Setup Supabase Realtime Subscription for this group
    const channel = supabase
      .channel(`chat_web_${group.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_mensajes',
          filter: `grupo_id=eq.${group.id}`,
        },
        async (payload) => {
          // Fetch sender profile
          const { data: senderProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', payload.new.remitente_id)
            .single();

          const newMsg: ChatMessage = {
            ...(payload.new as ChatMessage),
            profiles: senderProfile,
            reacciones: [],
          };

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setTimeout(() => scrollToBottom(true), 80);
          onGroupChanged();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_mensajes',
        },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_reacciones',
        },
        () => {
          // Refresh reactions
          getGroupMessages(group.id, 100).then((data) => setMessages(data));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_grupos',
          filter: `id=eq.${group.id}`,
        },
        () => {
          onGroupChanged();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [group.id, loadMessages, onGroupChanged]);

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleChatReaction(messageId, currentUserId, emoji);
      // Optimistic reaction toggle
      const refreshed = await getGroupMessages(group.id, 100);
      setMessages(refreshed);
    } catch (err) {
      console.error('Error toggling reaction:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('¿Deseas eliminar este mensaje?')) return;
    try {
      await deleteChatMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Error deleting message:', err);
    }
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-[#f78c26] font-bold text-sm shrink-0 overflow-hidden border border-orange-200/80">
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
                  <span>Solo Multimedia</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5 truncate">
              <Users size={11} />
              <span>{group.miembros_count || 1} colaboradores</span>
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
                placeholder="Buscar en el chat..."
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
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-[#f78c26] hover:bg-orange-50 transition-colors"
              title="Buscar mensajes"
            >
              <Search size={16} />
            </button>
          )}

          {/* Info Drawer Button */}
          <button
            type="button"
            onClick={onOpenInfo}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-[#f78c26] hover:bg-orange-50 transition-colors"
            title="Información y miembros del grupo"
          >
            <Info size={16} />
          </button>
        </div>
      </div>

      {/* 2. Messages Scroll Area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2"
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
            <Loader2 size={24} className="animate-spin text-[#f78c26]" />
            <span className="text-xs font-medium">Cargando mensajes...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#f78c26] mb-3 border border-orange-200/60">
              <MessageSquare size={24} />
            </div>
            <h4 className="text-sm font-bold text-[#343e48]">
              {searchInChat
                ? 'No se encontraron mensajes'
                : '¡Inicia la conversación!'}
            </h4>
            <p className="mt-1 text-xs text-slate-400 max-w-sm">
              {searchInChat
                ? 'Intenta buscar con otra palabra clave.'
                : 'Comparte avances, fotos de evidencia técnica o notas de coordinación.'}
            </p>
          </div>
        ) : (
          <>
            {filteredMessages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                message={msg}
                currentUserId={currentUserId}
                isGlobalAdmin={isGlobalAdmin}
                onImageClick={(url, cap) =>
                  setLightboxImage({ url, caption: cap })
                }
                onToggleReaction={handleToggleReaction}
                onDeleteMessage={handleDeleteMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 3. Input Bar */}
      <ChatInput
        groupId={group.id}
        currentUserId={currentUserId}
        isAdmin={isGlobalAdmin || group.mi_rol === 'admin'}
        soloMultimedia={group.solo_multimedia}
        onMessageSent={() => {
          scrollToBottom(true);
          onGroupChanged();
        }}
      />

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
