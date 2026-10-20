import { CalendarError, createCalendarService } from './core.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Cache-Control': 'no-store' };
function failure(error: unknown) {
  return error instanceof CalendarError ? { message: error.message, status: error.status } : { message: 'No se pudo completar la conexión. Revisa la configuración del servidor.', status: 500 };
}
export function apiHandler(service: ReturnType<typeof createCalendarService>) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return Response.json({ error: 'Método no permitido.' }, { status: 405, headers: { ...cors, Allow: 'POST, OPTIONS' } });
    try {
      const actor = await service.requireAdmin(request);
      if (Number(request.headers.get('content-length') || '0') > 16000) throw new CalendarError('Solicitud demasiado grande.', 413);
      const text = await request.text();
      if (text.length > 16000) throw new CalendarError('Solicitud demasiado grande.', 413);
      let body;
      try { body = JSON.parse(text); } catch { throw new CalendarError('Solicitud inválida.'); }
      if (!body || typeof body !== 'object') throw new CalendarError('Solicitud inválida.');
      let result;
      switch (body.action) {
        case 'status': result = await service.status(); break;
        case 'connect': result = await service.start(actor, body.replace === true); break;
        case 'calendars': result = await service.listCalendars(); break;
        case 'select': result = await service.selectCalendars(body.revision, body.calendarIds, actor.id); break;
        default: throw new CalendarError('Acción no válida.');
      }
      return Response.json(result, { headers: cors });
    } catch (error) {
      const { message, status } = failure(error);
      return Response.json({ error: message }, { status, headers: cors });
    }
  };
}
// Plain text is intentional: Edge Functions can rewrite text/html to text/plain.
// No redirect target, code, token, account name, or provider error is reflected.
export function callbackHandler(service: ReturnType<typeof createCalendarService>) {
  return async (request: Request): Promise<Response> => {
    const headers = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" };
    if (request.method !== 'GET') return new Response('Método no permitido.', { status: 405, headers });
    try {
      await service.callback(new URL(request.url));
      return new Response('Cuenta Google conectada. Cierra esta pestaña y vuelve a Agenda → Google Calendar → Actualizar para seleccionar los calendarios. Todavía no se han importado ni cambiado eventos.', { headers });
    } catch (error) {
      const { message, status } = failure(error);
      return new Response(message, { status, headers });
    }
  };
}
