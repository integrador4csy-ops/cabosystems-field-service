import type { ChatMessage } from '../../types/chat';
import { useTranslation } from '../../context/LanguageContext';
import { EmojiText } from './FluentEmoji';

export function ReplyPreview({ message, currentUserId }: { message: ChatMessage; currentUserId: string }) {
  const { t } = useTranslation();
  return <div className="chat-reply-preview">
    <div className="min-w-0 flex-1">
      <strong>{message.remitente_id === currentUserId ? t('Tú') : message.profiles?.nombre || t('Colaborador')}</strong>
      <p><EmojiText text={message.contenido || (message.tipo === 'video' ? t('Video') : message.tipo === 'sticker' ? t('Sticker') : t('Foto'))} size={16} /></p>
    </div>
    {(message.media_thumbnail_url || (message.tipo === 'imagen' && message.media_url)) && <img className="reply-thumbnail" src={message.media_thumbnail_url || message.media_url!} alt="" />}
  </div>;
}
