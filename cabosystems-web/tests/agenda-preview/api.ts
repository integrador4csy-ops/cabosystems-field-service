import type { CompanyEvent, EventInput } from '../../src/types/agenda';
import { expandCompanyEvents, NO_RECURRENCE } from '../../src/lib/agendaRecurrence';
let events: CompanyEvent[] = [
  { id: 'delivery', titulo: 'Entrega de casa · Villa 24', tipo: 'evento', fecha: '2026-10-19', hora: '10:00:00', ubicacion: 'Cabo del Sol', descripcion: 'Entrega general con el equipo.', created_at: '' },
  { id: 'rack', titulo: 'Pruebas generales de rack', tipo: 'evento', fecha: '2026-10-21', hora: '09:30:00', ubicacion: 'Taller', descripcion: 'Validación de equipos antes de instalación.', created_at: '' },
  { id: 'reminder', titulo: 'Revisar material para la entrega', tipo: 'recordatorio', fecha: '2026-10-23', hora: null, ubicacion: null, descripcion: 'Confirmar disponibilidad de material.', created_at: '' },
  { id: 'weekend', titulo: 'Entrega de casa en fin de semana', tipo: 'evento', fecha: '2026-10-24', hora: '12:00:00', ubicacion: 'Chileno Bay', descripcion: null, created_at: '' },
].map((event) => ({ ...NO_RECURRENCE, ...event, tipo: event.tipo as CompanyEvent['tipo'] }));
export async function getCompanyEvents(from: string, to: string) { return expandCompanyEvents(events, from, to); }
export async function saveCompanyEvent(id: string | undefined, input: EventInput) {
  const result = { ...input, id: id || crypto.randomUUID(), created_at: '' };
  events = [...events.filter((e) => e.id !== result.id), result]; return result;
}
export async function deleteCompanyEvent(id: string) { events = events.filter((e) => e.id !== id); }
