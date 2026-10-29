import { supabase } from './supabase';
import type { AgendaGoogleCalendar, CompanyEvent, EventInput } from '../types/companyAgenda';
import { expandCompanyEvents } from './companyAgendaRecurrence';
import { validCompanyEvent } from './companyAgenda';

async function googleRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('google-calendar-events', { body });
  if (error) {
    let message = 'No se pudo consultar Google Calendar. Comprueba tu conexión e intenta de nuevo.';
    try { const response = error.context?.clone?.() || error.context; const result = await response?.json(); if (typeof result?.error === 'string' && result.error.trim()) message = result.error; } catch { /* Keep the actionable fallback if the response is not JSON. */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}
export async function getGoogleCalendars(): Promise<AgendaGoogleCalendar[]> {
  return (await googleRequest<{ calendars: AgendaGoogleCalendar[] }>({ action: 'calendars' })).calendars;
}
export async function getCompanyEvents(from: string, to: string): Promise<CompanyEvent[]> {
  const [local, remote] = await Promise.all([getLocalEvents(from, to), googleRequest<{ events: CompanyEvent[] }>({ action: 'list', from, to })]);
  return [...local, ...remote.events].sort((a, b) => `${a.occurrence_date || a.fecha}/${a.hora || ''}/${a.id}`.localeCompare(`${b.occurrence_date || b.fecha}/${b.hora || ''}/${b.id}`));
}
async function getLocalEvents(from: string, to: string): Promise<CompanyEvent[]> {
  const events: CompanyEvent[] = [];
  // A series can begin before this month. Page results so older series don't hide later ones.
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('agenda_eventos').select('*')
      .lte('fecha', to).or(`fecha.gte.${from},repeticion.neq.ninguna`)
      .or(`repetir_hasta.is.null,repetir_hasta.gte.${from}`)
      .order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    events.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return expandCompanyEvents(events, from, to);
}

export async function saveCompanyEvent(id: string | undefined, input: EventInput): Promise<CompanyEvent> {
  input = { ...input, tipo: 'evento' };
  if (!validCompanyEvent(input)) throw new Error('Invalid event or recurrence');
  if (id?.startsWith('gcal:') || !id && input.calendar_id) return (await googleRequest<{ event: CompanyEvent }>({ action: 'save', id, calendarId: input.calendar_id, etag: input.google_etag, requestId: input.request_id, input })).event;
  const { calendar_id, google_etag: _etag, request_id: _request, fecha_fin: _endDate, ...local } = input;
  if (calendar_id) throw new Error('Cannot move a local event from this form');
  const payload = { ...local, hora_fin: local.hora ? local.hora_fin || null : null };
  const query = id ? supabase.from('agenda_eventos').update(payload).eq('id', id) : supabase.from('agenda_eventos').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteCompanyEvent(id: string, etag?: string): Promise<void> {
  if (id.startsWith('gcal:')) { await googleRequest({ action: 'delete', id, etag }); return; }
  const { data, error } = await supabase.from('agenda_eventos').delete().eq('id', id).select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Event not found');
}
