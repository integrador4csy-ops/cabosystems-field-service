import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { dateKey, parseDateKey, shiftDate, shiftMonth, weekDates } from '../../lib/taskDates';

export function AgendaMiniCalendar({ selected, locale, onSelect }: { selected: string; locale: string; onSelect: (day: string) => void }) {
  const en = locale.startsWith('en');
  const [browsed, setBrowsed] = useState<{ selected: string; month: string } | null>(null);
  const [focused, setFocused] = useState<{ selected: string; day: string } | null>(null);
  const grid = useRef<HTMLDivElement>(null);
  const month = browsed?.selected === selected ? browsed.month : selected;
  const first = `${month.slice(0, 7)}-01`;
  const start = weekDates(first)[0];
  const days = Array.from({ length: 42 }, (_, index) => shiftDate(start, index));
  const today = dateKey(new Date());
  const allowed = (day: string) => day >= '1900-01-01' && day <= '9999-12-30';
  const cursor = focused?.selected === selected ? focused.day : selected;
  const tabDay = days.includes(cursor) ? cursor : days.includes(selected) ? selected : first;
  const browse = (direction: number) => setBrowsed({ selected, month: shiftMonth(first, direction) });
  const focus = (day: string) => {
    if (!allowed(day)) return;
    setFocused({ selected, day });
    if (!days.includes(day)) setBrowsed({ selected, month: day });
    requestAnimationFrame(() => grid.current?.querySelector<HTMLButtonElement>(`[data-date="${day}"]`)?.focus());
  };
  return <div className="agenda-mini" role="group" aria-label={en ? 'Mini calendar' : 'Minicalendario'}>
    <div className="agenda-mini-heading"><h3 aria-live="polite">{parseDateKey(first).toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</h3><button type="button" disabled={first <= '1900-01-01'} aria-label={en ? 'Previous month in mini calendar' : 'Mes anterior del minicalendario'} onClick={() => browse(-1)}><ChevronLeft size={16} /></button><button type="button" disabled={first >= '9999-12-01'} aria-label={en ? 'Next month in mini calendar' : 'Mes siguiente del minicalendario'} onClick={() => browse(1)}><ChevronRight size={16} /></button></div>
    <div className="agenda-mini-weekdays" aria-hidden="true">{days.slice(0, 7).map(day => <span key={day}>{parseDateKey(day).toLocaleDateString(locale, { weekday: 'narrow' })}</span>)}</div>
    <div ref={grid} className="agenda-mini-days">{days.map(day => <button key={day} type="button" data-date={day} tabIndex={day === tabDay ? 0 : -1} disabled={!allowed(day)} aria-label={parseDateKey(day).toLocaleDateString(locale, { dateStyle: 'full' })} aria-pressed={day === selected} aria-current={day === today ? 'date' : undefined} className={day.slice(0, 7) !== first.slice(0, 7) ? 'is-outside' : undefined} onClick={() => { setFocused({ selected: day, day }); onSelect(day); }} onKeyDown={event => {
      const offsets: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (event.key in offsets) { event.preventDefault(); focus(shiftDate(day, offsets[event.key])); }
      if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); focus(shiftMonth(day, event.key === 'PageUp' ? -1 : 1)); }
    }}>{parseDateKey(day).getDate()}</button>)}</div>
  </div>;
}
