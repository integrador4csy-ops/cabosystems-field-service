const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, imports = {}, globals = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.resolve(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, Date, Map, Set, Intl, ...globals, require: name => { if (name in imports) return imports[name]; throw Error(`Unexpected import ${name}`); } });
  return module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const dates = load('lib/agenda.ts');
const recurrence = load('lib/companyAgendaRecurrence.ts', { './agenda': dates });
const model = load('lib/companyAgenda.ts', { './agenda': dates, './companyAgendaRecurrence': recurrence });
const webDates = load('../cabosystems-web/src/lib/taskDates.ts');
const webRecurrence = load('../cabosystems-web/src/lib/agendaRecurrence.ts', { './taskDates': webDates });
const webCalendar = load('../cabosystems-web/src/lib/agendaDates.ts', { './taskDates': webDates });
const event = patch => ({ id: 'series', titulo: 'Revisión de rack', descripcion: 'Confirmar operación', ubicacion: 'Oficina', tipo: 'recordatorio', fecha: '2026-10-19', hora: null, created_at: '', ...recurrence.NO_RECURRENCE, ...patch });

test('mobile and web render the same day, week and month, including weekends and leap years', () => {
  for (const day of ['2026-10-19', '2026-12-31', '2028-02-29', '2027-01-01']) for (const view of ['day', 'week', 'month']) assert.deepEqual(plain(model.companyDays(day, view)), plain(webCalendar.agendaDays(day, view)));
});
test('recurring reminders stay identical on mobile and web across years, short months and end dates', () => {
  for (const patch of [{}, { repeticion: 'diaria', intervalo: 3 }, { repeticion: 'semanal', dias_semana: [1, 3, 7] }, { repeticion: 'semanal', dias_semana: [1, 7], intervalo: 2, repetir_hasta: '2027-02-10' }, { repeticion: 'mensual', fecha: '2026-10-31' }, { repeticion: 'mensual', intervalo: 2, fecha: '2027-12-31' }]) {
    const events = [event(patch)];
    const actual = recurrence.expandCompanyEvents(events, '2026-10-01', '2028-03-31');
    assert.deepEqual(plain(actual), plain(webRecurrence.expandCompanyEvents(events, '2026-10-01', '2028-03-31')));
    assert.equal(events[0].occurrence_date, undefined);
    assert.equal(new Set(actual.map(e => `${e.id}-${e.occurrence_date}`)).size, actual.length);
  }
});
test('only active administrators and installation supervisors may manage the company calendar', () => {
  for (const rol of ['admin', 'supervisor_instalacion']) assert.equal(model.canManageCompanyAgenda({ id: 'person', activo: true, rol }), true);
  for (const profile of [null, { id: 'person', activo: false, rol: 'admin' }, { rol: 'admin', activo: true }, { id: 'person', activo: true, rol: 'aux_operaciones' }, { id: 'person', activo: true, rol: 'integrador' }]) assert.equal(model.canManageCompanyAgenda(profile), false);
});
test('filters search company content without project membership and group by occurrence, preserving the series date', () => {
  const entries = recurrence.expandCompanyEvents([event({ repeticion: 'semanal', dias_semana: [1, 7] }), event({ id: 'delivery', titulo: 'Entrega de casa', tipo: 'evento' })], '2026-10-19', '2026-10-25');
  const rows = model.companyRows(entries, 'revision oficina', 'recordatorio');
  assert.deepEqual(plain(rows.filter(r => r.kind === 'heading').map(r => r.date)), ['2026-10-19', '2026-10-25']);
  assert.ok(rows.filter(r => r.kind === 'event').every(r => r.event.fecha === '2026-10-19'));
  assert.equal(model.companyRows(entries, 'inexistente', '').length, 0);
});
test('validation rejects malformed times, empty weekly selections, invalid intervals and early end dates', () => {
  assert.equal(model.validCompanyEvent(event({ hora: '06:07' })), true);
  for (const patch of [{ titulo: ' ' }, { hora: '24:00' }, { hora: '6:07' }, { fecha: '2026-02-30' }, { repeticion: 'semanal', dias_semana: [] }, { repeticion: 'diaria', intervalo: 0 }, { repeticion: 'mensual', repetir_hasta: '2026-10-01' }]) assert.equal(model.validCompanyEvent(event(patch)), false, JSON.stringify(patch));
});
test('calendar API fetches all pages of older series and rejects failed writes', async () => {
  const records = Array.from({ length: 501 }, (_, i) => event({ id: String(i) })); const calls = [];
  const denied = new Error('Denied');
  const query = {
    select: () => query, lte: () => query, or: filter => { calls.push(filter); return query; }, order: () => query,
    range: async (from, to) => ({ data: records.slice(from, to + 1), error: null }),
    update: () => query, insert: () => query, delete: () => query, eq: () => query, single: async () => ({ data: null, error: denied }),
  };
  const api = load('lib/companyAgendaApi.ts', { './supabase': { supabase: { functions: { invoke: async () => ({ data: { events: [] }, error: null }) }, from: table => { assert.equal(table, 'agenda_eventos'); return query; } } }, './companyAgendaRecurrence': recurrence, './companyAgenda': model });
  assert.equal((await api.getCompanyEvents('2026-10-19', '2026-10-25')).length, 501);
  assert.ok(calls.some(filter => filter.includes('repeticion.neq.ninguna')));
  await assert.rejects(api.saveCompanyEvent('id', event({ hora: '10:00' })), error => error === denied);
  await assert.rejects(api.deleteCompanyEvent('id'), error => error === denied);
});
test('cached calendars never cross account or date-range boundaries', async () => {
  const memory = new Map();
  const cache = load('lib/companyAgendaCache.ts', { 'react-native': { Platform: { OS: 'web' } }, 'expo-file-system/legacy': {}, './agendaTextCache': load('lib/agendaTextCache.ts') }, { sessionStorage: { setItem: (key, value) => memory.set(key, value), getItem: key => memory.get(key) || null } });
  await cache.cacheCompanyAgenda('user-a', '2026-10-19', '2026-10-25', [event({})]);
  assert.equal((await cache.readCompanyAgendaCache('user-a', '2026-10-19', '2026-10-25')).length, 1);
  assert.equal(await cache.readCompanyAgendaCache('user-b', '2026-10-19', '2026-10-25'), null);
  assert.equal(await cache.readCompanyAgendaCache('user-a', '2026-11-01', '2026-11-30'), null);
  assert.equal(await cache.readCompanyAgendaCache('', '2026-10-19', '2026-10-25'), null);
});
test('Spanish and English mobile calendar dictionaries have every field and action', () => {
  const { COMPANY_AGENDA_COPY } = load('lib/companyAgendaCopy.ts');
  assert.deepEqual(Object.keys(COMPANY_AGENDA_COPY.es).sort(), Object.keys(COMPANY_AGENDA_COPY.en).sort());
  for (const copy of Object.values(COMPANY_AGENDA_COPY)) assert.ok(Object.values(copy).every(value => typeof value === 'string' && value.trim()));
});

