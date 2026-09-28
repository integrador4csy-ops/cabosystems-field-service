import React, { useState, useRef } from 'react';
import {
  Send,
  Camera,
  Video,
  Smile,
  X,
  Loader2,
} from 'lucide-react';
import { sendChatMessage } from '../../lib/chatApi';
import type { ChatMessageType } from '../../types/chat';

interface ChatInputProps {
  groupId: string;
  currentUserId: string;
  isAdmin: boolean;
  soloMultimedia: boolean;
  onMessageSent: () => void;
}

const EMOJI_LIST = ['👍', '❤️', '🔥', '🛠️', '✅', '😂', '👏', '🙏', '⚡', '📍', '📦', '⚠️'];

export const ChatInput: React.FC<ChatInputProps> = ({
  groupId,
  currentUserId,
  isAdmin,
  soloMultimedia,
  onMessageSent,
}) => {
  const [text, setText] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<ChatMessageType>('texto');
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When solo_multimedia is active and user is not admin, disable regular text
  const isTextBlocked = soloMultimedia && !isAdmin;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      alert('Por favor selecciona una imagen (JPG, PNG) o un video (MP4).');
      return;
    }

    setMediaFile(file);
    setMediaType(isVideo ? 'video' : 'imagen');
    setMediaPreview(URL.createObjectURL(file));
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType('texto');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (sending) return;

    if (!text.trim() && !mediaFile) return;

    // Solo multimedia enforcement
    if (isTextBlocked && !mediaFile) {
      alert('Este grupo está configurado como Solo Multimedia. Debes adjuntar una foto o video.');
      return;
    }

    try {
      setSending(true);
      await sendChatMessage({
        grupo_id: groupId,
        remitente_id: currentUserId,
        tipo: mediaFile ? mediaType : 'texto',
        contenido: text.trim() || undefined,
        mediaFile,
      });

      setText('');
      removeMedia();
      setShowEmojiPicker(false);
      onMessageSent();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
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
    setText((prev) => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
      {/* Solo Multimedia Info Banner if active */}
      {soloMultimedia && (
        <div className="mb-2.5 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-200/80 px-3 py-1.5 text-xs text-amber-800">
          <div className="flex items-center gap-2 font-medium">
            <Video size={14} className="text-amber-600 shrink-0" />
            <span>
              {isTextBlocked
                ? 'Modo Solo Multimedia activo: Envía fotos o videos de evidencia técnica.'
                : 'Modo Solo Multimedia activo (Tienes permisos de administrador para texto).'}
            </span>
          </div>
        </div>
      )}

      {/* Selected Media Preview Bar */}
      {mediaPreview && (
        <div className="mb-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-2.5 animate-in fade-in">
          <div className="relative h-16 w-16 rounded-xl border border-slate-200 bg-black overflow-hidden flex items-center justify-center shrink-0">
            {mediaType === 'video' ? (
              <video
                src={mediaPreview}
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={mediaPreview}
                alt="Preview"
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
              {mediaType === 'video' ? 'Video técnico' : 'Foto de evidencia'}
            </p>
          </div>
          <button
            type="button"
            onClick={removeMedia}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input Bar Form */}
      <form onSubmit={handleSend} className="flex items-end gap-2">
        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Media Attach Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-[#f78c26] hover:border-orange-200 hover:bg-orange-50 transition-all shrink-0 cursor-pointer"
          title="Adjuntar foto o video de evidencia"
        >
          <Camera size={18} />
        </button>

        {/* Emoji Button with Popover */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-[#f78c26] hover:border-orange-200 hover:bg-orange-50 transition-all cursor-pointer"
            title="Insertar emoji"
          >
            <Smile size={18} />
          </button>

          {showEmojiPicker && (
            <div className="absolute bottom-full mb-2 left-0 z-30 grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xl animate-in fade-in zoom-in-95 w-44">
              {EMOJI_LIST.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => handleInsertEmoji(em)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-base hover:scale-125 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  {em}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Text Input Area */}
        <div className="relative flex-1 min-w-0">
          <textarea
            ref={textareaRef}
            rows={1}
            disabled={isTextBlocked}
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
                ? 'Solo multimedia activo. Adjunta una foto o video arriba.'
                : 'Escribe un mensaje técnico... (Enter para enviar)'
            }
            className={`w-full resize-none rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-medium text-[#343e48] placeholder-slate-400 focus:border-[#f78c26] focus:bg-white focus:ring-2 focus:ring-orange-100 outline-hidden transition-all max-h-24 ${
              isTextBlocked ? 'opacity-60 cursor-not-allowed' : ''
            }`}
          />
        </div>

        {/* Send Button */}
        <button
          type="submit"
          disabled={sending || (!text.trim() && !mediaFile) || (isTextBlocked && !mediaFile)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f78c26] hover:bg-[#ea580c] text-white shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          title="Enviar mensaje"
        >
          {sending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </form>
    </div>
  );
};
