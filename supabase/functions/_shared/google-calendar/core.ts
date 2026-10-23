import { challenge, digest, randomToken, seal, unseal } from './crypto.ts';

export const SCOPES = ['https://www.googleapis.com/auth/calendar.calendarlist.readonly', 'https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar.events.freebusy'];
export interface Calendar { id: string; name: string; timeZone: string; accessRole: string; primary: boolean; backgroundColor?: string }
export interface Actor { id: string; rol: string; activo: boolean }
export interface Connection {
  revision: string; refresh_token_ciphertext: string | null; connected_by: string | null;
  account_label: string | null; selected_calendars: Calendar[]; connected_at: string | null;
}
export interface OAuthState { admin_id: string; base_revision: string; verifier_ciphertext: string }
export interface Store {
  actorForToken(token: string): Promise<Actor | null>;
  actorById(id: string): Promise<Actor | null>;
  connection(): Promise<Connection>;
  createState(hash: string, state: OAuthState, expires: string): Promise<void>;
  consumeState(hash: string, now: string): Promise<OAuthState | null>;
  commitConnection(revision: string, patch: Partial<Connection>): Promise<boolean>;
}
interface Options { store: Store; clientId: string; clientSecret: string; redirectUri: string; fetcher?: typeof fetch; now?: () => number }
export class CalendarError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export const isAdmin = (actor: Actor | null) => actor?.activo === true && actor.rol === 'admin';
export const isWritable = (calendar: Calendar) => ['owner', 'writer'].includes(calendar.accessRole);
export const isReadable = (calendar: Calendar) => ['owner', 'writer', 'reader', 'writerWithoutPrivateAccess', 'freeBusyReader'].includes(calendar.accessRole);
const canManageEvents = (actor: Actor | null) => actor?.activo === true && ['admin', 'supervisor_instalacion'].includes(actor.rol);
export function createCalendarService(options: Options) {
  const { store, clientId, clientSecret, redirectUri } = options;
  const fetcher = options.fetcher || fetch;
  const now = options.now || Date.now;
  const configured = Boolean(clientId && clientSecret && redirectUri);
  const ensureConfig = () => { if (!configured) throw new CalendarError('Falta configurar Google Calendar en el servidor.', 503); };
  async function googleJson(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    let response: Response;
    try { response = await fetcher(url, { ...init, signal: AbortSignal.timeout(15000), redirect: 'error' }); }
    catch { throw new CalendarError('No se pudo contactar con Google. Intenta de nuevo.', 502); }
    // Never include upstream bodies (which can contain tokens) in exceptions/logs.
    if (!response.ok) {
      if (response.status === 401 || response.status === 403 || response.status === 400) throw new CalendarError('Google no autorizó la operación. Revisa los permisos o vuelve a conectar la cuenta.', 409);
      throw new CalendarError('Google no está disponible. Intenta de nuevo.', 502);
    }
    return await response.json();
  }
  async function calendars(accessToken: string): Promise<Calendar[]> {
    const result: Calendar[] = [];
    let pageToken = '';
    const seen = new Set<string>();
    do {
      const query = new URLSearchParams({ maxResults: '250' });
      if (pageToken) query.set('pageToken', pageToken);
      const data = await googleJson(`https://www.googleapis.com/calendar/v3/users/me/calendarList?${query}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!Array.isArray(data.items)) throw new CalendarError('Google devolvió una lista de calendarios inválida.', 502);
      for (const entry of data.items) {
        if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || entry.deleted) continue;
        if (result.some((item) => item.id === entry.id)) continue;
        result.push({ id: entry.id, name: String(entry.summaryOverride || entry.summary || entry.id), timeZone: String(entry.timeZone || ''), accessRole: String(entry.accessRole || ''), primary: entry.primary === true, ...(typeof entry.backgroundColor === 'string' && /^#[a-f0-9]{6}$/i.test(entry.backgroundColor) ? { backgroundColor: entry.backgroundColor } : {}) });
      }
      pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
      if (pageToken && (seen.has(pageToken) || seen.size >= 40)) throw new CalendarError('La lista de calendarios es demasiado grande o inválida.', 502);
      if (pageToken) seen.add(pageToken);
    } while (pageToken);
    return result;
  }
  async function accessToken(connection: Connection): Promise<string> {
    ensureConfig();
    if (!connection.refresh_token_ciphertext) throw new CalendarError('Conecta primero una cuenta de Google.', 409);
    const refresh = await unseal(connection.refresh_token_ciphertext, clientSecret, clientId, 'refresh-token');
    const data = await googleJson('https://oauth2.googleapis.com/token', {
      method: 'POST', body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refresh, grant_type: 'refresh_token' }),
    });
    if (typeof data.access_token !== 'string' || data.token_type !== 'Bearer') throw new CalendarError('No se pudo renovar la autorización de Google.', 502);
    return data.access_token;
  }
  return {
    eventCalendars: calendars,
    async requireUser(request: Request): Promise<Actor> {
      const match = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i);
      if (!match) throw new CalendarError('Inicia sesión para continuar.', 401);
      const actor = await store.actorForToken(match[1]);
      if (!actor?.activo) throw new CalendarError('Tu perfil no tiene acceso a la agenda.', 403);
      return actor;
    },
    async eventSession(actor: Actor, manage = false) {
      const current = await store.actorById(actor.id);
      if (!current?.activo || manage && !canManageEvents(current)) throw new CalendarError('No tienes permiso para esta operación.', 403);
      const connection = await store.connection();
      if (!connection.refresh_token_ciphertext || !connection.selected_calendars.length) return { connection, token: null };
      return { connection, token: await accessToken(connection) };
    },
    async verifyEventSession(actor: Actor, revision: string, manage = false) {
      const current = await store.actorById(actor.id);
      if (!current?.activo || manage && !canManageEvents(current)) throw new CalendarError('Permiso de agenda revocado.', 403);
      if ((await store.connection()).revision !== revision) throw new CalendarError('Cambió la selección de calendarios. Actualiza la agenda.', 409);
    },
    async requireAdmin(request: Request): Promise<Actor> {
      const match = request.headers.get('Authorization')?.match(/^Bearer (.+)$/i);
      if (!match) throw new CalendarError('Inicia sesión para continuar.', 401);
      const actor = await store.actorForToken(match[1]);
      if (!isAdmin(actor)) throw new CalendarError('Solo un administrador activo puede configurar Google Calendar.', 403);
      return actor!;
    },
    async status() {
      const connection = await store.connection();
      return { configured, connected: Boolean(connection.refresh_token_ciphertext), revision: connection.revision, account: connection.account_label, selectedCalendars: connection.selected_calendars, connectedAt: connection.connected_at, syncEnabled: true };
    },
    async start(actor: Actor, replace: boolean) {
      ensureConfig();
      if (!isAdmin(actor)) throw new CalendarError('Permiso denegado.', 403);
      const connection = await store.connection();
      if (connection.refresh_token_ciphertext && !replace) throw new CalendarError('Confirma el reemplazo de la cuenta conectada.', 409);
      const state = randomToken(); const verifier = randomToken();
      await store.createState(await digest(state), { admin_id: actor.id, base_revision: connection.revision, verifier_ciphertext: await seal(verifier, clientSecret, clientId, 'pkce-verifier') }, new Date(now() + 10 * 60 * 1000).toISOString());
      const query = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '), access_type: 'offline', prompt: 'consent select_account', state, code_challenge: await challenge(verifier), code_challenge_method: 'S256' });
      return { url: `https://accounts.google.com/o/oauth2/v2/auth?${query}` };
    },
    async callback(url: URL) {
      ensureConfig();
      const stateValue = url.searchParams.get('state') || '';
      if (!/^[A-Za-z0-9_-]{43}$/.test(stateValue)) throw new CalendarError('La solicitud de conexión no es válida o ya venció.');
      // DELETE RETURNING is atomic: a callback can only be consumed once.
      const state = await store.consumeState(await digest(stateValue), new Date(now()).toISOString());
      if (!state) throw new CalendarError('La solicitud de conexión ya se usó o venció. Vuelve a conectar desde la agenda.');
      if (!isAdmin(await store.actorById(state.admin_id))) throw new CalendarError('El administrador ya no tiene permiso para conectar la cuenta.', 403);
      if (url.searchParams.has('error')) throw new CalendarError('No se autorizó la conexión con Google. Puedes volver a intentarlo desde la agenda.');
      const issuer = url.searchParams.get('iss');
      if (issuer && issuer !== 'https://accounts.google.com') throw new CalendarError('El proveedor de autorización no es válido.');
      const code = url.searchParams.get('code') || '';
      if (!code || code.length > 4096) throw new CalendarError('Google no devolvió un código de autorización válido.');
      const verifier = await unseal(state.verifier_ciphertext, clientSecret, clientId, 'pkce-verifier');
      const data = await googleJson('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code', code, code_verifier: verifier }) });
      const granted = typeof data.scope === 'string' ? data.scope.split(/\s+/) : [];
      if (!SCOPES.every((scope) => granted.includes(scope))) throw new CalendarError('Faltan permisos de Calendar. Vuelve a conectar y autoriza los permisos solicitados.');
      if (typeof data.refresh_token !== 'string' || !data.refresh_token || typeof data.access_token !== 'string' || data.token_type !== 'Bearer') throw new CalendarError('Google no concedió acceso renovable. Vuelve a conectar y autoriza el acceso.');
      const list = await calendars(data.access_token);
      const primary = list.find((calendar) => calendar.primary);
      // Recheck canonical authority immediately before the privileged write.
      if (!isAdmin(await store.actorById(state.admin_id))) throw new CalendarError('Permiso de administrador revocado.', 403);
      const committed = await store.commitConnection(state.base_revision, { refresh_token_ciphertext: await seal(data.refresh_token, clientSecret, clientId, 'refresh-token'), connected_by: state.admin_id, account_label: primary?.id || 'Cuenta Google autorizada', connected_at: new Date(now()).toISOString(), selected_calendars: [] });
      if (!committed) throw new CalendarError('La conexión cambió mientras autorizabas. Vuelve a la agenda y revisa la cuenta actual.', 409);
      return { connected: true };
    },
    async listCalendars() {
      const connection = await store.connection();
      return { revision: connection.revision, calendars: await calendars(await accessToken(connection)) };
    },
    async selectCalendars(revision: unknown, ids: unknown, actorId: string) {
      if (typeof revision !== 'string' || !Array.isArray(ids) || ids.length > 100 || ids.some((id) => typeof id !== 'string' || !id || id.length > 1024) || new Set(ids).size !== ids.length) throw new CalendarError('La selección de calendarios no es válida.');
      const connection = await store.connection();
      if (connection.revision !== revision) throw new CalendarError('La conexión cambió. Actualiza antes de guardar.', 409);
      const list = await calendars(await accessToken(connection));
      const selected = ids.map((id) => list.find((calendar) => calendar.id === id));
      if (selected.some((calendar) => !calendar || !isReadable(calendar))) throw new CalendarError('Selecciona únicamente calendarios con permiso para consultar eventos.');
      if (!isAdmin(await store.actorById(actorId))) throw new CalendarError('Permiso de administrador revocado.', 403);
      if (!await store.commitConnection(revision, { selected_calendars: selected as Calendar[] })) throw new CalendarError('La conexión cambió. Actualiza antes de guardar.', 409);
      return { saved: true, syncEnabled: true };
    },
  };
}
