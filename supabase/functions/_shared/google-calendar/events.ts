import { CalendarError, isWritable, type Actor, type Calendar, type createCalendarService } from './core.ts';
import { digest } from './crypto.ts';
import { syncSearchCalendar } from './search-index.ts';
import { COMPANY_ZONE, eventBody, googleOccurrences, normalizeGoogleEvent, parseIdentity, shiftDay, validDate, validEventInput, zonedInstant, type GoogleEvent } from './events-model.ts';

type Service = ReturnType<typeof createCalendarService>;
class GoogleError extends CalendarError {}
export function createEventService(service: Service, fetcher: typeof fetch = fetch) {
  async function google(path: string, token: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
    let response: Response;
    try { response = await fetcher(`https://www.googleapis.com/calendar/v3/${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers }, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
    catch { throw new CalendarError('No se pudo contactar con Google. Actualiza antes de volver a guardar.', 502); }
    if (!response.ok) {
      const messages: Record<number, string> = { 400: 'Google rechazó los datos del evento. Revisa las fechas y la repetición.', 401: 'Vuelve a autorizar la cuenta Google.', 403: 'La cuenta conectada no tiene permiso para esta operación en Google.', 404: 'El evento ya no existe o el calendario ya no está disponible.', 409: 'El evento ya existe. Actualiza la agenda.', 412: 'El evento cambió en Google. Actualiza antes de editar o eliminar.', 429: 'Google está limitando las consultas. Intenta de nuevo en unos momentos.' };
      throw new GoogleError(messages[response.status] || 'Google no pudo completar la operación. Intenta de nuevo.', response.status === 410 ? 410 : response.status === 401 || response.status === 403 ? 403 : response.status === 404 ? 404 : response.status === 409 || response.status === 412 ? 409 : 502);
    }
    if (response.status === 204) return {};
    return await response.json();
  }
  const calendarPath = (id: string) => `calendars/${encodeURIComponent(id)}/events`;
  async function session(actor: Actor, calendarId: unknown) {
    const current = await service.eventSession(actor, true);
    if (!current.token || !current.connection.selected_calendars.some((item) => item.id === calendarId)) throw new CalendarError('El calendario no está seleccionado para la agenda.', 403);
    const calendar = (await service.eventCalendars(current.token)).find(item => item.id === calendarId);
    if (!calendar || !isWritable(calendar)) throw new CalendarError('Este calendario es de solo consulta. No puedes crear, editar ni eliminar sus eventos.', 403);
    return { ...current, calendar, token: current.token };
  }
  return {
    async prepareSearch(actor: Actor) {
      const initialConnection = await service.indexedEventSession(actor);
      try {
      const { connection, token } = await service.eventSession(actor);
      if (!token || !service.searchIndex) return { ready: true };
      const index = service.searchIndex;
      const current = new Map((await service.eventCalendars(token)).map(calendar => [calendar.id, calendar]));
      let position = 0; let ready = true;
      async function worker() {
        while (position < connection.selected_calendars.length) {
          const selected = connection.selected_calendars[position++];
          const calendar = current.get(selected.id);
          if (!calendar) throw new CalendarError('Un calendario seleccionado ya no está disponible. Revisa la selección.', 409);
          if (calendar.accessRole === 'freeBusyReader') {
            const claim = await index.claim(connection.revision, calendar);
            if (claim.lease) {
              try { await index.commit(connection.revision, calendar, claim.lease, 'availability-only', true, []); }
              finally { await index.release(connection.revision, calendar.id, claim.lease); }
            } else if (!claim.ready) ready = false;
            continue;
          }
          try { await syncSearchCalendar(index, google, connection.revision, calendar, token!); }
          catch (error) { if (error instanceof CalendarError && error.status === 409 && error.message.startsWith('Se está preparando')) { ready = false; continue; } throw error; }
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, connection.selected_calendars.length) }, worker));
      await service.verifyEventSession(actor, connection.revision);
      return { ready };
      } catch (error) {
        if (service.searchIndex && error instanceof CalendarError && [401,403,409].includes(error.status)) {
          await Promise.allSettled(initialConnection.selected_calendars.map(calendar => service.searchIndex!.invalidate(initialConnection.revision, calendar.id)));
        }
        throw error;
      }
    },
    async searchDates(actor: Actor, ids: unknown, today: unknown) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 50 || ids.some(id => typeof id !== 'string') || !validDate(today)) throw new CalendarError('Indica hasta 50 series válidas.');
      const identities = [...new Set(ids as string[])].map(id => { try { return { id, ...parseIdentity(id) }; } catch { throw new CalendarError('La serie no es válida.'); } });
      const { connection, token } = await service.eventSession(actor);
      if (!token || !service.searchIndex) return { dates: [] };
      const selected = new Set(connection.selected_calendars.map(calendar => calendar.id));
      if (identities.some(identity => !selected.has(identity.calendarId))) throw new CalendarError('El calendario no está seleccionado para la agenda.', 403);
      const calendars = new Map((await service.eventCalendars(token)).map(calendar => [calendar.id, calendar]));
      const dates: { id: string; nextDate: string | null }[] = [];
      let position = 0;
      async function worker() {
        while (position < identities.length) {
          const identity = identities[position++]; const calendar = calendars.get(identity.calendarId);
          if (!calendar || calendar.accessRole === 'freeBusyReader') throw new CalendarError('No tienes permiso para consultar esta serie.', 403);
          const [item] = await service.searchIndex!.lookup(connection.revision, calendar.id, [identity.eventId]);
          if (!item?.recurrence?.length) continue;
          const params = new URLSearchParams({ timeMin: zonedInstant(today as string, '00:00'), maxResults: '1', showDeleted: 'false', timeZone: COMPANY_ZONE });
          const pages = new Set<string>(); let nextDate: string | null = null;
          do {
            const data = await google(`${calendarPath(calendar.id)}/${encodeURIComponent(item.id)}/instances?${params}`, token!);
            if (!Array.isArray(data.items)) throw new CalendarError('No se pudo consultar la próxima fecha.', 502);
            const next = data.items.map(item => normalizeGoogleEvent(item as GoogleEvent, calendar)).find(Boolean);
            if (next) { nextDate = next.fecha; break; }
            const page = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
            if (!page) break;
            if (pages.has(page) || pages.size >= 30) throw new CalendarError('No se pudo completar la consulta de fechas.', 502);
            pages.add(page); params.set('pageToken', page);
          } while (true);
          dates.push({ id: identity.id, nextDate });
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, identities.length) }, worker));
      await service.verifyEventSession(actor, connection.revision);
      return { dates };
    },
    async search(actor: Actor, query: unknown, today: unknown) {
      if (typeof query !== 'string' || !query.trim() || query.length > 160 || !validDate(today)) throw new CalendarError('Indica una búsqueda válida de hasta 160 caracteres.');
      if (service.searchIndex) {
        const connection = await service.indexedEventSession(actor);
        if (!connection.refresh_token_ciphertext || !connection.selected_calendars.length) return { hits: [], unavailableCalendars: 0 };
        const calendars = await service.searchIndex.authorizedCalendars(connection.revision, connection.selected_calendars);
        if (!calendars) return { hits: [], unavailableCalendars: 0, needsRefresh: true };
        const readable = calendars.filter(calendar => calendar.accessRole !== 'freeBusyReader');
        const records = readable.length ? await service.searchIndex.search(connection.revision, readable, query) : [];
        const byId = new Map(readable.map(calendar => [calendar.id, calendar]));
        const hits = records.flatMap(row => {
          const calendar = byId.get(row.calendar_id);
          if (!calendar) return [];
          const event = normalizeGoogleEvent(row.payload, calendar);
          if (!event) return [];
          const series = Boolean(row.payload.recurrence?.length);
          return [{ event: series ? { ...event, google: { ...event.google, recurring: true, editable: false } } : event, series, nextDate: null, nextDatePending: series }];
        });
        await service.verifyEventSession(actor, connection.revision);
        return { hits, unavailableCalendars: calendars.length - readable.length };
      }
      const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const terms = normalize(query).trim().split(/\s+/);
      const matches = (item: GoogleEvent, calendar: Calendar) => {
        const text = normalize([item.summary, item.description, item.location, calendar.name].filter(Boolean).join(' '));
        return terms.every(term => text.includes(term));
      };
      const { connection, token } = await service.eventSession(actor);
      if (!token) return { hits: [], unavailableCalendars: 0 };
      const calendars = new Map((await service.eventCalendars(token)).map(calendar => [calendar.id, calendar]));
      const hits: { event: NonNullable<ReturnType<typeof normalizeGoogleEvent>>; series: boolean; nextDate: string | null }[] = [];
      let position = 0; let unavailableCalendars = 0;
      async function worker() {
        while (position < connection.selected_calendars.length) {
          const selected = connection.selected_calendars[position++];
          const calendar = calendars.get(selected.id);
          if (!calendar) throw new CalendarError('Un calendario seleccionado ya no está disponible. Revisa la selección.', 409);
          // Availability-only calendars expose no searchable titles or descriptions.
          if (calendar.accessRole === 'freeBusyReader') { unavailableCalendars++; continue; }
          const params = new URLSearchParams({ singleEvents: 'false', showDeleted: 'false', maxResults: '2500', timeZone: COMPANY_ZONE });
          const seen = new Set<string>();
          let scanned = 0;
          do {
            // No time bounds and no Google q: matching here preserves accent-insensitive substring search.
            const data = await google(`${calendarPath(calendar.id)}?${params}`, token!);
            if (!Array.isArray(data.items)) throw new CalendarError('Google devolvió una lista de eventos inválida.', 502);
            for (const item of data.items as GoogleEvent[]) {
              if (++scanned > 75000) throw new CalendarError('Este calendario es demasiado grande para completar la búsqueda. No se muestran resultados parciales.');
              if (item.status === 'cancelled' || !matches(item, calendar)) continue;
              let event = normalizeGoogleEvent(item, calendar);
              if (!event) continue;
              const series = Boolean(item.recurrence?.length);
              let nextDate: string | null = null;
              if (series) {
                // A master is never handed to the occurrence editor as an editable instance.
                event = { ...event, google: { ...event.google, recurring: true, editable: false } };
                const instanceParams = new URLSearchParams({ timeMin: zonedInstant(today as string, '00:00'), maxResults: '1', showDeleted: 'false', timeZone: COMPANY_ZONE });
                const instancePages = new Set<string>();
                do {
                  const instances = await google(`${calendarPath(calendar.id)}/${encodeURIComponent(item.id)}/instances?${instanceParams}`, token!);
                  if (!Array.isArray(instances.items)) throw new CalendarError('Google no pudo consultar la próxima fecha de una serie.', 502);
                  const next = instances.items.map(item => normalizeGoogleEvent(item as GoogleEvent, calendar)).find(Boolean);
                  if (next) { nextDate = next.fecha; break; }
                  const page = typeof instances.nextPageToken === 'string' ? instances.nextPageToken : '';
                  if (!page) break;
                  if (instancePages.has(page) || instancePages.size >= 30) throw new CalendarError('No se pudo completar la consulta de la próxima fecha de una serie.', 502);
                  instancePages.add(page); instanceParams.set('pageToken', page);
                } while (true);
              }
              hits.push({ event, series, nextDate });
              if (hits.length > 20000) throw new CalendarError('Hay demasiadas coincidencias. Escribe una búsqueda más específica. No se muestran resultados parciales.');
            }
            const next = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
            if (!next) break;
            if (seen.has(next) || seen.size >= 30) throw new CalendarError('No se pudo completar la búsqueda de todas las páginas. Intenta una búsqueda más específica.');
            seen.add(next); params.set('pageToken', next);
          } while (true);
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, connection.selected_calendars.length) }, worker));
      await service.verifyEventSession(actor, connection.revision);
      return { hits: [...new Map(hits.map(hit => [hit.event.id, hit])).values()], unavailableCalendars };
    },
    async selected(actor: Actor) {
      const { connection, token } = await service.eventSession(actor);
      const current = token ? new Map((await service.eventCalendars(token)).map(calendar => [calendar.id, calendar])) : new Map<string, Calendar>();
      const calendars = connection.selected_calendars.map(selected => {
        const calendar = current.get(selected.id);
        if (!calendar) throw new CalendarError('Un calendario seleccionado ya no está disponible. Revisa la selección.', 409);
        return { id: calendar.id, name: calendar.name, timeZone: calendar.timeZone, backgroundColor: calendar.backgroundColor, editable: isWritable(calendar) };
      });
      return { calendars, timeZone: COMPANY_ZONE };
    },
    async list(actor: Actor, from: unknown, to: unknown) {
      if (!validDate(from) || !validDate(to) || to < from || Date.parse(to) - Date.parse(from) > 62 * 86400000) throw new CalendarError('Consulta un periodo válido de hasta 63 días.');
      const { connection, token } = await service.eventSession(actor);
      if (!token) return { events: [], timeZone: COMPANY_ZONE };
      // Calendar colors are user-specific and can change after selection.
      const currentCalendars = new Map((await service.eventCalendars(token)).map((calendar) => [calendar.id, calendar]));
      const result: ReturnType<typeof googleOccurrences> = [];
      let position = 0;
      // Bound concurrency and page count; fail explicitly rather than truncating.
      async function worker() {
        while (position < connection.selected_calendars.length) {
          const selected = connection.selected_calendars[position++];
          const calendar = currentCalendars.get(selected.id);
          if (!calendar) throw new CalendarError('Un calendario seleccionado ya no está disponible. Revisa la selección.', 409);
          if (calendar.accessRole === 'freeBusyReader') {
            let data;
            try {
              data = await google('freeBusy', token!, { method: 'POST', body: JSON.stringify({ timeMin: zonedInstant(from as string, '00:00'), timeMax: zonedInstant(shiftDay(to as string, 1), '00:00'), timeZone: COMPANY_ZONE, items: [{ id: calendar.id }] }) });
            } catch (error) {
              if (error instanceof GoogleError && error.status === 403) throw new CalendarError('Vuelve a autorizar la cuenta Google para permitir consultar la disponibilidad.', 403);
              throw error;
            }
            const calendars = data.calendars as Record<string, { errors?: unknown[]; busy?: { start: string; end: string }[] }> | undefined;
            const availability = calendars?.[calendar.id];
            if (!availability || availability.errors?.length || !Array.isArray(availability.busy)) throw new CalendarError('Google no pudo consultar la disponibilidad de un calendario. Intenta actualizar.', 502);
            for (const interval of availability.busy) {
              if (typeof interval.start !== 'string' || typeof interval.end !== 'string' || !Number.isFinite(Date.parse(interval.start)) || !Number.isFinite(Date.parse(interval.end)) || Date.parse(interval.end) <= Date.parse(interval.start)) throw new CalendarError('Google devolvió un horario de disponibilidad inválido.', 502);
              const id = `busy${await digest(`${calendar.id}/${interval.start}/${interval.end}`)}`;
              result.push(...googleOccurrences({ id, etag: 'availability', summary: 'Ocupado', start: { dateTime: interval.start }, end: { dateTime: interval.end } }, calendar, from as string, to as string));
              if (result.length > 20000) throw new CalendarError('Hay demasiados eventos. Consulta un periodo más corto.');
            }
            continue;
          }
          const query = new URLSearchParams({ singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', timeZone: COMPANY_ZONE, timeMin: zonedInstant(from as string, '00:00'), timeMax: zonedInstant(shiftDay(to as string, 1), '00:00') });
          const seen = new Set<string>();
          do {
            const data = await google(`${calendarPath(calendar.id)}?${query}`, token!);
            if (!Array.isArray(data.items)) throw new CalendarError('Google devolvió una lista de eventos inválida.', 502);
            for (const item of data.items) {
              result.push(...googleOccurrences(item as GoogleEvent, calendar, from as string, to as string));
              if (result.length > 20000) throw new CalendarError('Hay demasiados eventos. Consulta un periodo más corto.');
            }
            const next = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
            if (!next) break;
            if (seen.has(next) || seen.size >= 30) throw new CalendarError('Hay demasiadas páginas de eventos. Consulta un periodo más corto.');
            seen.add(next); query.set('pageToken', next);
          } while (true);
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, connection.selected_calendars.length) }, worker));
      await service.verifyEventSession(actor, connection.revision);
      const unique = [...new Map(result.map((event) => [`${event.id}/${event.occurrence_date}`, event])).values()];
      return { events: unique.sort((a, b) => `${a.occurrence_date}/${a.hora || ''}/${a.id}`.localeCompare(`${b.occurrence_date}/${b.hora || ''}/${b.id}`)), timeZone: COMPANY_ZONE };
    },
    async save(actor: Actor, body: Record<string, unknown>) {
      if (!validEventInput(body.input)) throw new CalendarError('Revisa el título, las fechas, las horas y la repetición.');
      const input = body.input;
      let identity: { calendarId: string; eventId: string } | null = null;
      try { if (body.id) identity = parseIdentity(body.id); } catch { throw new CalendarError('El evento no es válido.'); }
      const { connection, calendar, token } = await session(actor, identity?.calendarId || body.calendarId);
      let event: GoogleEvent;
      if (identity) {
        if (typeof body.etag !== 'string' || !body.etag || body.etag.length > 1024) throw new CalendarError('Actualiza el evento antes de editarlo.', 409);
        const path = `${calendarPath(calendar.id)}/${encodeURIComponent(identity.eventId)}`;
        const current = await google(path, token) as unknown as GoogleEvent;
        if (current.etag !== body.etag) throw new CalendarError('El evento cambió en Google. Actualiza antes de guardar.', 409);
        if (current.locked || current.eventType && current.eventType !== 'default') throw new CalendarError('Este tipo de evento se administra en Google Calendar.', 403);
        let patch;
        try { patch = eventBody(input, current); } catch (error) { throw new CalendarError((error as Error).message); }
        await service.verifyEventSession(actor, connection.revision, true);
        event = await google(`${path}?sendUpdates=none`, token, { method: 'PATCH', headers: { 'If-Match': body.etag }, body: JSON.stringify(patch) }) as unknown as GoogleEvent;
      } else {
        if (typeof body.requestId !== 'string' || !/^[a-f0-9]{32}$/.test(body.requestId)) throw new CalendarError('Vuelve a abrir el formulario para crear el evento.');
        let payload;
        try { payload = eventBody(input); } catch (error) { throw new CalendarError((error as Error).message); }
        const fingerprint = await digest(JSON.stringify(payload));
        const eventId = `c${body.requestId}`;
        (payload.extendedProperties as { private: Record<string, string> }).private.csyRequest = fingerprint;
        await service.verifyEventSession(actor, connection.revision, true);
        try {
          event = await google(`${calendarPath(calendar.id)}?sendUpdates=none`, token, { method: 'POST', body: JSON.stringify({ ...payload, id: eventId }) }) as unknown as GoogleEvent;
        } catch (error) {
          if (!(error instanceof GoogleError) || error.status !== 409) throw error;
          const original = await google(`${calendarPath(calendar.id)}/${eventId}`, token) as unknown as GoogleEvent;
          if (original.extendedProperties?.private?.csyRequest !== fingerprint || original.status === 'cancelled') throw new CalendarError('Este formulario ya creó un evento. Actualiza la agenda antes de continuar.', 409);
          event = original;
        }
      }
      // A recurring master is not a singleEvents result, but it has a valid
      // start/end and is sufficient to acknowledge the write before reloading.
      const normalized = normalizeGoogleEvent(event, calendar);
      if (!normalized) throw new CalendarError('Google guardó el evento. Actualiza la agenda para consultarlo.', 502);
      // A failed cache invalidation must not report an already-completed write as failed.
      try { await service.searchIndex?.invalidate(connection.revision, calendar.id); } catch { /* The 30-second refresh also picks up the write. */ }
      return { event: normalized };
    },
    async remove(actor: Actor, id: unknown, etag: unknown) {
      let identity;
      try { identity = parseIdentity(id); } catch { throw new CalendarError('El evento no es válido.'); }
      if (typeof etag !== 'string' || !etag || etag.length > 1024) throw new CalendarError('Actualiza antes de eliminar el evento.', 409);
      const { connection, calendar, token } = await session(actor, identity.calendarId);
      const path = `${calendarPath(calendar.id)}/${encodeURIComponent(identity.eventId)}`;
      let current: GoogleEvent;
      try { current = await google(path, token) as unknown as GoogleEvent; }
      catch (error) { if (error instanceof GoogleError && error.status === 404) return { deleted: true }; throw error; }
      if (current.status === 'cancelled') return { deleted: true };
      if (current.etag !== etag) throw new CalendarError('El evento cambió en Google. Actualiza antes de eliminar.', 409);
      if (current.locked || current.eventType && current.eventType !== 'default') throw new CalendarError('Este evento se administra en Google Calendar.', 403);
      await service.verifyEventSession(actor, connection.revision, true);
      await google(`${path}?sendUpdates=none`, token, { method: 'DELETE', headers: { 'If-Match': etag } });
      try { await service.searchIndex?.invalidate(connection.revision, calendar.id); } catch { /* Retry through the normal incremental refresh. */ }
      return { deleted: true };
    },
  };
}

export function eventsHandler(service: Service, fetcher: typeof fetch = fetch) {
  const events = createEventService(service, fetcher);
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return Response.json({ error: 'Método no permitido.' }, { status: 405, headers });
    const started = performance.now(); let authenticatedAt = started;
    const responseHeaders = () => ({ ...headers, 'Server-Timing': `auth;dur=${(authenticatedAt - started).toFixed(1)},agenda;dur=${(performance.now() - authenticatedAt).toFixed(1)}` });
    try {
      const actor = await service.requireUser(request);
      authenticatedAt = performance.now();
      if (Number(request.headers.get('content-length') || 0) > 32000) throw new CalendarError('Solicitud demasiado grande.', 413);
      const text = await request.text();
      if (text.length > 32000) throw new CalendarError('Solicitud demasiado grande.', 413);
      let body;
      try { body = JSON.parse(text); } catch { throw new CalendarError('Solicitud inválida.'); }
      if (!body || typeof body !== 'object') throw new CalendarError('Solicitud inválida.');
      let result;
      switch (body.action) {
        case 'prepare-search': result = await events.prepareSearch(actor); break;
        case 'search-dates': result = await events.searchDates(actor, body.ids, body.today); break;
        case 'search': result = await events.search(actor, body.query, body.today); break;
        case 'list': result = await events.list(actor, body.from, body.to); break;
        case 'calendars': result = await events.selected(actor); break;
        case 'save': result = await events.save(actor, body); break;
        case 'delete': result = await events.remove(actor, body.id, body.etag); break;
        default: throw new CalendarError('Acción inválida.');
      }
      return Response.json(result, { headers: responseHeaders() });
    } catch (error) {
      return Response.json({ error: error instanceof CalendarError ? error.message : 'No se pudo consultar Google Calendar. Intenta actualizar de nuevo.' }, { status: error instanceof CalendarError ? error.status : 500, headers: responseHeaders() });
    }
  };
}
