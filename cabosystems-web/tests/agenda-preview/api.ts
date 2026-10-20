import type { CompanyEvent, EventInput } from '../../src/types/agenda';
import { expandCompanyEvents, NO_RECURRENCE } from '../../src/lib/agendaRecurrence';
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
export async function getCompanyEvents(from: string, to: string) { return expandCompanyEvents(events, from, to); }
export async function getGoogleCalendars() { return [{ id: 'preview-0', name: 'Pruebas CaboSystems', timeZone: 'America/Mazatlan', backgroundColor: '#b39ddb' }, { id: 'preview-1', name: 'Oficina', timeZone: 'America/Mazatlan', backgroundColor: '#f6bf26' }, { id: 'preview-empty', name: 'Entregas', timeZone: 'America/Mazatlan', backgroundColor: '#0b8043' }]; }
export async function saveCompanyEvent(id: string | undefined, input: EventInput) {
  const result = { ...input, id: id || crypto.randomUUID(), created_at: '' };
  events = [...events.filter((e) => e.id !== result.id), result]; return result;
}
export async function deleteCompanyEvent(id: string) { events = events.filter((e) => e.id !== id); }
