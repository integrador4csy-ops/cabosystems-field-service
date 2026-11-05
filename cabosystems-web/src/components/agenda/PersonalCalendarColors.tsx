import { useEffect, useRef, useState } from 'react';
import { Check, MoreHorizontal, Plus } from 'lucide-react';
import { calendarTextColor } from '../../lib/agendaPresentation';
import { CALENDAR_COLOR_PALETTE, validCalendarColor, type CalendarColors } from '../../lib/calendarColorPreferences';

export function PersonalCalendarColors({ calendars, hidden, onToggle, colors, loading, failed, onRetry, onSave, locale }: {
  calendars: { id: string; name: string; backgroundColor?: string | null }[];
  hidden: string[]; onToggle: (id: string) => void; colors: CalendarColors;
  loading: boolean; failed: boolean; onRetry: () => Promise<void>;
  onSave: (id: string, color: string | null) => Promise<void>; locale: string;
}) {
  const en = locale.startsWith('en');
  const [editing, setEditing] = useState<string | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const normalizedDraft = draft === null ? null : `${draft.trim().startsWith('#') ? '' : '#'}${draft.trim()}`;
  const invalidDraft = normalizedDraft !== null && !validCalendarColor(normalizedDraft);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const rootRef = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (!editing) return;
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) { setEditing(null); setCustomOpen(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setEditing(null); setCustomOpen(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [editing]);
  const save = async (id: string, nextColor: string | null) => {
    if (lock.current || nextColor !== null && !validCalendarColor(nextColor)) return;
    lock.current = true; setBusy(true); setError('');
    try { await onSave(id, nextColor); setEditing(null); setCustomOpen(false); }
    catch { setError(en ? 'Could not save your color. Try again.' : 'No se pudo guardar tu color. Intenta de nuevo.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <fieldset ref={rootRef} className="company-calendar-filters"><legend>{en ? 'My calendars' : 'Mis calendarios'}</legend>
    <p className="calendar-color-help">{en ? 'Colors are only for you.' : 'Los colores son solo para ti.'}</p>
    {failed && <p role="alert" className="calendar-color-help">{en ? 'Could not load your colors.' : 'No se pudieron cargar tus colores.'} <button type="button" className="calendar-color-link" onClick={() => void onRetry()}>{en ? 'Retry' : 'Reintentar'}</button></p>}
    {calendars.map(calendar => {
      const original = calendar.backgroundColor && validCalendarColor(calendar.backgroundColor) ? calendar.backgroundColor : '#343e48';
      const color = colors[calendar.id] || original;
      return <div key={calendar.id}>
        <div className="company-calendar-color-row">
          <label><span className="calendar-filter-checkbox"><input type="checkbox" checked={!hidden.includes(calendar.id)} onChange={() => onToggle(calendar.id)} style={!hidden.includes(calendar.id) ? { backgroundColor: color, borderColor: color } : undefined} /><Check size={16} strokeWidth={3} aria-hidden="true" /></span><span className="company-calendar-name" title={calendar.name}>{calendar.name}</span></label>
          <button type="button" className="calendar-color-toggle" aria-label={`${en ? 'Change color for' : 'Cambiar color de'} ${calendar.name}`} aria-expanded={editing === calendar.id} disabled={loading || failed || busy} onClick={() => { const opening = editing !== calendar.id; setDraft(color); setError(''); setCustomOpen(false); setEditing(opening ? calendar.id : null); }}>
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>
        </div>
        {editing === calendar.id && <div className="calendar-color-editor" role="group" aria-label={`${en ? 'Your color for' : 'Tu color para'} ${calendar.name}`}>
          <div className="calendar-color-palette">
            {CALENDAR_COLOR_PALETTE.map(preset => <button key={preset} type="button" className="calendar-color-swatch" style={{ backgroundColor: preset, color: calendarTextColor(preset) }} aria-label={`${en ? 'Use color' : 'Usar color'} ${preset}`} aria-pressed={preset.toLowerCase() === color.toLowerCase()} disabled={busy} onClick={() => void save(calendar.id, preset)}>{preset.toLowerCase() === color.toLowerCase() ? <Check size={17} strokeWidth={3} aria-hidden="true" /> : null}</button>)}
            <button type="button" className="calendar-color-swatch calendar-color-custom-toggle" aria-label={en ? 'Custom color' : 'Color personalizado'} aria-expanded={customOpen} disabled={busy} onClick={() => setCustomOpen(value => !value)}><Plus size={18} aria-hidden="true" /></button>
          </div>
          {customOpen && <div className="calendar-color-custom"><div className="calendar-color-fields"><input type="color" value={normalizedDraft && !invalidDraft ? normalizedDraft : original} disabled={busy} aria-label={`${en ? 'Color for' : 'Color de'} ${calendar.name}`} onChange={event => setDraft(event.target.value)} />
            <label className="calendar-color-hex-label">Hex<input className="calendar-color-hex" type="text" value={draft ?? original} disabled={busy} aria-label={`${en ? 'Hex color for' : 'Color hexadecimal de'} ${calendar.name}`} aria-invalid={invalidDraft} placeholder="#F78C26" maxLength={7} spellCheck={false} autoComplete="off" onChange={event => setDraft(event.target.value)} /></label></div>
            {invalidDraft && <p className="calendar-color-help" role="status">{en ? 'Enter 6 hexadecimal digits, for example #F78C26.' : 'Escribe 6 dígitos hexadecimales, por ejemplo #F78C26.'}</p>}
            <div className="calendar-color-actions"><button type="button" className="workspace-primary" disabled={busy || invalidDraft} onClick={() => void save(calendar.id, normalizedDraft)}>{busy ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Save' : 'Guardar')}</button><button type="button" className="workspace-button" disabled={busy} onClick={() => setCustomOpen(false)}>{en ? 'Cancel' : 'Cancelar'}</button></div>
          </div>}
          <button type="button" className="calendar-color-link" disabled={busy} onClick={() => void save(calendar.id, null)}>{en ? 'Use original color' : 'Usar color original'}</button>
          {error && <p role="alert" className="calendar-color-help">{error}</p>}
        </div>}
      </div>;
    })}
  </fieldset>;
}
