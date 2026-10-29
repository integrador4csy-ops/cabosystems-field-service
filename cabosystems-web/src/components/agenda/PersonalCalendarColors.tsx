import { useRef, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { calendarTextColor } from '../../lib/agendaPresentation';
import { validCalendarColor, type CalendarColors } from '../../lib/calendarColorPreferences';

export function PersonalCalendarColors({ calendars, hidden, onToggle, colors, loading, failed, onRetry, onSave, locale }: {
  calendars: { id: string; name: string; backgroundColor?: string | null }[];
  hidden: string[]; onToggle: (id: string) => void; colors: CalendarColors;
  loading: boolean; failed: boolean; onRetry: () => Promise<void>;
  onSave: (id: string, color: string | null) => Promise<void>; locale: string;
}) {
  const en = locale.startsWith('en');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const normalizedDraft = draft === null ? null : `${draft.trim().startsWith('#') ? '' : '#'}${draft.trim()}`;
  const invalidDraft = normalizedDraft !== null && !validCalendarColor(normalizedDraft);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  const save = async (id: string) => {
    if (lock.current || invalidDraft) return;
    lock.current = true; setBusy(true); setError('');
    try { await onSave(id, normalizedDraft); setEditing(null); }
    catch { setError(en ? 'Could not save your color. Try again.' : 'No se pudo guardar tu color. Intenta de nuevo.'); }
    finally { lock.current = false; setBusy(false); }
  };
  return <fieldset className="company-calendar-filters"><legend>{en ? 'My calendars' : 'Mis calendarios'}</legend>
    <p className="calendar-color-help">{en ? 'Colors are only for you.' : 'Los colores son solo para ti.'}</p>
    {failed && <p role="alert" className="calendar-color-help">{en ? 'Could not load your colors.' : 'No se pudieron cargar tus colores.'} <button type="button" className="calendar-color-link" onClick={() => void onRetry()}>{en ? 'Retry' : 'Reintentar'}</button></p>}
    {calendars.map(calendar => {
      const original = calendar.backgroundColor && validCalendarColor(calendar.backgroundColor) ? calendar.backgroundColor : '#343e48';
      const color = colors[calendar.id] || original;
      const iconColor = calendarTextColor(color);
      return <div key={calendar.id}>
        <div className="company-calendar-color-row">
          <label><span className="calendar-filter-checkbox"><input type="checkbox" checked={!hidden.includes(calendar.id)} onChange={() => onToggle(calendar.id)} style={!hidden.includes(calendar.id) ? { backgroundColor: color, borderColor: color } : undefined} /><Check size={16} strokeWidth={3} aria-hidden="true" /></span><span>{calendar.name}</span></label>
          <button type="button" className="calendar-color-toggle" aria-label={`${en ? 'Change color for' : 'Cambiar color de'} ${calendar.name}`} aria-expanded={editing === calendar.id} disabled={loading || failed || busy} onClick={() => { setDraft(color); setError(''); setEditing(editing === calendar.id ? null : calendar.id); }}>
            <span style={{ backgroundColor: color, color: iconColor }}><Palette size={14} aria-hidden="true" /></span>
          </button>
        </div>
        {editing === calendar.id && <div className="calendar-color-editor" role="group" aria-label={`${en ? 'Your color for' : 'Tu color para'} ${calendar.name}`}>
          <div className="calendar-color-fields"><input type="color" value={normalizedDraft && !invalidDraft ? normalizedDraft : original} disabled={busy} aria-label={`${en ? 'Color for' : 'Color de'} ${calendar.name}`} onChange={event => setDraft(event.target.value)} />
          <label className="calendar-color-hex-label">Hex<input className="calendar-color-hex" type="text" value={draft ?? original} disabled={busy} aria-label={`${en ? 'Hex color for' : 'Color hexadecimal de'} ${calendar.name}`} aria-invalid={invalidDraft} placeholder="#F78C26" maxLength={7} spellCheck={false} autoComplete="off" onChange={event => setDraft(event.target.value)} /></label></div>
          {invalidDraft && <p className="calendar-color-help" role="status">{en ? 'Enter 6 hexadecimal digits, for example #F78C26.' : 'Escribe 6 dígitos hexadecimales, por ejemplo #F78C26.'}</p>}
          {draft === null && <p className="calendar-color-help">{en ? 'Original color will be restored.' : 'Se restaurará el color original.'}</p>}
          <button type="button" className="calendar-color-link" disabled={busy} onClick={() => setDraft(null)}>{en ? 'Use original color' : 'Usar color original'}</button>
          {error && <p role="alert" className="calendar-color-help">{error}</p>}
          <div className="calendar-color-actions"><button type="button" className="workspace-primary" disabled={busy || invalidDraft} onClick={() => void save(calendar.id)}>{busy ? (en ? 'Saving…' : 'Guardando…') : (en ? 'Save' : 'Guardar')}</button><button type="button" className="workspace-button" disabled={busy} onClick={() => setEditing(null)}>{en ? 'Cancel' : 'Cancelar'}</button></div>
        </div>}
      </div>;
    })}
  </fieldset>;
}
