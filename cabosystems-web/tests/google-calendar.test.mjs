import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const asModule = (text) => `data:text/javascript;base64,${Buffer.from(text).toString('base64')}`;
const compile = (file) => ts.transpileModule(readFileSync(new URL(`../../supabase/functions/_shared/google-calendar/${file}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const cryptoUrl = asModule(compile('crypto'));
const coreUrl = asModule(compile('core').replace("'./crypto.ts'", JSON.stringify(cryptoUrl)));
const { SCOPES, createCalendarService } = await import(coreUrl);
const { seal, unseal, digest } = await import(cryptoUrl);
const { apiHandler, callbackHandler } = await import(asModule(compile('handlers').replace("'./core.ts'", JSON.stringify(coreUrl))));
const modelUrl = asModule(compile('events-model'));
const { eventBody, googleOccurrences, normalizeGoogleEvent, zonedInstant, validEventInput, eventIdentity } = await import(modelUrl);
const { createEventService, eventsHandler } = await import(asModule(compile('events').replace("'./core.ts'", JSON.stringify(coreUrl)).replace("'./crypto.ts'", JSON.stringify(cryptoUrl)).replace("'./events-model.ts'", JSON.stringify(modelUrl))));
const admin = { id: 'admin', activo: true, rol: 'admin' };
const primary = { id: 'private@example.test', summary: 'Private', primary: true, timeZone: 'America/Mazatlan', accessRole: 'owner' };
const office = { id: 'office', summary: 'Oficina', timeZone: 'America/Mazatlan', accessRole: 'writer' };
const reader = { id: 'readonly', summary: 'Consulta', timeZone: 'UTC', accessRole: 'reader' };

function fixture({ pages = [[primary, office, reader]], tokenPatch = {}, configured = true } = {}) {
  let instant = Date.parse('2026-10-20T18:00:00Z');
  let actor = { ...admin };
  let connection = { revision: 'first', refresh_token_ciphertext: null, account_label: null, selected_calendars: [], connected_at: null, connected_by: null };
  const states = new Map(); const calls = [];
  const store = {
    actorForToken: async (token) => token === 'valid' ? actor : null,
    actorById: async () => actor,
    connection: async () => structuredClone(connection),
    createState: async (hash, row, expires) => { states.set(hash, { ...row, expires }); },
    consumeState: async (hash, now) => {
      const state = states.get(hash);
      if (!state || state.expires <= now) return null;
      states.delete(hash); return state;
    },
    commitConnection: async (revision, patch) => {
      if (revision !== connection.revision) return false;
      connection = { ...connection, ...patch, revision: crypto.randomUUID() }; return true;
    },
  };
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://oauth2.googleapis.com/token') return Response.json({ access_token: 'access-secret', refresh_token: 'refresh-secret', token_type: 'Bearer', scope: SCOPES.join(' '), ...tokenPatch });
    const page = new URL(url).searchParams.get('pageToken');
    const index = page ? Number(page) : 0;
    return Response.json({ items: pages[index], ...(index < pages.length - 1 ? { nextPageToken: String(index + 1) } : {}) });
  };
  const service = createCalendarService({ store, clientId: configured ? 'client-id' : '', clientSecret: configured ? 'test-secret-not-real-credential' : '', redirectUri: 'https://project.supabase.co/functions/v1/google-calendar-callback', now: () => instant, fetcher });
  async function authorization() {
    const { url } = await service.start(admin, false);
    const authorization = new URL(url);
    const callback = new URL('https://project.supabase.co/functions/v1/google-calendar-callback');
    callback.searchParams.set('state', authorization.searchParams.get('state'));
    callback.searchParams.set('code', 'authorization-secret');
    return { authorization, callback };
  }
  return { service, store, calls, states, authorization, connection: () => connection, actor: (next) => { actor = next; }, advance: (ms) => { instant += ms; } };
}

test('server authority uses active canonical admins, not supervisor or user metadata', async () => {
  const f = fixture();
  await assert.rejects(f.service.requireAdmin(new Request('https://test')), (error) => error.status === 401);
  const request = new Request('https://test', { headers: { Authorization: 'Bearer valid' } });
  for (const actor of [{ ...admin, activo: false }, { ...admin, rol: 'supervisor_instalacion' }, { ...admin, rol: 'aux_instalacion' }, null]) {
    f.actor(actor); await assert.rejects(f.service.requireAdmin(request), (error) => error.status === 403);
  }
  f.actor(admin); assert.equal((await f.service.requireAdmin(request)).id, admin.id);
});

test('OAuth uses PKCE, offline consent, hashed expiring state and single-use callback', async () => {
  const f = fixture(); const { authorization, callback } = await f.authorization();
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(authorization.searchParams.get('access_type'), 'offline');
  assert.equal(authorization.searchParams.get('prompt'), 'consent select_account');
  const state = authorization.searchParams.get('state');
  assert.ok(f.states.has(await digest(state))); assert.equal(f.states.has(state), false);
  assert.equal(JSON.stringify([...f.states.values()]).includes(authorization.searchParams.get('code_challenge')), false);
  await f.service.callback(callback);
  const saved = f.connection();
  assert.equal(saved.account_label, primary.id);
  assert.deepEqual(saved.selected_calendars, [], 'Never select personal calendars on connection');
  assert.ok(saved.refresh_token_ciphertext.startsWith('v1.'));
  assert.equal(saved.refresh_token_ciphertext.includes('refresh-secret'), false);
  await assert.rejects(f.service.callback(callback), /usó o venció/);
  const tokenCall = f.calls.find((entry) => entry.url.includes('/token'));
  assert.equal(tokenCall.options.body.get('redirect_uri'), authorization.searchParams.get('redirect_uri'));
  assert.ok(tokenCall.options.body.get('code_verifier'));
});

test('expired, denied and revoked OAuth attempts cannot change the connection', async () => {
  const expired = fixture(); const e = await expired.authorization(); expired.advance(600001);
  await assert.rejects(expired.service.callback(e.callback), /venció/);
  assert.equal(expired.calls.length, 0);
  const denied = fixture(); const d = await denied.authorization(); d.callback.searchParams.set('error', '<unsafe google message>');
  await assert.rejects(denied.service.callback(d.callback), /No se autorizó/);
  await assert.rejects(denied.service.callback(d.callback), /usó o venció/);
  const revoked = fixture(); const r = await revoked.authorization(); revoked.actor({ ...admin, activo: false });
  await assert.rejects(revoked.service.callback(r.callback), (error) => error.status === 403);
  assert.equal(revoked.connection().refresh_token_ciphertext, null);
});

test('missing scopes or renewable tokens never create a connected status', async () => {
  for (const tokenPatch of [{ scope: SCOPES[0] }, { refresh_token: undefined }, { token_type: 'unsafe' }]) {
    const f = fixture({ tokenPatch }); const { callback } = await f.authorization();
    await assert.rejects(f.service.callback(callback));
    assert.equal((await f.service.status()).connected, false);
  }
});

test('overlapping authorizations cannot silently replace the connection', async () => {
  const f = fixture(); const a = await f.authorization(); const b = await f.authorization();
  await f.service.callback(a.callback);
  const saved = f.connection().revision;
  await assert.rejects(f.service.callback(b.callback), (error) => error.status === 409);
  assert.equal(f.connection().revision, saved);
  await assert.rejects(f.service.start(admin, false), /Confirma/);
  assert.ok((await f.service.start(admin, true)).url);
});

test('calendar pages are read completely, readonly choices and stale writes rejected', async () => {
  const f = fixture({ pages: [[primary], [office, reader]] }); const { callback } = await f.authorization();
  await f.service.callback(callback);
  const list = await f.service.listCalendars();
  assert.equal(list.calendars.length, 3);
  await assert.rejects(f.service.selectCalendars(list.revision, ['readonly'], admin.id), /permiso/);
  await assert.rejects(f.service.selectCalendars(list.revision, ['missing'], admin.id), /permiso/);
  await assert.rejects(f.service.selectCalendars(list.revision, ['office', 'office'], admin.id), /válida/);
  await f.service.selectCalendars(list.revision, ['office'], admin.id);
  assert.deepEqual(f.connection().selected_calendars.map((calendar) => calendar.id), ['office']);
  await assert.rejects(f.service.selectCalendars(list.revision, [], admin.id), (error) => error.status === 409);
  const status = await f.service.status();
  assert.equal(status.syncEnabled, true);
  assert.equal(JSON.stringify(status).includes('ciphertext'), false);
});

test('revoking an admin before saving calendar selection prevents the write', async () => {
  const f = fixture(); const { callback } = await f.authorization(); await f.service.callback(callback);
  const revision = f.connection().revision;
  f.actor({ ...admin, activo: false });
  await assert.rejects(f.service.selectCalendars(revision, ['office'], admin.id), (error) => error.status === 403);
  assert.deepEqual(f.connection().selected_calendars, []);
});

test('ciphertexts resist tampering, wrong purpose, wrong account client and secret rotation', async () => {
  const cipher = await seal('sensitive-token', 'test-secret', 'client', 'refresh-token');
  assert.equal(await unseal(cipher, 'test-secret', 'client', 'refresh-token'), 'sensitive-token');
  for (const args of [[cipher, 'wrong', 'client', 'refresh-token'], [cipher, 'test-secret', 'other-client', 'refresh-token'], [cipher, 'test-secret', 'client', 'pkce-verifier'], [cipher.slice(0, -8) + 'AAAAAAAA', 'test-secret', 'client', 'refresh-token']]) {
    await assert.rejects(unseal(...args));
  }
});

test('HTTP API authenticates every action, sanitizes errors and callback never echoes tokens', async () => {
  const f = fixture(); const api = apiHandler(f.service);
  const response = await api(new Request('https://test', { method: 'POST', body: '{"action":"status"}' }));
  assert.equal(response.status, 401);
  assert.equal((await api(new Request('https://test', { method: 'OPTIONS' }))).status, 204);
  const request = (body) => new Request('https://test', { method: 'POST', headers: { Authorization: 'Bearer valid' }, body });
  assert.equal((await api(request('null'))).status, 400);
  assert.equal((await api(request('{"action":"unknown"}'))).status, 400);
  f.store.connection = async () => { throw new Error('client-secret-DO-NOT-LEAK'); };
  assert.equal((await (await api(request('{"action":"status"}'))).text()).includes('DO-NOT-LEAK'), false);
  const other = fixture(); const { callback } = await other.authorization();
  const result = await callbackHandler(other.service)(new Request(callback));
  assert.equal(result.status, 200); assert.equal(result.headers.get('Cache-Control'), 'no-store');
  const body = await result.text();
  assert.equal(body.includes('authorization-secret'), false); assert.equal(body.includes('refresh-secret'), false);
});

test('missing configuration is explicit and OAuth does not start', async () => {
  const f = fixture({ configured: false });
  assert.equal((await f.service.status()).configured, false);
  await assert.rejects(f.service.start(admin, false), (error) => error.status === 503);
});

test('database denies every public client role access to credentials and OAuth state', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create table public.profiles (id uuid primary key);
      insert into public.profiles values ('00000000-0000-0000-0000-000000000001');`);
    const sql = readFileSync(new URL('../../supabase/migrations/20261020185353_google_calendar_connection.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      for (const table of ['google_calendar_connection', 'google_calendar_oauth_states']) {
        await assert.rejects(db.query(`select * from public.${table}`), /permission denied/);
        await assert.rejects(db.exec(`delete from public.${table}`), /permission denied/);
        await assert.rejects(db.exec(`update public.${table} set created_at = now()`), /permission denied|does not exist/);
        const column = table === 'google_calendar_connection' ? 'id' : 'state_hash';
        await assert.rejects(db.exec(`insert into public.${table} (${column}) values (null)`), /permission denied/);
      }
      await db.exec('reset role');
    }
    const rows = await db.query(`select relname, relrowsecurity from pg_class where relname in ('google_calendar_connection', 'google_calendar_oauth_states')`);
    assert.ok(rows.rows.every((row) => row.relrowsecurity));
    await db.exec('set role service_role');
    const connection = await db.query('select revision from public.google_calendar_connection');
    assert.equal(connection.rows.length, 1);
    const revision = connection.rows[0].revision;
    const first = await db.query('update public.google_calendar_connection set revision=gen_random_uuid() where revision=$1 returning id', [revision]);
    const stale = await db.query('update public.google_calendar_connection set revision=gen_random_uuid() where revision=$1 returning id', [revision]);
    assert.equal(first.rows.length, 1); assert.equal(stale.rows.length, 0);
  } finally { await db.close(); }
});

