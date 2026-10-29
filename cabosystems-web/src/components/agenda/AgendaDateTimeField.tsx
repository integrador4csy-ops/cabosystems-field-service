import { layoutViewport } from '../../lib/layoutViewport';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import { agendaDays } from '../../lib/agendaDates';
import { dateKey, parseDateKey, shiftDate, shiftMonth } from '../../lib/taskDates';
import { useDialog } from '../ui/useDialog';
import './AgendaDateTimeField.css';

interface Props {
  type: 'date' | 'time'; value: string; label: string; locale: string;
  onChange: (value: string) => void; min?: string; max?: string; required?: boolean; disabled?: boolean;
}

/** The entire field opens a branded picker; the native input retains form validation. */
export function AgendaDateTimeField({ type, value, label, locale, onChange, min, max, required, disabled }: Props) {
  const en = locale.startsWith('en');
  const uid = useId(); const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const [cursor, setCursor] = useState(value && type === 'date' ? value : dateKey(new Date()));
  const [month, setMonth] = useState(cursor);
  const [yearText, setYearText] = useState(cursor.slice(0, 4));
  const [time, setTime] = useState(value || '09:00');
  const panel = useDialog(open && !disabled, () => setOpen(false));
  const today = dateKey(new Date());
  const days = agendaDays(month, 'month');
  const allowed = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day) && day >= (min || '1900-01-01') && day <= (max || '9999-12-31');
  const choose = (next: string) => { onChange(next); setOpen(false); };
  const moveMonth = (next: string) => { setMonth(next); setCursor(next); setYearText(next.slice(0, 4)); };
  const show = () => {
    const day = type === 'date' && value ? value : today;
    setPortalHost(trigger.current?.closest<HTMLElement>('[role="dialog"]') || document.body);
    setCursor(day); moveMonth(day); setTime(value || '09:00'); setOpen(true);
  };
  useLayoutEffect(() => {
    if (!open || disabled) return;
    const position = () => {
      const layout = layoutViewport(); const anchor = trigger.current ? layout.rect(trigger.current) : undefined; const picker = panel.current;
      if (!anchor || !picker) return;
      const width = Math.min(type === 'date' ? 280 : 220, layout.width - 16);
      picker.style.width = `${width}px`;
      const below = anchor.bottom + 6;
      picker.style.maxHeight = `${Math.max(0, layout.height - below - 8)}px`;
      picker.style.left = `${Math.max(8, Math.min(anchor.left, layout.width - width - 8))}px`;
      picker.style.top = `${below}px`;
      picker.style.visibility = 'visible';
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !trigger.current?.contains(event.target) && !panel.current?.contains(event.target)) setOpen(false);
    };
    position(); document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', position, true); window.addEventListener('resize', position);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('scroll', position, true); window.removeEventListener('resize', position); };
  }, [open, disabled, type, panel]);
  useEffect(() => {
    if (!open || disabled) return;
    const frame = requestAnimationFrame(() => {
      const selected = panel.current?.querySelector<HTMLButtonElement>('[data-current="true"]');
      selected?.focus({ preventScroll: true }); selected?.scrollIntoView({ block: 'nearest' });
      panel.current?.querySelectorAll<HTMLElement>('.agenda-picker-time-options .is-selected').forEach(option => option.scrollIntoView({ block: 'nearest' }));
    });
    return () => cancelAnimationFrame(frame);
  }, [open, disabled, panel]);
  const focusDay = (day: string) => {
    if (!allowed(day) || day < '1900-01-01' || day > '9999-12-31') return;
    setCursor(day); moveMonth(day);
    requestAnimationFrame(() => panel.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"]`)?.focus());
  };
  const changeYear = () => {
    const year = Number(yearText);
    if (Number.isInteger(year) && year >= 1900 && year <= 9999) moveMonth(`${year}-${month.slice(5, 7)}-01`);
    else setYearText(month.slice(0, 4));
  };
  const display = type === 'date' ? value ? parseDateKey(value).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : en ? 'Choose date' : 'Elegir fecha' : value || '--:--';
  const Icon = type === 'date' ? CalendarDays : Clock3;
  return <span className="company-picker">
    <input className="company-picker-native" type={type} value={value} min={min} max={max} required={required} disabled={disabled} tabIndex={-1} aria-hidden="true" onChange={event => onChange(event.target.value)} onInvalid={event => { event.preventDefault(); trigger.current?.focus(); }} />
    <button ref={trigger} type="button" className="company-picker-trigger" aria-label={label} aria-haspopup="dialog" aria-expanded={open && !disabled} aria-controls={open ? uid : undefined} disabled={disabled} onClick={() => open ? setOpen(false) : show()}><span>{display}</span><Icon size={17} aria-hidden="true" /></button>
    {open && !disabled && portalHost && createPortal(<div ref={panel} id={uid} role="dialog" aria-modal="true" aria-label={label} className="agenda-picker-panel" style={{ visibility: 'hidden' }}>
      <div className="agenda-picker-caption">{label}{type === 'time' && <strong>{time}</strong>}</div>
      {type === 'date' ? <>
        <div className="agenda-picker-month">
          <button type="button" aria-label={en ? 'Previous month' : 'Mes anterior'} disabled={month.slice(0, 7) <= '1900-01'} onClick={() => moveMonth(shiftMonth(month, -1))}><ChevronLeft size={17} /></button>
          <select aria-label={en ? 'Month' : 'Mes'} value={Number(month.slice(5, 7)) - 1} onChange={event => moveMonth(`${month.slice(0, 4)}-${String(Number(event.target.value) + 1).padStart(2, '0')}-01`)}>{Array.from({ length: 12 }, (_, index) => <option key={index} value={index}>{new Date(2024, index, 1).toLocaleDateString(locale, { month: 'long' })}</option>)}</select>
          <input aria-label={en ? 'Year' : 'Año'} type="number" min={1900} max={9999} value={yearText} onChange={event => setYearText(event.target.value)} onBlur={changeYear} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); changeYear(); } }} />
          <button type="button" aria-label={en ? 'Next month' : 'Mes siguiente'} disabled={month.slice(0, 7) >= '9999-12'} onClick={() => moveMonth(shiftMonth(month, 1))}><ChevronRight size={17} /></button>
        </div>
        <div className="agenda-picker-weekdays">{days.slice(0, 7).map(day => <span key={day}>{parseDateKey(day).toLocaleDateString(locale, { weekday: 'short' }).replace('.', '')}</span>)}</div>
        <div className="agenda-picker-days" role="group" aria-label={en ? 'Choose date' : 'Elegir fecha'}>{days.map(day => <button key={day} type="button" data-day={day} data-current={day === cursor} tabIndex={day === cursor ? 0 : -1} aria-label={parseDateKey(day).toLocaleDateString(locale, { dateStyle: 'full' })} aria-pressed={day === value} aria-current={day === today ? 'date' : undefined} disabled={!allowed(day)} className={`${day.slice(0, 7) !== month.slice(0, 7) ? 'is-outside' : ''} ${day === value ? 'is-selected' : ''}`} onClick={() => choose(day)} onKeyDown={event => {
          const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
          if (event.key in offsets) { event.preventDefault(); focusDay(shiftDate(day, offsets[event.key])); }
          if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); focusDay(shiftMonth(day, event.key === 'PageUp' ? -1 : 1)); }
        }}>{parseDateKey(day).getDate()}</button>)}</div>
        <footer><button type="button" disabled={!allowed(today)} onClick={() => choose(today)}>{en ? 'Today' : 'Hoy'}</button><button type="button" onClick={() => setOpen(false)}>{en ? 'Close' : 'Cerrar'}</button></footer>
      </> : <>
        <div className="agenda-picker-time">{[24, 60].map((count, column) => <div key={column}><span>{column === 0 ? en ? 'Hour' : 'Hora' : en ? 'Minute' : 'Minuto'}</span><div className="agenda-picker-time-options" role="group" aria-label={column === 0 ? en ? 'Hour' : 'Hora' : en ? 'Minute' : 'Minuto'}>{Array.from({ length: count }, (_, index) => {
          const part = String(index).padStart(2, '0'); const current = time.split(':')[column] === part;
          return <button type="button" key={part} data-time={`${column}-${part}`} data-current={column === 0 && current} aria-pressed={current} tabIndex={current ? 0 : -1} className={current ? 'is-selected' : ''} onClick={() => { const parts = time.split(':'); parts[column] = part; setTime(parts.join(':')); }} onKeyDown={event => {
            if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
            panel.current?.querySelector<HTMLButtonElement>(`[data-time="${column}-${String(next).padStart(2, '0')}"]`)?.focus();
          }}>{part}</button>;
        })}</div></div>)}</div>
        <footer><button type="button" onClick={() => { const now = new Date(); setTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`); }}>{en ? 'Now' : 'Ahora'}</button><button className="agenda-picker-confirm" type="button" onClick={() => choose(time)}>{en ? 'Done' : 'Listo'}</button></footer>
      </>}
    </div>, portalHost)}
  </span>;
}
