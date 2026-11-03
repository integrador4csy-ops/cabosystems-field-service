import { ChatPopover } from './ChatPopover';
import { ReplyPreview } from './ReplyPreview';
import { useTranslation } from '../../context/LanguageContext';
import React, { lazy, Suspense, useCallback, useEffect, useState, useRef } from 'react';
const EmojiPicker = lazy(() => import('./EmojiPicker'));
import {
  Send,
  Mic, Square, Paperclip, FileText,
  Video,
  Smile,
  X,
  Loader2,
} from 'lucide-react';
import { useVoiceNote } from '../../lib/useVoiceNote';
import { sendChatMessage } from '../../lib/chatApi';
import type { ChatMessage, ChatMessageType } from '../../types/chat';

interface ChatInputProps {
  groupId: string;
  currentUserId: string;
  isAdmin: boolean;
  soloMultimedia: boolean;
  onMessageSent: () => void;
  replyTo: ChatMessage | null;
  onCancelReply: () => void;
}



export const ChatInput: React.FC<ChatInputProps> = ({
  groupId,
  currentUserId,
  isAdmin,
  soloMultimedia,
  onMessageSent, replyTo, onCancelReply,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const sendLock = useRef(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<ChatMessageType>('texto');
  const [sending, setSending] = useState(false);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const closePicker = useCallback(() => setEmojiAnchor(null), []);
  const [sendError, setSendError] = useState(false);
  const [recordError, setRecordError] = useState(false);
  const [audioDuration, setAudioDuration] = useState<number | undefined>();
  const voice = useVoiceNote((file, duration) => { setMediaFile(file); setMediaType('audio'); setAudioDuration(duration); }, () => setRecordError(true));
  useEffect(() => { voice.cancel(); setMediaFile(null); setText(''); setRecordError(false); setSendError(false); }, [groupId, currentUserId, voice.cancel]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (replyTo) textareaRef.current?.focus(); }, [replyTo]);
  useEffect(() => {
    if (!mediaFile) { setMediaPreview(null); return; }
    const preview = URL.createObjectURL(mediaFile);
    setMediaPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [mediaFile]);

  // When solo_multimedia is active and user is not admin, disable regular text
  const isTextBlocked = soloMultimedia && !isAdmin;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (file.size > 50 * 1024 * 1024) { alert(t('El archivo supera 50 MB.')); return; }

    setMediaFile(file);
    setAudioDuration(undefined);
    setMediaType(isVideo ? 'video' : isImage ? 'imagen' : file.type.startsWith('audio/') ? 'audio' : 'archivo');
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType('texto');
    setAudioDuration(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sendLock.current || sending || voice.recording || voice.starting) return;

    if (!text.trim() && !mediaFile) return;

    // Solo multimedia enforcement
    if (isTextBlocked && !mediaFile) {
      alert(t("Este grupo está configurado como Solo Multimedia. Debes adjuntar una foto o video."));
      return;
    }

    try {
      sendLock.current = true;
      setSending(true);
      setSendError(false);
      await sendChatMessage({
        grupo_id: groupId,
        remitente_id: currentUserId,
        tipo: mediaFile ? mediaType : 'texto',
        contenido: text.trim() || undefined,
        mediaFile,
        mediaMeta: mediaFile ? { fileName: mediaFile.name, fileSize: mediaFile.size, mimeType: mediaFile.type, duration: audioDuration } : undefined,
        reply_to_id: replyTo?.id,
      });

      setText('');
      removeMedia();
      closePicker();
      onCancelReply();
      onMessageSent();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setSendError(true);
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    const input = textareaRef.current;
    const start = input?.selectionStart ?? text.length;
    const end = input?.selectionEnd ?? start;
    setText((prev) => prev.slice(0, start) + emoji + prev.slice(end));
    closePicker();
    requestAnimationFrame(() => { input?.focus(); input?.setSelectionRange(start + emoji.length, start + emoji.length); });
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
      {replyTo && <div className="mb-3 flex items-center gap-2" aria-label={t('Respondiendo mensaje')}>
        <ReplyPreview message={replyTo} currentUserId={currentUserId} />
        <button type="button" onClick={onCancelReply} aria-label={t('Cancelar respuesta')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><X size={18} /></button>
      </div>}
      {recordError && <p role="alert" className="mb-2 text-xs text-red-600">{t('No se pudo grabar. Permite el micrófono y abre la página mediante HTTPS o localhost.')}</p>}
      {sendError && <p role="alert" className="mb-2 text-xs text-red-600">{t('No se pudo enviar el mensaje. Intenta de nuevo.')}</p>}
      {/* Solo Multimedia Info Banner if active */}
      {soloMultimedia && (
        <div className="mb-2.5 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-1.5 text-xs text-amber-800">
          <div className="flex items-center gap-2 font-medium">
            <Video size={14} className="text-amber-600 shrink-0" />
            <span>
              {isTextBlocked
                ? t("Modo Solo Multimedia activo: Envía fotos o videos de evidencia técnica.")
                : t("Modo Solo Multimedia activo (Tienes permisos de administrador para texto).")}
            </span>
          </div>
        </div>
      )}

      {/* Selected Media Preview Bar */}
      {mediaPreview && (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 animate-in fade-in">
          <div className="relative h-16 w-16 rounded-xl border border-slate-200 bg-black overflow-hidden flex items-center justify-center shrink-0">
            {mediaType === 'archivo' ? <FileText size={28} className="text-white" /> : mediaType === 'audio' ? <Mic size={28} className="text-white" /> : mediaType === 'video' ? (
              <video
                src={mediaPreview}
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={mediaPreview}
                alt={t("Preview")}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#343e48] truncate">
              {mediaFile?.name}
            </p>
            <p className="text-[11px] text-slate-400">
              {((mediaFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB ·{' '}
              {mediaType === 'audio' ? t('Nota de voz') : mediaType === 'archivo' ? t('Documento') : mediaType === 'video' ? t('Video técnico') : t('Foto de evidencia')}
            </p>
          </div>
          {mediaType === 'audio' && <audio controls src={mediaPreview} className="max-w-[180px]" aria-label={t('Escuchar nota de voz')} />}
          <button
            type="button"
            onClick={removeMedia}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {voice.recording && <div className="mb-2 flex items-center justify-between text-sm text-[#343e48]"><span>{t('Grabando')} {Math.floor(voice.elapsed / 60)}:{String(Math.floor(voice.elapsed % 60)).padStart(2, '0')}</span><button type="button" onClick={voice.cancel} aria-label={t('Descartar grabación')}><X size={20} /></button></div>}
      {/* Input Bar Form */}
      <form onSubmit={handleSend} className="flex items-end gap-2">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="*/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Media Attach Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-brand-500 hover:border-orange-200 hover:bg-orange-50 transition-all shrink-0 cursor-pointer"
          title={t("Adjuntar archivo, foto o video")}
          disabled={sending || voice.recording}
        >
          <Paperclip size={18} />
        </button>

        {/* Emoji Button with Popover */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={(event) => emojiAnchor ? closePicker() : setEmojiAnchor(event.currentTarget)}
            disabled={isTextBlocked || sending || voice.recording}
            aria-expanded={Boolean(emojiAnchor)}
            aria-haspopup="dialog"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-brand-500 hover:border-orange-200 hover:bg-orange-50 transition-all cursor-pointer"
            title={t("Insertar emoji")}
          >
            <Smile size={18} />
          </button>

          {emojiAnchor && <ChatPopover anchor={emojiAnchor} onClose={closePicker} label={t('Selector de emojis')}>
            <Suspense fallback={<div className="p-6"><Loader2 className="animate-spin" /></div>}><EmojiPicker onSelect={handleInsertEmoji} onClose={closePicker} /></Suspense>
          </ChatPopover>}

        </div>

        {/* Text Input Area */}
        <div className="relative flex-1 min-w-0">
          <textarea
            aria-label={t("Mensaje para el grupo")}
            ref={textareaRef}
            rows={1}
            disabled={isTextBlocked || sending || voice.recording}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // Auto-grow height up to 100px
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              isTextBlocked
                ? t("Solo multimedia activo. Adjunta una foto o video arriba.")
                : t("Escribe un mensaje técnico... (Enter para enviar)")
            }
            className={`block h-10 min-h-10 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-[9px] text-xs leading-5 font-medium text-[#343e48] placeholder-slate-400 focus:border-[#f78c26] focus:bg-white focus:ring-2 focus:ring-orange-100 outline-hidden transition-all max-h-[100px] ${
              isTextBlocked ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          />
        </div>

        {/* Send Button */}
        <button
          type="button"
          onClick={() => { if (voice.recording) voice.stop(); else if (text.trim() || mediaFile) void handleSend(); else { setRecordError(false); void voice.start(); } }}
          disabled={sending || voice.starting || (isTextBlocked && Boolean(text.trim()) && !mediaFile)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500 hover:bg-brand-700 text-white shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          title={voice.recording ? t("Detener grabación") : text.trim() || mediaFile ? t("Enviar mensaje") : t("Grabar nota de voz")}
          aria-label={voice.recording ? t("Detener grabación") : text.trim() || mediaFile ? t("Enviar mensaje") : t("Grabar nota de voz")}
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            voice.recording ? <Square size={16} /> : text.trim() || mediaFile ? <Send size={16} /> : <Mic size={18} />
          )}
        </button>
      </form>
    </div>
  );
};