const eventInput = (patch = {}) => ({ titulo: 'Prueba', descripcion: null, ubicacion: null, tipo: 'evento', fecha: '2026-10-20', hora: '10:00', repeticion: 'ninguna', intervalo: 1, dias_semana: [], repetir_hasta: null, ...patch });
const remoteEvent = (patch = {}) => ({ id: 'event1', etag: '"v1"', summary: 'Hola bro, 10am', status: 'confirmed', start: { dateTime: '2026-10-20T10:00:00-07:00' }, end: { dateTime: '2026-10-20T11:30:00-07:00' }, ...patch });
const officeCalendar = { id: 'office', name: 'Oficina', accessRole: 'writer', primary: false, timeZone: 'America/Mazatlan' };
test('Google event metadata carries the actual calendar background color', () => {
  assert.equal(normalizeGoogleEvent(remoteEvent(), { ...officeCalendar, backgroundColor: '#b39ddb' }).google.calendarColor, '#b39ddb');
});
async function connectedFixture() {
  const f = fixture(); const { callback } = await f.authorization(); await f.service.callback(callback);
  await f.service.selectCalendars(f.connection().revision, ['office'], admin.id);
  return f;
}

test('calendar visibility choices include selected empty calendars with their current color', async () => {
  const calendar = { ...office, backgroundColor: '#b39ddb' };
  const f = fixture({ pages: [[primary, calendar, reader]] });
  const { callback } = await f.authorization(); await f.service.callback(callback);
  await f.service.selectCalendars(f.connection().revision, ['office'], admin.id);
  calendar.backgroundColor = '#0b8043';
  const events = createEventService(f.service, async () => { throw new Error('Calendar choices must not depend on events'); });
  const result = await events.selected(admin);
  assert.deepEqual(result.calendars, [{ id: 'office', name: 'Oficina', timeZone: 'America/Mazatlan', backgroundColor: '#0b8043' }]);
  assert.equal(JSON.stringify(result).includes('refresh-secret'), false);
});