test('web and mobile combine Google events, route Google writes and keep virtual fields out of local rows', async () => {
  for (const platform of ['mobile', 'web']) {
    const remote = event({ id: 'gcal:office:event', google: { calendarName: 'Oficina', etag: 'version' } });
    const local = event({ id: 'local' }); const calls = []; let localInput;
    const query = { select: () => query, lte: () => query, or: () => query, order: () => query, eq: () => query,
      range: async () => ({ data: [local], error: null }), update: (input) => { localInput = input; return query; }, insert: (input) => { localInput = input; return query; },
      single: async () => ({ data: local, error: null }), delete: () => query,
    };
    let failed = false;
    const supabase = { from: () => query, functions: { invoke: async (name, { body }) => {
      assert.equal(name, 'google-calendar-events'); calls.push(body);
      return failed ? { data: null, error: new Error('Google unavailable') } : { data: { events: [remote], event: remote, calendars: [{ id: 'office', name: 'Oficina' }], deleted: true }, error: null };
    } } };
    const api = platform === 'mobile'
      ? load('lib/companyAgendaApi.ts', { './supabase': { supabase }, './companyAgendaRecurrence': recurrence, './companyAgenda': model })
      : load('../cabosystems-web/src/lib/agendaApi.ts', { './supabase': { supabase }, './agendaRecurrence': webRecurrence }, { Response });
    const records = await api.getCompanyEvents('2026-10-19', '2026-10-25');
    assert.deepEqual(plain(records.map((e) => e.id).sort()), ['gcal:office:event', 'local']);
    assert.equal((await api.getGoogleCalendars())[0].id, 'office');
    const input = { ...event({}), calendar_id: 'office', google_etag: 'version', request_id: 'a'.repeat(32), fecha_fin: '2026-10-19', hora_fin: '' };
    await api.saveCompanyEvent(remote.id, input);
    assert.equal(calls.at(-1).action, 'save'); assert.equal(calls.at(-1).etag, 'version');
    await api.deleteCompanyEvent(remote.id, 'version'); assert.equal(calls.at(-1).action, 'delete');
    await api.saveCompanyEvent(undefined, { ...input, calendar_id: '' });
    for (const key of ['calendar_id', 'google_etag', 'request_id', 'fecha_fin']) assert.equal(key in localInput, false);
    assert.equal(localInput.hora_fin, null);
    failed = true; await assert.rejects(api.getCompanyEvents('2026-10-19', '2026-10-25'));
  }
});

test('mobile preserves the Google authorization error instead of reporting an empty or offline-only message', async () => {
  let readable = true;
  const supabase = { functions: { invoke: async () => ({ data: null, error: { context: { clone: () => ({ json: async () => {
    if (!readable) throw Error('Not JSON');
    return { error: 'Google no autorizó la operación. Vuelve a conectar la cuenta.' };
  } }) } } }) } };
  const api = load('lib/companyAgendaApi.ts', { './supabase': { supabase }, './companyAgendaRecurrence': recurrence, './companyAgenda': model });
  await assert.rejects(api.getGoogleCalendars(), /Vuelve a conectar la cuenta/);
  readable = false;
  await assert.rejects(api.getGoogleCalendars(), /No se pudo consultar Google Calendar/);
});
