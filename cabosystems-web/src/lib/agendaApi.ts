import { supabase } from './supabase';
import type { CompanyEvent, EventInput } from '../types/agenda';
import { expandCompanyEvents, validRecurrence } from './agendaRecurrence';

export async function getCompanyEvents(from: string, to: string): Promise<CompanyEvent[]> {
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
  if (!validRecurrence(input)) throw new Error('Invalid recurrence');
  const query = id ? supabase.from('agenda_eventos').update(input).eq('id', id) : supabase.from('agenda_eventos').insert(input);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteCompanyEvent(id: string): Promise<void> {
  const { data, error } = await supabase.from('agenda_eventos').delete().eq('id', id).select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Event not found');
}