test('Google events preserve local time, all-day exclusive ends and multi-day overlap', () => {
  const event = remoteEvent();
  const row = normalizeGoogleEvent(event, officeCalendar);
  assert.equal(row.fecha, '2026-10-20'); assert.equal(row.hora, '10:00:00');
  assert.equal(row.google.endTime, '11:30:00'); assert.equal(row.google.calendarName, 'Oficina');
  const allDay = remoteEvent({ start: { date: '2026-10-18' }, end: { date: '2026-10-22' } });
  assert.deepEqual(googleOccurrences(allDay, officeCalendar, '2026-10-20', '2026-10-23').map((e) => e.occurrence_date), ['2026-10-20', '2026-10-21']);
  const overnight = remoteEvent({ start: { dateTime: '2026-10-20T23:00:00-07:00' }, end: { dateTime: '2026-10-21T00:00:00-07:00' } });
  assert.equal(googleOccurrences(overnight, officeCalendar, '2026-10-20', '2026-10-21').length, 1);
  assert.deepEqual(googleOccurrences(remoteEvent({ status: 'cancelled' }), officeCalendar, '2026-10-20', '2026-10-20'), []);
});

test('Google edits retain exact duration, seconds, attendees and reminders when times are unchanged', () => {
  const current = remoteEvent({ start: { dateTime: '2026-10-20T10:00:37-07:00' }, end: { dateTime: '2026-10-20T11:30:45-07:00' }, recurringEventId: 'series', extendedProperties: { shared: { external: 'preserved' }, private: { otherApp: 'preserved' } } });
  const body = eventBody(eventInput({ titulo: 'Texto editado', fecha_fin: '2026-10-20', hora_fin: '11:30' }), current);
  assert.equal(body.start, undefined); assert.equal(body.end, undefined);
  assert.equal(body.attendees, undefined); assert.equal(body.reminders, undefined); assert.equal(body.recurrence, undefined);
  assert.equal(body.extendedProperties.shared.external, 'preserved'); assert.equal(body.extendedProperties.private.otherApp, 'preserved');
  assert.throws(() => eventBody(eventInput({ tipo: 'recordatorio', repeticion: 'diaria' }), current), /ocurrencia/);
});

