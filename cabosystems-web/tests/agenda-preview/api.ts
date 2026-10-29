import type { CompanyEvent, EventInput } from '../../src/types/agenda';
import { expandCompanyEvents, NO_RECURRENCE } from '../../src/lib/agendaRecurrence';
import { localAgendaSearch, sortAgendaSearch } from '../../src/lib/agendaSearch';
import type { AgendaSearchResponse } from '../../src/lib/agendaSearch';
let events: CompanyEvent[] = [
  { id: 'delivery', titulo: 'Entrega de casa · Villa 24', tipo: 'evento', fecha: '2026-10-19', hora: '10:00:00', hora_fin: '11:00:00', ubicacion: 'Cabo del Sol', descripcion: 'Entrega general con el equipo.', created_at: '' },
  { id: 'rack', titulo: 'Pruebas generales de rack', tipo: 'evento', fecha: '2026-10-21', hora: '09:30:00', ubicacion: 'Taller', descripcion: 'Validación de equipos antes de instalación.', created_at: '' },
  { id: 'reminder', titulo: 'Revisar material para la entrega', tipo: 'recordatorio', fecha: '2026-10-23', hora: null, ubicacion: null, descripcion: 'Confirmar disponibilidad de material.', created_at: '' },
  { id: 'weekend', titulo: 'Entrega de casa en fin de semana', tipo: 'evento', fecha: '2026-10-24', hora: '12:00:00', ubicacion: 'Chileno Bay', descripcion: null, created_at: '' },
].map((event) => ({ ...NO_RECURRENCE, ...event, tipo: event.tipo as CompanyEvent['tipo'] }));
events.push(...['Prueba de audio', 'Revisión de red'].map((titulo, index): CompanyEvent => ({
  ...NO_RECURRENCE, id: `google-preview-${index}`, titulo, tipo: 'evento', fecha: '2026-10-20', hora: index ? '10:00:00' : '09:30:00', descripcion: 'Evento ficticio para revisar la distribución semanal.', ubicacion: 'Oficina', created_at: '', occurrence_date: '2026-10-20',
  google: { calendarId: `preview-${index}`, calendarName: index ? 'Oficina' : 'Pruebas CaboSystems', calendarColor: index ? '#f6bf26' : '#b39ddb', etag: 'preview', recurring: false, editable: true, endDate: '2026-10-20', endTime: '11:00:00', lastDay: '2026-10-20', timeZone: 'America/Mazatlan' },
})));
events.push({ ...NO_RECURRENCE, id: 'gcal:preview-busy:busy1', titulo: 'Ocupado', tipo: 'evento', fecha: '2026-10-22', hora: '11:00:00', descripcion: null, ubicacion: null, created_at: '', google: { calendarId: 'preview-busy', calendarName: 'Calendario con disponibilidad', calendarColor: '#8e24aa', etag: 'availability', recurring: false, availabilityOnly: true, editable: false, endDate: '2026-10-22', endTime: '12:30:00', lastDay: '2026-10-22', timeZone: 'America/Mazatlan' } });
export async function getCompanyEvents(from: string, to: string) {
  if (new URLSearchParams(location.search).has('availability-permission-error')) throw new Error('Vuelve a autorizar la cuenta Google para permitir consultar la disponibilidad.');
  if (new URLSearchParams(location.search).has('slow')) await new Promise(resolve => setTimeout(resolve, 2000));
  return expandCompanyEvents(events, from, to);
}
export async function getGoogleCalendars() { return [{ id: 'preview-0', name: 'Pruebas CaboSystems', timeZone: 'America/Mazatlan', backgroundColor: '#b39ddb' }, { id: 'preview-1', name: 'Oficina', timeZone: 'America/Mazatlan', backgroundColor: '#f6bf26' }, { id: 'preview-empty', name: 'Entregas', timeZone: 'America/Mazatlan', backgroundColor: '#0b8043' }]; }
export async function saveCompanyEvent(id: string | undefined, input: EventInput) {
  const result = { ...input, id: id || crypto.randomUUID(), created_at: '' };
  events = [...events.filter((e) => e.id !== result.id), result]; return result;
}
export async function deleteCompanyEvent(id: string) { events = events.filter((e) => e.id !== id); }

const samples: CompanyEvent[] = [
  { ...NO_RECURRENCE, id: 'search-old', titulo: 'Recordar a Sebastián · curso de chofer', fecha: '2026-08-15', hora: '10:00', hora_fin: '11:00', tipo: 'evento', ubicacion: 'Oficina', descripcion: null, created_at: '' },
  { ...NO_RECURRENCE, id: 'search-future', titulo: 'Reunión con Sebastián', fecha: '2027-01-12', hora: '09:00', hora_fin: '10:00', tipo: 'evento', ubicacion: 'Taller', descripcion: null, created_at: '' },
  { ...NO_RECURRENCE, id: 'search-series', titulo: 'Seguimiento a Sebastián', fecha: '2026-01-01', hora: null, repeticion: 'mensual', tipo: 'evento', ubicacion: null, descripcion: null, created_at: '' },
];
events.push(...samples);
export function assertSearchActive(signal?: AbortSignal) { if (signal?.aborted) { const error = new Error('Cancelled'); error.name = 'AbortError'; throw error; } }
export function searchDelay(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); const error = new Error('Cancelled'); error.name = 'AbortError'; reject(error); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
export async function prepareCompanyAgendaSearch() { return { ready: true }; }
export async function getAgendaSearchDates() { return []; }
export async function searchCompanyAgenda(query: string, today: string, options: { signal?: AbortSignal; onUpdate?: (data: AgendaSearchResponse) => void } = {}) {
  assertSearchActive(options.signal);
  const result = { hits: sortAgendaSearch(localAgendaSearch(events, query, today), today, query), unavailableCalendars: 1, pending: false };
  options.onUpdate?.({ ...result, pending: true });
  await new Promise(resolve => setTimeout(resolve, new URLSearchParams(location.search).has('slow') ? 1500 : 100));
  if (new URLSearchParams(location.search).has('search-error')) throw new Error('Simulated search failure');
  assertSearchActive(options.signal);
  return result;
}
