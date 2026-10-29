import type { CompanyEvent } from '../types/companyAgenda';
import { dateKey, parseDateKey, shiftDate } from './agenda';

export interface AgendaSearchHit { event: CompanyEvent; series: boolean; nextDate: string | null; nextDatePending?: boolean; nextDateUnavailable?: boolean }
export interface AgendaSearchResponse { hits: AgendaSearchHit[]; unavailableCalendars: number; pending?: boolean; needsRefresh?: boolean; googlePending?: boolean; localPending?: boolean }
export const normalizeAgendaQuery = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export function matchesAgendaSearch(event: CompanyEvent, query: string) {
  const text = normalizeAgendaQuery([event.titulo, event.descripcion, event.ubicacion, event.google?.calendarName || 'CaboSystems'].filter(Boolean).join(' '));
  return normalizeAgendaQuery(query).trim().split(/\s+/).filter(Boolean).every(term => text.includes(term));
}

/** Find one upcoming occurrence without expanding an unbounded series. */
export function nextAgendaDate(event: CompanyEvent, today: string): string | null {
  const start = event.fecha > today ? event.fecha : today;
  const interval = event.intervalo;
  const original = parseDateKey(event.fecha);
  let next = event.fecha;
  if (event.repeticion === 'ninguna') return next >= today ? next : null;
  if (!Number.isInteger(interval) || interval < 1) return null;
  const ordinal = (date: string) => { const d = parseDateKey(date); return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000; };
  if (event.repeticion === 'diaria') next = shiftDate(event.fecha, Math.ceil((ordinal(start) - ordinal(event.fecha)) / interval) * interval);
  if (event.repeticion === 'semanal') {
    const weekday = (date: string) => (parseDateKey(date).getDay() + 6) % 7;
    if (!event.dias_semana.length) return null;
    const monday = shiftDate(event.fecha, -weekday(event.fecha));
    const week = Math.floor((ordinal(start) - ordinal(monday)) / 7);
    const activeWeek = Math.ceil(week / interval) * interval;
    const candidates = [activeWeek, activeWeek + interval].flatMap(w => event.dias_semana.map(day => shiftDate(monday, w * 7 + day - 1))).filter(day => day >= start).sort();
    next = candidates[0];
  }
  if (event.repeticion === 'mensual') {
    const current = parseDateKey(start);
    const months = (current.getFullYear() - original.getFullYear()) * 12 + current.getMonth() - original.getMonth();
    const candidate = (offset: number) => {
      const last = new Date(original.getFullYear(), original.getMonth() + offset + 1, 0, 12);
      return dateKey(new Date(last.getFullYear(), last.getMonth(), Math.min(original.getDate(), last.getDate()), 12));
    };
    const offset = Math.floor(months / interval) * interval;
    next = candidate(offset);
    if (next < start) next = candidate(offset + interval);
  }
  return next && next <= '9999-12-31' && (!event.repetir_hasta || next <= event.repetir_hasta) ? next : null;
}
export function localAgendaSearch(events: CompanyEvent[], query: string, today: string): AgendaSearchHit[] {
  return events.filter(event => matchesAgendaSearch(event, query)).map(event => {
    const series = event.repeticion !== 'ninguna';
    const nextDate = series ? nextAgendaDate(event, today) : null;
    return { event: { ...event, occurrence_date: nextDate || event.fecha }, series, nextDate };
  });
}
export function agendaSearchRelevance(event: CompanyEvent, query: string): number {
  const text = normalizeAgendaQuery(query).trim().replace(/\s+/g, ' ');
  if (!text) return 0;
  const title = normalizeAgendaQuery(event.titulo);
  if (title === text) return 1000;
  if (title.startsWith(text)) return 900;
  if (title.includes(text)) return 800;
  const terms = text.split(' ');
  const fraction = (value: string | null | undefined) => { const field = normalizeAgendaQuery(value || ''); return terms.filter(term => field.includes(term)).length / terms.length; };
  if (fraction(event.titulo) === 1) return 700;
  return fraction(event.titulo) * 500 + fraction(event.ubicacion) * 70 + fraction(event.google?.calendarName || 'CaboSystems') * 50 + fraction(event.descripcion) * 20;
}
export function sortAgendaSearch(hits: AgendaSearchHit[], today: string, query = '') {
  const scores = new Map(hits.map(hit => [hit.event.id, agendaSearchRelevance(hit.event, query)]));
  return [...hits].sort((a, b) => {
    const left = a.nextDate || a.event.occurrence_date || a.event.fecha; const right = b.nextDate || b.event.occurrence_date || b.event.fecha;
    const pastA = left < today; const pastB = right < today;
    return scores.get(b.event.id)! - scores.get(a.event.id)! || Number(pastA) - Number(pastB) || (pastA ? right.localeCompare(left) : left.localeCompare(right)) || (a.event.hora || '').localeCompare(b.event.hora || '') || a.event.id.localeCompare(b.event.id);
  });
}