test('new Google reminders preserve weekday/month-end rules and have no automatic alarms', () => {
  const weekly = eventBody(eventInput({ tipo: 'recordatorio', repeticion: 'semanal', intervalo: 2, dias_semana: [1, 7], repetir_hasta: '2026-11-01' }));
  assert.match(weekly.recurrence[0], /FREQ=WEEKLY;INTERVAL=2;WKST=MO;BYDAY=MO,SU;UNTIL=20261102T065959Z/);
  assert.deepEqual(weekly.reminders, { useDefault: false });
  const monthly = eventBody(eventInput({ tipo: 'recordatorio', fecha: '2026-10-31', hora: null, repeticion: 'mensual' }));
  assert.match(monthly.recurrence[0], /BYMONTHDAY=1,2,3/); assert.match(monthly.recurrence[0], /30,31;BYSETPOS=-1$/);
  assert.equal(validEventInput(eventInput({ fecha: '2026-02-30' })), false);
  assert.equal(validEventInput(eventInput({ hora: false })), false);
  assert.equal(validEventInput(eventInput({ tipo: 'recordatorio', repeticion: 'semanal', dias_semana: [] })), false);
  assert.throws(() => eventBody(eventInput({ hora_fin: '09:00' })), /posteriores/);
  assert.equal(zonedInstant('2026-10-20', '10:00'), '2026-10-20T17:00:00.000Z');
  assert.throws(() => zonedInstant('2026-03-08', '02:30', 'America/New_York'), /no existe/);
  assert.throws(() => zonedInstant('2026-11-01', '01:30', 'America/New_York'), /ambigua/);
});

