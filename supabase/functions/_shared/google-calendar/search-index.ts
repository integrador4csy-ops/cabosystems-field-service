import { CalendarError, type Calendar } from './core.ts';
import type { GoogleEvent } from './events-model.ts';

export interface GoogleSearchIndex {
  authorizedCalendars(revision: string, calendars: Calendar[]): Promise<Calendar[] | null>;
  lookup(revision: string, calendar: string, ids: string[]): Promise<GoogleEvent[]>;
  claim(revision: string, calendar: Calendar): Promise<{ lease: string | null; ready: boolean; token: string | null }>;
  commit(revision: string, calendar: Calendar, lease: string, token: string, full: boolean, items: GoogleEvent[]): Promise<void>;
  release(revision: string, calendar: string, lease: string): Promise<void>;
  search(revision: string, calendars: Calendar[], query: string): Promise<{ calendar_id: string; payload: GoogleEvent }[]>;
  invalidate(revision: string, calendar: string): Promise<void>;
}
type GoogleRead = (path: string, token: string) => Promise<Record<string, unknown>>;

// Keep only fields needed by search/display. No attendees or private properties in the index.
function document(event: GoogleEvent): GoogleEvent {
  const { id, etag, status, summary, description, location, created, updated, eventType, locked, recurringEventId, recurrence, start, end } = event;
  return { id, etag, status, summary, description, location, created, updated, eventType, locked, recurringEventId, recurrence, start, end };
}
export async function syncSearchCalendar(index: GoogleSearchIndex, google: GoogleRead, revision: string, calendar: Calendar, token: string) {
  const claim = await index.claim(revision, calendar);
  if (!claim.lease) {
    if (!claim.ready) throw new CalendarError('Se está preparando el índice de búsqueda. Intenta de nuevo en unos momentos.', 409);
    return;
  }
  const lease = claim.lease;
  try {
    let syncToken = claim.token;
    for (let attempt = 0; attempt < 2; attempt++) {
      const params = new URLSearchParams({ singleEvents: 'false', showDeleted: 'true', maxResults: '2500' });
      if (syncToken) params.set('syncToken', syncToken);
      const seen = new Set<string>();
      const changes = new Map<string, GoogleEvent>();
      try {
        do {
          const data = await google(`calendars/${encodeURIComponent(calendar.id)}/events?${params}`, token);
          if (!Array.isArray(data.items)) throw new CalendarError('Google devolvió una actualización de búsqueda inválida.', 502);
          for (const item of data.items as GoogleEvent[]) {
            if (!item || typeof item.id !== 'string' || !item.id) throw new CalendarError('Google devolvió un evento de búsqueda inválido.', 502);
            changes.set(item.id, document(item));
            if (changes.size > 75000) throw new CalendarError('Este calendario supera el límite del índice de búsqueda. No se muestran resultados parciales.');
          }
          const next = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
          if (next) {
            if (seen.has(next) || seen.size >= 30) throw new CalendarError('No se pudo completar el índice de todas las páginas de Google.', 502);
            seen.add(next); params.set('pageToken', next); continue;
          }
          if (typeof data.nextSyncToken !== 'string' || !data.nextSyncToken) throw new CalendarError('Google no confirmó la sincronización del índice.', 502);
          // The token and every change become visible together, after the final page.
          await index.commit(revision, calendar, lease, data.nextSyncToken, !syncToken, [...changes.values()]);
          return;
        } while (true);
      } catch (error) {
        if (error instanceof CalendarError && error.status === 410 && syncToken && attempt === 0) { syncToken = null; continue; }
        throw error;
      }
    }
  } finally {
    await index.release(revision, calendar.id, lease);
  }
}
