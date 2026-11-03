import { FluentEmoji, EmojiText } from './FluentEmoji';
import { getEmojiOnlyCount, getEmojiMessageSize } from '../../lib/emoji';
import { getRoleLabel } from '../../lib/uiTranslations';
import { useTranslation } from '../../context/LanguageContext';
import React from 'react';
import { MessageActions } from './MessageActions';
import { ReplyPreview } from './ReplyPreview';
import { ChatVideoPlayer } from './ChatVideoPlayer';
import { ChatSystemMessage } from './ChatSystemMessage';
import {
  FileText,
  FileSpreadsheet,
  FileArchive,
  FileCode,
  FileImage,
  Pin,
  CheckCheck,
  Maximize2,
  Download,
} from 'lucide-react';
import { getDocumentInfo } from '../../lib/chatDocumentTypes';
import { downloadRemoteFile } from '../../lib/fileDownload';
import type { ChatMessage } from '../../types/chat';

interface ChatMessageItemProps {
  message: ChatMessage;
  currentUserId: string;
  startsSenderGroup?: boolean;
  isGlobalAdmin: boolean;
  onImageClick: (url: string, caption?: string | null) => void;
  onDocumentClick?: (doc: { url: string; fileName?: string; fileSize?: number; mimeType?: string }) => void;
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
  startsSenderGroup = true,
  isGlobalAdmin,
  onImageClick,
  onDocumentClick,
  onToggleReaction,
  onDeleteMessage, onReply, onPin, onJumpToMessage, onError, pinned, canUnpin,
}) => {
  const { t, locale } = useTranslation();

  const emojiCount = message.tipo === 'texto' ? getEmojiOnlyCount(message.contenido || '') : 0;
  const isEmojiOnly = emojiCount > 0;

  const isMe = message.remitente_id === currentUserId;
  const canDelete = isMe || isGlobalAdmin;
  const tailClass = startsSenderGroup && !isEmojiOnly && message.tipo !== 'sticker' ? (isMe ? 'chat-tail-outgoing' : 'chat-tail-incoming') : '';

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

  if (message.tipo === 'sistema') {
    return (
      <ChatSystemMessage
        message={message}
        timeFormatted={timeFormatted}
        onImageClick={onImageClick}
      />
    );
  }

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
  const hasReactions = Object.keys(reactionCounts).length > 0;

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
        <div data-message-bubble className={`chat-bubble-body relative ${message.reply ? `chat-reply-bubble ${isMe ? 'chat-reply-outgoing' : 'chat-reply-incoming'} ${tailClass}` : ''} ${hasReactions ? 'mb-3.5' : ''}`}>
          <div className={`absolute z-10 ${isEmojiOnly ? (isMe ? 'top-0 -left-7' : 'top-0 -right-7') : 'top-1.5 right-1.5'}`}>
            <MessageActions
              message={message}
              canDelete={canDelete}
              pinned={pinned}
              canUnpin={canUnpin}
              onReply={() => onReply(message)}
              onPin={() => onPin(message)}
              onDelete={() => onDeleteMessage(message.id)}
              onReaction={(emoji) => onToggleReaction(message.id, emoji)}
              onError={onError}
              triggerClassName={
                message.reply
                  ? "message-options-trigger message-options-reply flex h-6 w-6 shrink-0 items-center justify-center rounded-full focus-visible:opacity-100 transition-colors cursor-pointer"
                  : isMe && message.tipo === 'texto' && !isEmojiOnly
                  ? "message-options-trigger flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white/85 hover:text-white hover:bg-black/15 focus-visible:opacity-100 transition-colors cursor-pointer"
                  : message.tipo === 'imagen' || message.tipo === 'video'
                  ? "message-options-trigger flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 focus-visible:opacity-100 transition-colors cursor-pointer"
                  : "message-options-trigger flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 focus-visible:opacity-100 transition-colors cursor-pointer bg-white/80 shadow-2xs"
              }
            />
          </div>
          {message.reply && <button type="button" onClick={() => onJumpToMessage(message.reply!.id)} className="chat-inline-quote block w-full max-w-full" aria-label={t('Ver mensaje original')}>
            <ReplyPreview message={message.reply} currentUserId={currentUserId} />
          </button>}

          {message.tipo === 'audio' && message.media_url && (
            <div className={`relative ${message.reply ? '' : tailClass} rounded-2xl p-2.5 shadow-2xs ${
              isMe
                ? 'bg-brand-500 text-white rounded-tr-xs'
                : 'bg-white border border-slate-200 text-[#343e48] rounded-tl-xs'
            }`}>
              <audio controls preload="none" src={message.media_url} className="max-w-full" aria-label={t('Nota de voz')} />
              <div className={`flex items-center justify-end gap-1 mt-1 text-[10px] select-none ${
                isMe ? 'text-white/85' : 'text-slate-400'
              }`}>
                <span>{timeFormatted}</span>
                {pinned && <Pin size={10} className={isMe ? 'text-white/85' : 'text-slate-400'} />}
                {isMe && <CheckCheck size={12} className={isMe ? 'text-white' : 'text-brand-500'} />}
              </div>
            </div>
          )}
          {message.tipo === 'archivo' && message.media_url && (() => {
            const docInfo = getDocumentInfo(message.media_meta?.fileName, message.media_meta?.mimeType, message.media_url);
            const renderDocIcon = () => {
              switch (docInfo.category) {
                case 'excel':
                  return <FileSpreadsheet size={22} style={{ color: docInfo.primaryColor }} />;
                case 'archive':
                  return <FileArchive size={22} style={{ color: docInfo.primaryColor }} />;
                case 'image':
                  return <FileImage size={22} style={{ color: docInfo.primaryColor }} />;
                case 'text':
                  return <FileCode size={22} style={{ color: docInfo.primaryColor }} />;
                default:
                  return <FileText size={22} style={{ color: docInfo.primaryColor }} />;
              }
            };
            const fileName = message.media_meta?.fileName || message.contenido || t('Documento');
            const fileSize = message.media_meta?.fileSize;
            const mimeType = message.media_meta?.mimeType;

            const handleOpenPreview = () => {
              if (onDocumentClick) {
                onDocumentClick({
                  url: message.media_url!,
                  fileName,
                  fileSize,
                  mimeType,
                });
              } else {
                window.open(message.media_url!, '_blank', 'noopener,noreferrer');
              }
            };
            return (
              <div className={`relative ${!message.reply && tailClass ? "chat-tail-incoming" : ""} flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[#343e48] shadow-2xs max-w-sm`}>
                <div
                  className="flex items-center gap-3 cursor-pointer group/doc hover:opacity-90 transition-opacity pr-6"
                  onClick={handleOpenPreview}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenPreview();
                    }
                  }}
                  title={fileName}
                >
                  <div
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
                    style={{ backgroundColor: docInfo.bgColor, borderColor: docInfo.borderColor }}
                  >
                    {renderDocIcon()}
                    <span
                      className="absolute -bottom-1.5 px-1 py-0.2 rounded text-[7.5px] font-bold text-white uppercase tracking-wider"
                      style={{ backgroundColor: docInfo.primaryColor }}
                    >
                      {docInfo.badgeLabel}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#1e293b] group-hover/doc:text-brand-500 transition-colors" title={fileName}>
                      {fileName}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span>
                        {fileSize
                          ? (fileSize > 1024 * 1024
                              ? (fileSize / (1024 * 1024)).toFixed(1) + ' MB'
                              : (fileSize / 1024).toFixed(0) + ' KB')
                          : docInfo.badgeLabel}
                      </span>
                      <span>•</span>
                      <span className="truncate">{docInfo.typeName}</span>
                    </div>
                  </div>
                </div>

                {/* Renglón de acciones: Preview y Descarga */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleOpenPreview}
                    className="flex flex-1 items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    <span>{t('Vista previa')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void downloadRemoteFile(message.media_url!, fileName);
                    }}
                    className="flex items-center justify-center p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                    title={t('Descargar archivo')}
                  >
                    <Download size={15} />
                  </button>
                </div>

                {/* Renglón extra: Palomitas/Hora */}
                <div className="flex items-center justify-end pt-1 text-[10px] text-slate-400 select-none">
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span>{timeFormatted}</span>
                    {pinned && <Pin size={10} className="text-slate-400" />}
                    {isMe && <CheckCheck size={12} className="text-brand-500" />}
                  </div>
                </div>

                {/* Emoji sobresaliendo en la esquina inferior izquierda */}
                {Object.keys(reactionCounts).length > 0 && (
                  <div className="absolute -bottom-2.5 left-3 z-20">
                    <div className="flex items-center gap-1 rounded-full bg-white px-2 py-0.5 shadow-md border border-slate-200/90 text-slate-700">
                      {Object.entries(reactionCounts).map(([emoji, { count, hasMe, names }]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onToggleReaction(message.id, emoji)}
                          title={names.join(', ')}
                          className={`flex items-center justify-center min-w-[18px] h-5 transition-transform hover:scale-125 cursor-pointer ${
                            hasMe ? 'text-brand-500 font-bold' : 'text-slate-600'
                          }`}
                        >
                          <FluentEmoji emoji={emoji} size={15} />
                          {count > 1 && <span className="text-[10px] font-bold ml-1">{count}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
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
              <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[10px] text-white select-none">
                <span>{timeFormatted}</span>
                {pinned && <Pin size={10} className="text-white/80" />}
                {isMe && <CheckCheck size={12} className="text-white" />}
              </div>
            </div>
          )}

          {/* Type: Video */}
          {message.tipo === 'video' && message.media_url && (
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-xs max-w-sm">
              <ChatVideoPlayer src={message.media_url} />
              <div className="absolute bottom-1.5 right-1.5 z-10 flex items-center gap-1 rounded-md bg-black/60 backdrop-blur-xs px-1.5 py-0.5 text-[10px] text-white select-none pointer-events-none">
                <span>{timeFormatted}</span>
                {pinned && <Pin size={10} className="text-white/80" />}
                {isMe && <CheckCheck size={12} className="text-white" />}
              </div>
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
              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400 select-none">
                <span>{timeFormatted}</span>
                {pinned && <Pin size={10} className="text-slate-400" />}
                {isMe && <CheckCheck size={12} className="text-brand-500" />}
              </div>
            </div>
          )}

          {/* Type: Text or Caption */}
          {Boolean(message.contenido) && message.tipo !== 'archivo' && (
            <div
              className={isEmojiOnly ? 'emoji-only-message py-1' : `relative ${message.reply ? '' : tailClass} rounded-2xl px-3.5 pt-2 pb-1.5 text-xs shadow-2xs break-words ${
                message.tipo !== 'texto' ? 'mt-1.5' : ''
              } ${
                isMe
                  ? 'bg-brand-500 text-white font-medium'
                  : 'bg-white border border-slate-200 text-[#343e48] font-normal'
              }`}
            >
              <div className="whitespace-pre-wrap leading-relaxed pr-5">
                <EmojiText text={message.contenido || ''} size={isEmojiOnly ? getEmojiMessageSize(emojiCount) : 20} />
              </div>
              <div className={`flex items-center justify-end gap-1.5 mt-1 select-none leading-none ${
                isMe && !isEmojiOnly ? 'text-white/85' : 'text-slate-400'
              }`}>
                <span className="text-[10px] font-medium">{timeFormatted}</span>
                {pinned && <Pin size={10} className={isMe && !isEmojiOnly ? 'text-white/85' : 'text-slate-400'} aria-label={t("Mensaje fijado")} />}
                {isMe && <CheckCheck size={13} className={isMe && !isEmojiOnly ? 'text-white' : 'text-brand-500'} />}
              </div>
            </div>
          )}

          {/* Reaction Emoji: circular badge with white background overlapping the bottom left (for non-file messages) */}
          {Object.keys(reactionCounts).length > 0 && message.tipo !== 'archivo' && (
            <div className="absolute -bottom-2.5 left-2.5 z-20">
              <div className="flex items-center gap-1 rounded-full bg-white px-1.5 py-0.5 shadow-md border border-slate-200/90 text-slate-700">
                {Object.entries(reactionCounts).map(([emoji, { count, hasMe, names }]) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onToggleReaction(message.id, emoji)}
                    title={names.join(', ')}
                    className={`flex items-center justify-center min-w-[20px] h-5 transition-transform hover:scale-125 cursor-pointer ${
                      hasMe ? 'text-brand-500 font-bold' : 'text-slate-600'
                    }`}
                  >
                    <FluentEmoji emoji={emoji} size={15} />
                    {count > 1 && <span className="text-[10px] font-bold ml-0.5">{count}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
