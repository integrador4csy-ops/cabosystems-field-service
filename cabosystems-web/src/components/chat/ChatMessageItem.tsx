import React, { useState } from 'react';
import {
  Smile,
  Trash2,
  CheckCheck,
  Maximize2,
} from 'lucide-react';
import type { ChatMessage } from '../../types/chat';

interface ChatMessageItemProps {
  message: ChatMessage;
  currentUserId: string;
  isGlobalAdmin: boolean;
  onImageClick: (url: string, caption?: string | null) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onDeleteMessage: (messageId: string) => void;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '🛠️', '✅', '😂'];

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  currentUserId,
  isGlobalAdmin,
  onImageClick,
  onToggleReaction,
  onDeleteMessage,
}) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const isMe = message.remitente_id === currentUserId;
  const canDelete = isMe || isGlobalAdmin;

  const senderProfile = message.profiles;
  const senderName = isMe ? 'Tú' : senderProfile?.nombre || 'Técnico CaboSystems';
  const senderRole = senderProfile?.rol?.replace(/_/g, ' ') || 'Técnico';
  const initials = (senderProfile?.nombre || 'T')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const timeFormatted = new Date(message.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Aggregate reactions by emoji
  const reactionCounts: { [emoji: string]: { count: number; hasMe: boolean; names: string[] } } = {};
  (message.reacciones || []).forEach((r) => {
    if (!reactionCounts[r.emoji]) {
      reactionCounts[r.emoji] = { count: 0, hasMe: false, names: [] };
    }
    reactionCounts[r.emoji].count += 1;
    if (r.profile_id === currentUserId) {
      reactionCounts[r.emoji].hasMe = true;
    }
    if (r.profiles?.nombre) {
      reactionCounts[r.emoji].names.push(r.profiles.nombre);
    }
  });

  return (
    <div
      className={`group relative flex gap-2.5 my-2.5 transition-all ${
        isMe ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar (for incoming messages or me) */}
      {!isMe ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-[#f78c26] text-xs font-bold shrink-0 overflow-hidden mt-1 shadow-2xs">
          {senderProfile?.avatar_url ? (
            <img
              src={senderProfile.avatar_url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
      ) : null}

      {/* Message Bubble Container */}
      <div className={`flex flex-col max-w-[78%] sm:max-w-[70%] md:max-w-[62%] ${isMe ? 'items-end' : 'items-start'}`}>
        {/* Sender Name & Role (only for other users) */}
        {!isMe && (
          <div className="flex items-center gap-1.5 mb-1 px-1">
            <span className="text-xs font-bold text-[#343e48]">
              {senderName}
            </span>
            <span className="rounded-sm bg-slate-100 px-1.5 py-0.2 text-[9.5px] font-semibold text-slate-500 capitalize">
              {senderRole}
            </span>
          </div>
        )}

        {/* Bubble Body */}
        <div className="relative group/bubble">
          {/* Action Toolbar on Hover */}
          <div
            className={`absolute top-0 -translate-y-1/2 z-10 hidden group-hover/bubble:flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-md ${
              isMe ? 'right-full mr-2' : 'left-full ml-2'
            }`}
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-[#f78c26] hover:bg-orange-50 transition-colors"
                title="Reaccionar"
              >
                <Smile size={13} />
              </button>

              {/* Emoji Picker Popup */}
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-1 flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1.5 shadow-xl z-20 animate-in fade-in zoom-in-95 duration-100">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        onToggleReaction(message.id, emoji);
                        setShowEmojiPicker(false);
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-sm hover:scale-125 hover:bg-slate-100 transition-all cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {canDelete && (
              <button
                type="button"
                onClick={() => onDeleteMessage(message.id)}
                className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                title="Eliminar mensaje"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>

          {/* Type: Image */}
          {message.tipo === 'imagen' && message.media_url && (
            <div
              onClick={() => onImageClick(message.media_url!, message.contenido)}
              className="relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xs group/img"
            >
              <img
                src={message.media_url}
                alt="Evidencia fotográfica"
                className="max-h-72 w-auto max-w-full rounded-2xl object-cover transition-transform duration-200 group-hover/img:scale-102"
              />
              <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover/img:opacity-100 transition-opacity shadow-lg">
                  <Maximize2 size={16} />
                </div>
              </div>
            </div>
          )}

          {/* Type: Video */}
          {message.tipo === 'video' && message.media_url && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-xs max-w-sm">
              <video
                src={message.media_url}
                controls
                className="max-h-72 w-full rounded-2xl"
              />
            </div>
          )}

          {/* Type: Sticker */}
          {message.tipo === 'sticker' && message.media_url && (
            <div className="py-1">
              <img
                src={message.media_url}
                alt="Sticker"
                className="h-28 w-28 object-contain"
              />
            </div>
          )}

          {/* Type: Text or Caption */}
          {Boolean(message.contenido) && (
            <div
              className={`rounded-2xl px-4 py-2.5 text-xs shadow-2xs break-words ${
                message.tipo !== 'texto' ? 'mt-1.5' : ''
              } ${
                isMe
                  ? 'bg-[#f78c26] text-white font-medium rounded-tr-xs'
                  : 'bg-white border border-slate-200 text-[#343e48] font-normal rounded-tl-xs'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">
                {message.contenido}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Time & Delivery info */}
        <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-slate-400 font-medium">
            {timeFormatted}
          </span>
          {isMe && (
            <CheckCheck size={13} className="text-[#f78c26]" />
          )}
        </div>

        {/* Reactions Row */}
        {Object.keys(reactionCounts).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1 px-0.5">
            {Object.entries(reactionCounts).map(([emoji, { count, hasMe, names }]) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggleReaction(message.id, emoji)}
                title={names.join(', ')}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold border transition-all cursor-pointer ${
                  hasMe
                    ? 'bg-orange-50 border-orange-200 text-[#f78c26]'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{emoji}</span>
                <span>{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
