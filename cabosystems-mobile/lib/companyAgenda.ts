import type { CompanyEvent, EventInput } from '../types/companyAgenda';
import { dateKey, parseDateKey, shiftDate, weekDates, normalizeAgendaSearch } from './agenda';
import { validRecurrence } from './companyAgendaRecurrence';

export type CompanyView = 'month' | 'week' | 'day';
export type CompanyRow = { kind: 'heading'; date: string; count: number } | { kind: 'event'; event: CompanyEvent };
export function canManageCompanyAgenda(profile: { id?: string; activo?: boolean; rol?: string } | null | undefined) {
  return Boolean(profile?.id && profile.activo === true && ['admin', 'supervisor_instalacion'].includes(profile.rol || ''));
}
export function companyDays(anchor: string, view: CompanyView): string[] {
  if (view === 'day') return [anchor];
  if (view === 'week') return weekDates(anchor);
  const date = parseDateKey(anchor);
  const start = weekDates(dateKey(new Date(date.getFullYear(), date.getMonth(), 1, 12)))[0];
  const end = weekDates(dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)))[6];
  const days: string[] = [];
  for (let day = start; day <= end; day = shiftDate(day, 1)) { days.push(day); if (day === end) break; }
  return days;
}
export function companyRows(events: CompanyEvent[], query: string, kind: '' | CompanyEvent['tipo']): CompanyRow[] {
  const terms = normalizeAgendaSearch(query.trim()).split(/\s+/).filter(Boolean);
  const groups = new Map<string, CompanyEvent[]>();
  for (const event of events) {
    if (kind && kind !== event.tipo) continue;
    if (terms.length) {
      const text = normalizeAgendaSearch([event.titulo, event.descripcion, event.ubicacion, event.google?.calendarName].filter(Boolean).join(' '));
      if (!terms.every(term => text.includes(term))) continue;
    }
    const day = event.occurrence_date || event.fecha;
    const group = groups.get(day) || []; group.push(event); groups.set(day, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).flatMap(([date, group]): CompanyRow[] => [
    { kind: 'heading', date, count: group.length },
    ...group.map((event): CompanyRow => ({ kind: 'event', event })),
  ]);
}
export function validCompanyEvent(input: EventInput) {
  return input.titulo.trim().length > 0 && input.titulo.trim().length <= 160
    && (input.descripcion?.length || 0) <= 5000 && (input.ubicacion?.length || 0) <= 240
    && input.fecha >= '1900-01-01' && input.fecha <= '9999-12-31'
    && (!input.hora || /^([01]\d|2[0-3]):[0-5]\d$/.test(input.hora)) && validRecurrence(input);
}
