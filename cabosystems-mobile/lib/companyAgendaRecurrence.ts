import { dateKey, parseDateKey, shiftDate } from './agenda';
import type { CompanyEvent, EventInput, EventRecurrence } from '../types/companyAgenda';

export const NO_RECURRENCE: EventRecurrence = { repeticion: 'ninguna', intervalo: 1, dias_semana: [], repetir_hasta: null };

function ordinal(day: string): number {
  const date = parseDateKey(day);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
}

export function isoWeekday(day: string): number {
  return ((parseDateKey(day).getDay() + 6) % 7) + 1;
}

export function validRecurrence(input: EventInput): boolean {
  const { repeticion, intervalo, dias_semana, repetir_hasta, fecha, tipo } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || dateKey(parseDateKey(fecha)) !== fecha) return false;
  if (!['ninguna', 'diaria', 'semanal', 'mensual'].includes(repeticion)) return false;
  if (!Number.isInteger(intervalo) || intervalo < 1 || intervalo > 365) return false;
  if (repetir_hasta !== null && (!/^\d{4}-\d{2}-\d{2}$/.test(repetir_hasta) || dateKey(parseDateKey(repetir_hasta)) !== repetir_hasta || repetir_hasta < fecha)) return false;
  if (repeticion === 'ninguna') return intervalo === 1 && dias_semana.length === 0 && repetir_hasta === null;
  if (tipo !== 'recordatorio') return false;
  if (repeticion !== 'semanal') return dias_semana.length === 0;
  return dias_semana.length > 0 && dias_semana.length <= 7 && dias_semana.every((day) => Number.isInteger(day) && day >= 1 && day <= 7);
}

export function occursOn(event: CompanyEvent, day: string): boolean {
  if (day < event.fecha || (event.repetir_hasta && day > event.repetir_hasta)) return false;
  if (event.repeticion === 'ninguna') return event.fecha === day;
  if (event.tipo !== 'recordatorio' || !Number.isInteger(event.intervalo) || event.intervalo < 1) return false;
  if (event.repeticion === 'diaria') return (ordinal(day) - ordinal(event.fecha)) % event.intervalo === 0;
  if (event.repeticion === 'semanal') {
    const startMonday = ordinal(event.fecha) - (isoWeekday(event.fecha) - 1);
    const week = Math.floor((ordinal(day) - startMonday) / 7);
    return week % event.intervalo === 0 && event.dias_semana.includes(isoWeekday(day));
  }
  if (event.repeticion === 'mensual') {
    const start = parseDateKey(event.fecha);
    const current = parseDateKey(day);
    const months = (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth();
    const lastDay = new Date(current.getFullYear(), current.getMonth() + 1, 0, 12).getDate();
    return months % event.intervalo === 0 && current.getDate() === Math.min(start.getDate(), lastDay);
  }
  return false;
}

/** Generate only the visible occurrences; keep the original date and ID for series editing. */
export function expandCompanyEvents(events: CompanyEvent[], from: string, to: string): CompanyEvent[] {
  const occurrences: CompanyEvent[] = [];
  for (const event of events) {
    if (event.repeticion === 'ninguna') {
      if (event.fecha >= from && event.fecha <= to) occurrences.push({ ...event, occurrence_date: event.fecha });
      continue;
    }
    const end = event.repetir_hasta && event.repetir_hasta < to ? event.repetir_hasta : to;
    for (let day = event.fecha > from ? event.fecha : from; day <= end; day = shiftDate(day, 1)) {
      if (occursOn(event, day)) occurrences.push({ ...event, occurrence_date: day });
      if (day === end) break;
    }
  }
  return occurrences.sort((a, b) => a.occurrence_date!.localeCompare(b.occurrence_date!) || (a.hora || '').localeCompare(b.hora || '') || a.titulo.localeCompare(b.titulo) || a.id.localeCompare(b.id));
}
