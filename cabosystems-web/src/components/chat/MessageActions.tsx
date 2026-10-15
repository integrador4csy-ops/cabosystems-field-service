import { lazy, Suspense, useCallback, useState } from 'react';
import { ChevronDown, Reply, Copy, Smile, Pin, PinOff, Trash2, Plus, Loader2 } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import type { ChatMessage } from '../../types/chat';
import { ChatPopover } from './ChatPopover';
import { FluentEmoji } from './FluentEmoji';
import './chatActions.css';
const EmojiPicker = lazy(() => import('./EmojiPicker'));
const quickReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function MessageActions({ message, canDelete, pinned, canUnpin, onReply, onPin, onDelete, onReaction, onError }: {
  message: ChatMessage; canDelete: boolean; pinned: boolean; canUnpin: boolean;
  onReply: () => void; onPin: () => void; onDelete: () => void;
  onReaction: (emoji: string) => void; onError: () => void;
}) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [picker, setPicker] = useState(false);
  const close = useCallback(() => { setAnchor(null); setPicker(false); }, []);
  const act = (action: () => void) => { close(); action(); };
  return <>
    <button type="button" className="message-options-trigger flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:opacity-100"
      aria-label={t('Opciones del mensaje')} aria-haspopup="dialog" aria-expanded={Boolean(anchor)}
      onClick={(event) => { if (anchor) close(); else setAnchor(event.currentTarget); }}><ChevronDown size={17} /></button>
    {anchor && <ChatPopover anchor={anchor} onClose={close} width={picker ? 360 : 296} label={picker ? t('Seleccionar reacción') : t('Opciones del mensaje')}>
      {picker ? <Suspense fallback={<div className="p-6"><Loader2 className="animate-spin" /></div>}><EmojiPicker onSelect={(emoji) => act(() => onReaction(emoji))} onClose={close} /></Suspense> : <>
        <div className="message-quick-reactions" aria-label={t('Reacciones rápidas')}>
          {quickReactions.map((emoji) => <button key={emoji} type="button" aria-label={t('Reaccionar con {emoji}', { emoji })} onClick={() => act(() => onReaction(emoji))}><FluentEmoji emoji={emoji} size={28} /></button>)}
          <button type="button" aria-label={t('Más emojis')} onClick={() => setPicker(true)}><Plus size={22} /></button>
        </div>
        <div className="message-menu" onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          const buttons = Array.from(event.currentTarget.querySelectorAll('button'));
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }}>
          <button type="button" onClick={() => act(onReply)}><Reply size={19} />{t('Responder')}</button>
          {message.contenido && <button type="button" onClick={() => { close(); navigator.clipboard.writeText(message.contenido!).catch(onError); }}><Copy size={19} />{t('Copiar mensaje')}</button>}
          <button type="button" onClick={() => setPicker(true)}><Smile size={19} />{t('Reaccionar')}</button>
          {(!pinned || canUnpin) && <button type="button" onClick={() => act(onPin)}>{pinned ? <PinOff size={19} /> : <Pin size={19} />}{pinned ? t('Desfijar mensaje') : t('Fijar mensaje')}</button>}
          {canDelete && <button type="button" className="message-delete" onClick={() => act(onDelete)}><Trash2 size={19} />{t('Eliminar mensaje')}</button>}
        </div>
      </>}
    </ChatPopover>}
  </>;
}