test('switching all-day and timed Google events clears the old date representation', () => {
  const allDay = remoteEvent({ start: { date: '2026-10-20' }, end: { date: '2026-10-21' } });
  const timed = eventBody(eventInput({ fecha_fin: '2026-10-20', hora_fin: '11:00' }), allDay);
  assert.equal(timed.start.date, null); assert.equal(timed.end.date, null); assert.ok(timed.start.dateTime);
  const dateOnly = eventBody(eventInput({ hora: null, fecha_fin: '2026-10-20', hora_fin: null }), remoteEvent());
  assert.equal(dateOnly.start.dateTime, null); assert.equal(dateOnly.end.dateTime, null); assert.equal(dateOnly.start.date, '2026-10-20');
});

test('selected Google calendars load every page and preserve distinct events across calendars', async () => {
  const f = await connectedFixture(); const calls = [];
  const events = createEventService(f.service, async (url) => {
    calls.push(url);
    assert.match(url, /calendars\/office\/events/);
    return Response.json(new URL(url).searchParams.has('pageToken') ? { items: [remoteEvent({ id: 'next' })] } : { items: [remoteEvent()], nextPageToken: 'page2' });
  });
  const result = await events.list(admin, '2026-10-19', '2026-10-25');
  assert.equal(result.events.length, 2); assert.equal(calls.length, 2);
  assert.equal(new URL(calls[0]).searchParams.get('singleEvents'), 'true');
  assert.equal(new URL(calls[0]).searchParams.get('timeMin'), '2026-10-19T07:00:00.000Z');
  assert.equal(new URL(calls[0]).searchParams.get('timeMax'), '2026-10-26T07:00:00.000Z');
  assert.equal(JSON.stringify(result).includes('access-secret'), false);
  await assert.rejects(events.list(admin, '2026-02-30', '2026-03-01'), /periodo/);
});

