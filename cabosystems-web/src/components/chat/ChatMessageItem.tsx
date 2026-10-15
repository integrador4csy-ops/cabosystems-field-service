import { FluentEmoji, EmojiText } from './FluentEmoji';
import { getEmojiOnlyCount, getEmojiMessageSize } from '../../lib/emoji';
import { getRoleLabel } from '../../lib/uiTranslations';
import { useTranslation } from '../../context/LanguageContext';
import React from 'react';
import { MessageActions } from './MessageActions';
import { ReplyPreview } from './ReplyPreview';
import {
  Pin,
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
  onReply: (message: ChatMessage) => void;
  onPin: (message: ChatMessage) => void;
  onJumpToMessage: (id: string) => void;
  onError: () => void;
  pinned: boolean;
  canUnpin: boolean;
}


export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  message,
  currentUserId,
  isGlobalAdmin,
  onImageClick,
  onToggleReaction,
  onDeleteMessage, onReply, onPin, onJumpToMessage, onError, pinned, canUnpin,
}) => {
  const { t, locale } = useTranslation();

  const emojiCount = message.tipo === 'texto' ? getEmojiOnlyCount(message.contenido || '') : 0;
  const isEmojiOnly = emojiCount > 0;

  const isMe = message.remitente_id === currentUserId;
  const canDelete = isMe || isGlobalAdmin;

  const senderProfile = message.profiles;
  const senderName = isMe ? t("Tú") : senderProfile?.nombre || t("Técnico CaboSystems");
  const senderRole = getRoleLabel(senderProfile?.rol, t);
  const initials = (senderProfile?.nombre || 'T')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const timeFormatted = new Date(message.created_at).toLocaleTimeString(locale, {
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
      id={`chat-message-${message.id}`}
      className={`group/msg relative flex gap-2.5 my-3 items-end transition-all ${
        isMe ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar (for incoming messages) */}
      {!isMe ? (
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-100 text-brand-500 text-xs font-bold shrink-0 overflow-hidden mb-5 shadow-2xs">
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
      <div className={`flex flex-col max-w-[calc(100%-80px)] sm:max-w-[72%] md:max-w-[64%] relative ${isMe ? 'items-end' : 'items-start'}`}>
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

        {/* Bubble Body with Action Toolbar in corner */}
        <div className="relative">
          <div className={`absolute -top-1 z-10 ${isMe ? '-left-9' : '-right-9'}`}>
            <MessageActions message={message} canDelete={canDelete} pinned={pinned} canUnpin={canUnpin}
              onReply={() => onReply(message)} onPin={() => onPin(message)} onDelete={() => onDeleteMessage(message.id)}
              onReaction={(emoji) => onToggleReaction(message.id, emoji)} onError={onError} />
          </div>
          {message.reply && <button type="button" onClick={() => onJumpToMessage(message.reply!.id)} className="mb-1 block w-full max-w-full" aria-label={t('Ver mensaje original')}>
            <ReplyPreview message={message.reply} currentUserId={currentUserId} />
          </button>}

          {/* Type: Image */}
          {message.tipo === 'imagen' && message.media_url && (
            <div
              onClick={() => onImageClick(message.media_url!, message.contenido)}
              className="relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-2xs group/img"
            >
              <img
                src={message.media_url}
                alt={t("Evidencia fotográfica")}
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
                alt={t("Sticker")}
                className="h-28 w-28 object-contain"
              />
            </div>
          )}

          {/* Type: Text or Caption */}
          {Boolean(message.contenido) && (
            <div
              className={isEmojiOnly ? 'emoji-only-message py-1' : `rounded-2xl px-4 py-2.5 text-xs shadow-2xs break-words ${
                message.tipo !== 'texto' ? 'mt-1.5' : ''
              } ${
                isMe
                  ? 'bg-brand-500 text-white font-medium rounded-tr-xs'
                  : 'bg-white border border-slate-200 text-[#343e48] font-normal rounded-tl-xs'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">
                <EmojiText text={message.contenido || ''} size={isEmojiOnly ? getEmojiMessageSize(emojiCount) : 20} />
              </p>
            </div>
          )}
        </div>

        {/* Bottom Time & Delivery info */}
        <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-slate-400 font-medium">
            {timeFormatted}
          </span>
          {pinned && <Pin size={11} className="text-slate-400" aria-label={t("Mensaje fijado")} />}
          {isMe && (
            <CheckCheck size={13} className="text-brand-500" />
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
                    ? 'bg-orange-50 border-orange-200 text-brand-500'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <FluentEmoji emoji={emoji} size={18} />
                <span>{count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
