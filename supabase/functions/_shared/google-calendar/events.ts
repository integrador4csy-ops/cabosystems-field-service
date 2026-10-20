import { CalendarError, type Actor, type Calendar, type createCalendarService } from './core.ts';
import { digest } from './crypto.ts';
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
      throw new GoogleError(messages[response.status] || 'Google no pudo completar la operación. Intenta de nuevo.', response.status === 401 || response.status === 403 ? 403 : response.status === 404 ? 404 : response.status === 409 || response.status === 412 ? 409 : 502);
    }
    if (response.status === 204) return {};
    return await response.json();
  }
  const calendarPath = (id: string) => `calendars/${encodeURIComponent(id)}/events`;
  async function session(actor: Actor, calendarId: unknown) {
    const current = await service.eventSession(actor, true);
    const calendar = current.connection.selected_calendars.find((item) => item.id === calendarId);
    if (!current.token || !calendar) throw new CalendarError('El calendario no está seleccionado para la agenda.', 403);
    return { ...current, calendar, token: current.token };
  }
  return {
    async selected(actor: Actor) {
      const { connection, token } = await service.eventSession(actor);
      const current = token ? new Map((await service.eventCalendars(token)).map(calendar => [calendar.id, calendar])) : new Map<string, Calendar>();
      const calendars = connection.selected_calendars.map(selected => {
        const calendar = current.get(selected.id);
        if (!calendar) throw new CalendarError('Un calendario seleccionado ya no está disponible. Revisa la selección.', 409);
        return { id: calendar.id, name: calendar.name, timeZone: calendar.timeZone, backgroundColor: calendar.backgroundColor };
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
    try {
      const actor = await service.requireUser(request);
      if (Number(request.headers.get('content-length') || 0) > 32000) throw new CalendarError('Solicitud demasiado grande.', 413);
      const text = await request.text();
      if (text.length > 32000) throw new CalendarError('Solicitud demasiado grande.', 413);
      let body;
      try { body = JSON.parse(text); } catch { throw new CalendarError('Solicitud inválida.'); }
      if (!body || typeof body !== 'object') throw new CalendarError('Solicitud inválida.');
      let result;
      switch (body.action) {
        case 'list': result = await events.list(actor, body.from, body.to); break;
        case 'calendars': result = await events.selected(actor); break;
        case 'save': result = await events.save(actor, body); break;
        case 'delete': result = await events.remove(actor, body.id, body.etag); break;
        default: throw new CalendarError('Acción inválida.');
      }
      return Response.json(result, { headers });
    } catch (error) {
      return Response.json({ error: error instanceof CalendarError ? error.message : 'No se pudo consultar Google Calendar. Intenta actualizar de nuevo.' }, { status: error instanceof CalendarError ? error.status : 500, headers });
    }
  };
}