test('active viewers can read Google events but cannot save, delete or escape selected calendars', async () => {
  const f = await connectedFixture(); const events = createEventService(f.service, async () => Response.json({ items: [remoteEvent()] }));
  f.actor({ ...admin, rol: 'aux_instalacion' });
  assert.equal((await events.list(admin, '2026-10-20', '2026-10-20')).events.length, 1);
  await assert.rejects(events.save(admin, { input: eventInput(), calendarId: 'office' }), (error) => error.status === 403);
  await assert.rejects(events.remove(admin, eventIdentity('office', 'event1'), '"v1"'), (error) => error.status === 403);
  f.actor({ ...admin, rol: 'supervisor_instalacion' });
  await assert.rejects(events.save(admin, { input: eventInput(), calendarId: 'not-selected' }), (error) => error.status === 403);
  await assert.rejects(events.save(admin, { input: eventInput(), id: eventIdentity('office', '../acl'), etag: '"v1"' }), /válido/);
  f.actor({ ...admin, activo: false });
  await assert.rejects(events.list(admin, '2026-10-20', '2026-10-20'), (error) => error.status === 403);
});

test('Google updates use If-Match and refuse to overwrite a newer version', async () => {
  const f = await connectedFixture(); const calls = [];
  const events = createEventService(f.service, async (url, options) => {
    calls.push({ url, options });
    if (options.method === 'PATCH') return Response.json(remoteEvent({ etag: '"v2"', summary: 'Editado' }));
    return Response.json(remoteEvent());
  });
  await assert.rejects(events.save(admin, { id: eventIdentity('office', 'event1'), etag: '"old"', input: eventInput() }), /cambió/);
  assert.equal(calls.some((call) => call.options.method === 'PATCH'), false);
  const result = await events.save(admin, { id: eventIdentity('office', 'event1'), etag: '"v1"', input: eventInput({ fecha_fin: '2026-10-20', hora_fin: '11:30' }) });
  assert.equal(result.event.google.etag, '"v2"');
  const patch = calls.find((call) => call.options.method === 'PATCH');
  assert.equal(patch.options.headers['If-Match'], '"v1"');
  assert.equal(JSON.parse(patch.options.body).start, undefined);
  assert.match(patch.url, /sendUpdates=none/);
});

test('Google creates retry safely without duplicating events and delete confirms the version', async () => {
  const f = await connectedFixture(); let saved; let createCount = 0;
  const events = createEventService(f.service, async (_url, options) => {
    if (options.method === 'POST') {
      createCount++;
      if (saved) return Response.json({ error: 'conflict' }, { status: 409 });
      const body = JSON.parse(options.body);
      saved = remoteEvent({ ...body, etag: '"v1"' }); return Response.json(saved);
    }
    if (options.method === 'DELETE') { assert.equal(options.headers['If-Match'], '"v1"'); return new Response(null, { status: 204 }); }
    return Response.json(saved);
  });
  const body = { requestId: 'a'.repeat(32), calendarId: 'office', input: eventInput() };
  const first = await events.save(admin, body); const retry = await events.save(admin, body);
  assert.equal(first.event.id, retry.event.id); assert.equal(createCount, 2);
  await assert.rejects(events.save(admin, { ...body, input: eventInput({ titulo: 'Different' }) }), /ya creó/);
  assert.equal((await events.remove(admin, first.event.id, '"v1"')).deleted, true);
});

test('event HTTP handler requires a real session and does not hide a Google failure as an empty calendar', async () => {
  const f = await connectedFixture();
  const handler = eventsHandler(f.service, async () => Response.json({ secret: 'not-returned' }, { status: 403 }));
  const req = (auth) => new Request('https://test', { method: 'POST', headers: auth ? { Authorization: 'Bearer valid' } : {}, body: JSON.stringify({ action: 'list', from: '2026-10-20', to: '2026-10-20' }) });
  assert.equal((await handler(req(false))).status, 401);
  const denied = await handler(req(true));
  assert.equal(denied.status, 403);
  const body = await denied.json(); assert.ok(body.error); assert.equal(body.events, undefined); assert.equal(JSON.stringify(body).includes('not-returned'), false);
});
