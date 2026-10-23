import type { Calendar } from './core.ts';

export const COMPANY_ZONE = 'America/Mazatlan';
export interface EventInput {
  titulo: string; descripcion: string | null; ubicacion: string | null; tipo: 'evento' | 'recordatorio';
  fecha: string; hora: string | null; repeticion: 'ninguna' | 'diaria' | 'semanal' | 'mensual';
  intervalo: number; dias_semana: number[]; repetir_hasta: string | null;
  fecha_fin?: string; hora_fin?: string | null;
}
export interface GoogleEvent {
  id: string; etag: string; status?: string; summary?: string; description?: string; location?: string;
  created?: string; updated?: string; eventType?: string; locked?: boolean; recurringEventId?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> };
}
export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '9999-12-30' && !Number.isNaN(Date.parse(value)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}
export const shiftDay = (date: string, count: number) => new Date(Date.parse(`${date}T12:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
function parts(instant: number, zone = COMPANY_ZONE) {
  const result = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant).map((item) => [item.type, item.value]));
  return { date: `${result.year.padStart(4, '0')}-${result.month}-${result.day}`, time: `${result.hour}:${result.minute}:${result.second}` };
}
// Reject missing/ambiguous local times rather than silently shifting across DST.
export function zonedInstant(date: string, time: string, zone = COMPANY_ZONE): string {
  const wall = Date.parse(`${date}T${time.length === 5 ? time + ':00' : time}Z`);
  if (!Number.isFinite(wall)) throw new Error('La fecha y hora no son válidas.');
  const matches = new Set<number>();
  for (const sample of [wall - 86400000, wall, wall + 86400000]) {
    const p = parts(sample, zone);
    const offset = Date.parse(`${p.date}T${p.time}Z`) - sample;
    const candidate = wall - offset;
    const actual = parts(candidate, zone);
    if (`${actual.date}T${actual.time}` === `${date}T${time.length === 5 ? time + ':00' : time}`) matches.add(candidate);
  }
  if (matches.size !== 1) throw new Error('La hora no existe o es ambigua en esta zona horaria. Elige otra hora.');
  return new Date([...matches][0]).toISOString();
}
export function eventIdentity(calendar: string, event: string) { return `gcal:${encodeURIComponent(calendar)}:${encodeURIComponent(event)}`; }
export function parseIdentity(value: unknown): { calendarId: string; eventId: string } {
  if (typeof value !== 'string' || value.length > 4000) throw new Error('El evento no es válido.');
  const chunks = value.split(':');
  if (chunks.length !== 3 || chunks[0] !== 'gcal') throw new Error('El evento no es válido.');
  const calendarId = decodeURIComponent(chunks[1]); const eventId = decodeURIComponent(chunks[2]);
  if (!calendarId || !/^[A-Za-z0-9_-]{1,1024}$/.test(eventId) || /[\u0000-\u001f]/.test(calendarId)) throw new Error('El evento no es válido.');
  return { calendarId, eventId };
}
export function normalizeGoogleEvent(event: GoogleEvent, calendar: Calendar) {
  if (!event.id || !event.etag || event.status === 'cancelled') return null;
  const allDay = Boolean(event.start?.date);
  if ((!allDay && !event.start?.dateTime) || (!event.end?.date && !event.end?.dateTime)) return null;
  const start = allDay ? { date: event.start!.date!, time: null } : parts(Date.parse(event.start!.dateTime!));
  const end = allDay ? { date: shiftDay(event.end!.date!, -1), time: null } : parts(Date.parse(event.end!.dateTime!));
  const lastDay = !allDay && end.time === '00:00:00' ? shiftDay(end.date, -1) : end.date;
  return {
    id: eventIdentity(calendar.id, event.id), titulo: event.summary || '(Sin título)', descripcion: event.description || null,
    ubicacion: event.location || null, tipo: 'evento' as const,
    fecha: start.date, hora: start.time, created_at: event.created || '',
    repeticion: 'ninguna' as const, intervalo: 1, dias_semana: [] as number[], repetir_hasta: null,
    google: { calendarId: calendar.id, calendarName: calendar.name, calendarColor: calendar.backgroundColor, etag: event.etag, recurring: Boolean(event.recurringEventId), availabilityOnly: calendar.accessRole === 'freeBusyReader', editable: ['owner', 'writer'].includes(calendar.accessRole) && (!event.eventType || event.eventType === 'default') && !event.locked, endDate: end.date, endTime: end.time, lastDay, timeZone: COMPANY_ZONE },
  };
}
export function googleOccurrences(event: GoogleEvent, calendar: Calendar, from: string, to: string) {
  const row = normalizeGoogleEvent(event, calendar);
  if (!row) return [];
  const result = [];
  const end = row.google.lastDay < to ? row.google.lastDay : to;
  for (let day = row.fecha < from ? from : row.fecha; day <= end; day = shiftDay(day, 1)) result.push({ ...row, occurrence_date: day });
  return result;
}
function recurrence(input: EventInput, timed: boolean): string[] | undefined {
  if (input.repeticion === 'ninguna') return undefined;
  const frequencies = { diaria: 'DAILY', semanal: 'WEEKLY', mensual: 'MONTHLY' };
  let rule = `RRULE:FREQ=${frequencies[input.repeticion]};INTERVAL=${input.intervalo}`;
  if (input.repeticion === 'semanal') rule += `;WKST=MO;BYDAY=${input.dias_semana.map((day) => ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'][day - 1]).join(',')}`;
  if (input.repeticion === 'mensual') {
    // Match CaboSystems' clamp-to-last-day behavior, including days 29–31.
    rule += `;BYMONTHDAY=${Array.from({ length: Number(input.fecha.slice(-2)) }, (_, i) => i + 1).join(',')};BYSETPOS=-1`;
  }
  if (input.repetir_hasta) rule += `;UNTIL=${timed ? zonedInstant(input.repetir_hasta, '23:59:59').replace(/[-:]/g, '').replace('.000', '') : input.repetir_hasta.replace(/-/g, '')}`;
  return [rule];
}
export function validEventInput(input: unknown): input is EventInput {
  if (!input || typeof input !== 'object') return false;
  const e = input as EventInput;
  const text = (value: unknown, max: number) => value === null || value === undefined || typeof value === 'string' && value.length <= max;
  const time = (value: unknown) => value === null || value === undefined || value === '' || typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  return typeof e.titulo === 'string' && e.titulo.trim().length > 0 && e.titulo.length <= 160 && text(e.descripcion, 5000) && text(e.ubicacion, 240)
    && ['evento', 'recordatorio'].includes(e.tipo) && validDate(e.fecha) && time(e.hora) && time(e.hora_fin)
    && (!e.fecha_fin || validDate(e.fecha_fin)) && ['ninguna', 'diaria', 'semanal', 'mensual'].includes(e.repeticion)
    && Number.isInteger(e.intervalo) && e.intervalo >= 1 && e.intervalo <= 365 && Array.isArray(e.dias_semana)
    && e.dias_semana.every((day) => Number.isInteger(day) && day >= 1 && day <= 7) && new Set(e.dias_semana).size === e.dias_semana.length
    && (e.repeticion !== 'semanal' || e.dias_semana.length > 0) && (e.repeticion === 'semanal' || e.dias_semana.length === 0)
    && (!e.repetir_hasta || validDate(e.repetir_hasta) && e.repetir_hasta >= e.fecha)
    && (e.repeticion !== 'ninguna' || e.intervalo === 1 && !e.repetir_hasta);
}
export function eventBody(input: EventInput, existing?: GoogleEvent): Record<string, unknown> {
  const timed = Boolean(input.hora);
  let start: Record<string, string | null>; let end: Record<string, string | null>;
  if (timed) {
    const startInstant = zonedInstant(input.fecha, input.hora!);
    const endInstant = input.hora_fin ? zonedInstant(input.fecha_fin || input.fecha, input.hora_fin) : new Date(Date.parse(startInstant) + 3600000).toISOString();
    if (endInstant <= startInstant) throw new Error('La fecha y hora de fin deben ser posteriores al inicio.');
    start = { dateTime: startInstant, timeZone: COMPANY_ZONE }; end = { dateTime: endInstant, timeZone: COMPANY_ZONE };
  } else {
    const last = input.fecha_fin || input.fecha;
    if (last < input.fecha) throw new Error('La fecha final debe ser igual o posterior al inicio.');
    start = { date: input.fecha }; end = { date: shiftDay(last, 1) };
  }
  const body: Record<string, unknown> = {
    summary: input.titulo.trim(), description: input.descripcion || '', location: input.ubicacion || '', start, end,
    extendedProperties: { ...existing?.extendedProperties, private: { ...existing?.extendedProperties?.private, csyTipo: 'evento' } },
  };
  if (!existing) {
    body.reminders = { useDefault: false };
    const rule = recurrence(input, timed); if (rule) body.recurrence = rule;
  } else {
    // PATCH merges nested fields: explicitly remove the previous representation
    // when switching between date-only and dateTime events.
    if (timed && existing.start?.date) { start.date = null; end.date = null; }
    if (!timed && existing.start?.dateTime) { start.dateTime = null; start.timeZone = null; end.dateTime = null; end.timeZone = null; }
    if (existing.recurringEventId && input.repeticion !== 'ninguna') throw new Error('Edita solo esta ocurrencia; la regla de la serie se administra en Google Calendar.');
    // Preserve exact seconds, offsets and duration when only text changes.
    const originalStart = existing.start?.date ? { date: existing.start.date, time: null } : parts(Date.parse(existing.start!.dateTime!));
    const originalEnd = existing.end?.date ? { date: shiftDay(existing.end.date, -1), time: null } : parts(Date.parse(existing.end!.dateTime!));
    if (input.fecha === originalStart.date && (input.hora || '') === (originalStart.time?.slice(0, 5) || '') && (input.fecha_fin || input.fecha) === originalEnd.date && (input.hora_fin || '') === (originalEnd.time?.slice(0, 5) || '')) {
      delete body.start; delete body.end;
    }
  }
  return body;
}
