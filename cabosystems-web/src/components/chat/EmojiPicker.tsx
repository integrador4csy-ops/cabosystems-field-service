import { useMemo, useRef, useState } from 'react';
import { Smile, Hand, Leaf, Coffee, Car, Volleyball, Lightbulb, Hash, Flag, Clock, Search, X } from 'lucide-react';
import type { EmojiCategory } from '../../lib/emojiCatalog';
import { EMOJI_PICKER_CATALOG as EMOJI_CATALOG } from '../../lib/emojiPickerCatalog';
import { useTranslation } from '../../context/LanguageContext';
import { FluentEmoji } from './FluentEmoji';
import './chatActions.css';

const categories = [
  ['recent', 'Recientes', Clock], ['smileys', 'Caras y emociones', Smile], ['people', 'Personas y gestos', Hand],
  ['nature', 'Animales y naturaleza', Leaf], ['food', 'Comida y bebida', Coffee], ['travel', 'Viajes y lugares', Car],
  ['activities', 'Actividades', Volleyball], ['objects', 'Objetos', Lightbulb], ['symbols', 'Símbolos', Hash], ['flags', 'Banderas', Flag],
] as const;
const recentKey = 'csy_recent_emoji_v1';
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const indexed = EMOJI_CATALOG.map((entry) => ({ entry, search: normalize(entry.slice(0, 4).join(' ')) }));

export default function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const { t, locale } = useTranslation();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<EmojiCategory | 'recent'>('smileys');
  const [scrollTop, setScrollTop] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [recent] = useState<string[]>(() => {
    try { const data: unknown = JSON.parse(localStorage.getItem(recentKey) || '[]'); return Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string').slice(0, 32) : []; }
    catch { return []; }
  });
  const entries = useMemo(() => {
    const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
    if (terms.length) return indexed.filter(({ search }) => terms.every((term) => search.includes(term))).map(({ entry }) => entry);
    if (category === 'recent') return recent.flatMap((emoji) => { const found = EMOJI_CATALOG.find((entry) => entry[0] === emoji); return found ? [found] : []; });
    return EMOJI_CATALOG.filter((entry) => entry[4] === category);
  }, [query, category, recent]);
  const choose = (emoji: string) => {
    try { localStorage.setItem(recentKey, JSON.stringify([emoji, ...recent.filter((x) => x !== emoji)].slice(0, 32))); } catch { /* Storage can be disabled. */ }
    onSelect(emoji);
  };
  const resetScroll = () => { setScrollTop(0); scrollRef.current?.scrollTo(0, 0); };
  const firstRow = Math.max(0, Math.floor(scrollTop / 44) - 2);
  const visible = entries.slice(firstRow * 8, (firstRow + 12) * 8);
  return <section className="emoji-picker">
    <div className="emoji-category-bar" aria-label={t('Categorías de emojis')}>
      {categories.map(([id, label, Icon]) => <button key={id} type="button" title={t(label)} aria-label={t(label)} aria-pressed={!query && id === category}
        onClick={() => { setCategory(id); setQuery(''); resetScroll(); }}><Icon size={18} /></button>)}
      <button type="button" onClick={onClose} aria-label={t('Cerrar selector de emojis')}><X size={17} /></button>
    </div>
    <label className="emoji-search"><Search size={18} /><input autoFocus value={query} aria-label={t('Buscar emojis')} placeholder={t('Buscar emojis...')}
      onChange={(event) => { setQuery(event.target.value); resetScroll(); }} /></label>
    <div className="emoji-section-name">{query ? t('Resultados de búsqueda') : t(categories.find(([id]) => id === category)![1])}<span>{entries.length}</span></div>
    <div ref={scrollRef} className="emoji-scroll" onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}>
      {entries.length ? <div className="emoji-virtual-grid" style={{ height: Math.ceil(entries.length / 8) * 44 }}>
        {visible.map(([emoji, spanish, english], offset) => {
          const index = firstRow * 8 + offset;
          const label = locale.startsWith('es') ? spanish : english;
          return <button key={emoji} type="button" title={label} aria-label={label} style={{ top: Math.floor(index / 8) * 44, left: `${index % 8 * 12.5}%` }}
            onClick={() => choose(emoji)} onKeyDown={(event) => {
              const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 }[event.key];
              if (!step) return;
              event.preventDefault();
              const target = Math.max(0, Math.min(entries.length - 1, index + step));
              scrollRef.current?.scrollTo({ top: Math.max(0, Math.floor(target / 8) * 44 - 88) });
              requestAnimationFrame(() => scrollRef.current?.querySelector<HTMLButtonElement>(`[data-index="${target}"]`)?.focus({ preventScroll: true }));
            }} data-index={index}><FluentEmoji emoji={emoji} size={30} nativeFallback={false} /></button>;
        })}
      </div> : <p className="emoji-empty">{category === 'recent' && !query ? t('Tus emojis recientes aparecerán aquí.') : t('No se encontraron emojis.')}</p>}
    </div>
  </section>;
}
