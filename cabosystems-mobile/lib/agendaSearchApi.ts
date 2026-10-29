import { supabase } from './supabase';
import type { CompanyEvent } from '../types/companyAgenda';
import { localAgendaSearch, sortAgendaSearch, type AgendaSearchResponse } from './agendaSearch';

export function assertSearchActive(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  const error = new Error('Search cancelled'); error.name = 'AbortError'; throw error;
}
export function searchDelay(ms: number, signal?: AbortSignal) {
  assertSearchActive(signal);
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); signal?.removeEventListener('abort', cancel); const error = new Error('Search cancelled'); error.name = 'AbortError'; reject(error); };
    const timer = setTimeout(() => { signal?.removeEventListener('abort', cancel); resolve(); }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
  });
}
async function request<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  assertSearchActive(signal);
  const { data, error } = await supabase.functions.invoke('google-calendar-events', { body, signal });
  assertSearchActive(signal);
  if (error || data?.error) throw new Error('No se pudo completar la búsqueda en Google Calendar. Intenta de nuevo.');
  return data as T;
}
export async function prepareCompanyAgendaSearch(signal?: AbortSignal) {
  return request<{ ready: boolean }>({ action: 'prepare-search' }, signal);
}
export async function getAgendaSearchDates(ids: string[], today: string, signal?: AbortSignal) {
  return (await request<{ dates: { id: string; nextDate: string | null }[] }>({ action: 'search-dates', ids, today }, signal)).dates;
}
export async function searchCompanyAgenda(query: string, today: string, options: {
  signal?: AbortSignal; onUpdate?: (data: AgendaSearchResponse) => void; prepare?: () => Promise<unknown>;
} = {}): Promise<AgendaSearchResponse> {
  const text = query.trim(); const { signal } = options;
  assertSearchActive(signal);
  if (!text) return { hits: [], unavailableCalendars: 0 };
  if (text.length > 160) throw new Error('La búsqueda admite hasta 160 caracteres.');
  let localHits: AgendaSearchResponse['hits'] = []; let googleHits: AgendaSearchResponse['hits'] = [];
  let localDone = false; let googleDone = false; let unavailableCalendars = 0;
  const snapshot = (): AgendaSearchResponse => ({ hits: sortAgendaSearch([...localHits, ...googleHits], today, text), unavailableCalendars, pending: !localDone || !googleDone, googlePending: !googleDone, localPending: !localDone });
  const emit = () => { assertSearchActive(signal); options.onUpdate?.(snapshot()); };
  async function local() {
    const events: CompanyEvent[] = [];
    // The indexed RPC filters in Postgres through the caller's existing RLS.
    for (let offset = 0; ; offset += 500) {
      assertSearchActive(signal);
      const query = supabase.rpc('agenda_search_local', { p_query: text, p_offset: offset, p_limit: 500 });
      const { data, error } = await (signal ? query.abortSignal(signal) : query);
      assertSearchActive(signal);
      if (error) throw error;
      events.push(...(data || []));
      localHits = localAgendaSearch(events, text, today); emit();
      if (!data || data.length < 500) break;
    }
    localDone = true; emit();
  }
  async function remote() {
    let result = await request<AgendaSearchResponse>({ action: 'search', query: text, today }, signal);
    for (let attempt = 0; result.needsRefresh && attempt < 15; attempt++) {
      if (attempt % 5 === 0) await (options.prepare ? options.prepare() : prepareCompanyAgendaSearch(signal));
      assertSearchActive(signal);
      result = await request<AgendaSearchResponse>({ action: 'search', query: text, today }, signal);
      if (result.needsRefresh) await searchDelay(1000, signal);
    }
    if (result.needsRefresh || !Array.isArray(result.hits)) throw new Error('No se pudo preparar la búsqueda de Google Calendar. Intenta de nuevo.');
    googleHits = result.hits; unavailableCalendars = result.unavailableCalendars || 0; googleDone = true; emit();
  }
  const results = await Promise.allSettled([local(), remote()]);
  assertSearchActive(signal);
  const failure = results.find(result => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
  return snapshot();
}
