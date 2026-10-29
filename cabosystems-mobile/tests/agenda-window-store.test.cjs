const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./helpers/agenda-loader.cjs');
const snapshot = owner => ({ version: 1, owner, anchor: '2026-10-15', view: 'month', calendarsLoaded: 100, calendars: [{ id: 'office', name: 'Office' }], periods: [{ from: '2026-10-01', to: '2026-10-31', loaded: 100, items: [{ id: 'fixture', titulo: 'Cached event', fecha: '2026-10-15' }] }] });

test('all cached periods and the selected index persist across restarts, isolated by account', async () => {
  const memory = new Map();
  const globals = { localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) } };
  const make = () => createLoader({ 'react-native': { Platform: { OS: 'web' } }, 'expo-file-system/legacy': {} }, globals)('agendaWindowStore');
  await make().writeAgendaWindow('user-a', snapshot('user-a'));
  const restarted = make();
  const saved = await restarted.readAgendaWindow('user-a');
  assert.equal(saved.periods[0].items[0].titulo, 'Cached event'); assert.equal(saved.anchor, '2026-10-15');
  assert.equal(await restarted.readAgendaWindow('user-b'), null);
  memory.set('agenda-window:user-b', JSON.stringify(snapshot('user-a')));
  assert.equal(await restarted.readAgendaWindow('user-b'), null);
  await restarted.writeAgendaWindow('user-b', snapshot('user-a'));
  assert.equal(await restarted.readAgendaWindow('user-b'), null);
});

test('native snapshots use persistent app documents rather than only the disposable cache directory', async () => {
  const files = new Map();
  const store = createLoader({ 'react-native': { Platform: { OS: 'android' } }, 'expo-file-system/legacy': { documentDirectory: '/documents/', cacheDirectory: '/cache/', writeAsStringAsync: async (path, value) => files.set(path, value), readAsStringAsync: async path => files.get(path) || null } })('agendaWindowStore');
  await store.writeAgendaWindow('user-a', snapshot('user-a'));
  assert.ok(files.has('/documents/agenda-window-user-a.json'));
  assert.equal((await store.readAgendaWindow('user-a')).periods.length, 1);
  assert.equal(await store.readAgendaWindow('user-b'), null);
});

test('saved and restored calendar data excludes attachment and media fields', async () => {
  const memory = new Map();
  const store = createLoader({ 'react-native': { Platform: { OS: 'web' } }, 'expo-file-system/legacy': {} }, {
    localStorage: { getItem: key => memory.get(key), setItem: (key, value) => memory.set(key, value) },
  })('agendaWindowStore');
  const source = snapshot('user-a');
  source.periods[0].items[0].descripcion = 'Descripción conservada';
  source.periods[0].items[0].attachments = [{ fileUrl: 'https://attachment.invalid/private.pdf', data: 'FILE_BYTES' }];
  source.periods[0].items[0].google = { calendarId: 'office', etag: 'v1', attachments: ['NESTED_FILE'] };
  source.calendars[0].image = 'CALENDAR_IMAGE';
  await store.writeAgendaWindow('user-a', source);
  const raw = memory.get('agenda-window:user-a');
  for (const forbidden of ['attachments', 'FILE_BYTES', 'NESTED_FILE', 'CALENDAR_IMAGE', 'private.pdf']) assert.equal(raw.includes(forbidden), false);
  assert.equal((await store.readAgendaWindow('user-a')).periods[0].items[0].descripcion, 'Descripción conservada');
  // Old snapshots must not reintroduce files into the in-memory calendar.
  memory.set('agenda-window:user-a', JSON.stringify(source));
  const restored = await store.readAgendaWindow('user-a');
  assert.equal(restored.periods[0].items[0].attachments, undefined);
  assert.equal(restored.periods[0].items[0].google.attachments, undefined);
  assert.equal(source.periods[0].items[0].attachments.length, 1, 'Do not mutate server data');
});

test('corrupt or incompatible snapshots are ignored and malformed event records never reach rendering', async () => {
  let raw = '{broken';
  const store = createLoader({ 'react-native': { Platform: { OS: 'web' } }, 'expo-file-system/legacy': {} }, { localStorage: { getItem: () => raw } })('agendaWindowStore');
  assert.equal(await store.readAgendaWindow('user-a'), null);
  raw = JSON.stringify({ ...snapshot('user-a'), version: 0 }); assert.equal(await store.readAgendaWindow('user-a'), null);
  raw = JSON.stringify({ ...snapshot('user-a'), periods: Array.from({ length: 20 }, () => snapshot('user-a').periods[0]) }); assert.equal(await store.readAgendaWindow('user-a'), null);
  raw = JSON.stringify({ ...snapshot('user-a'), periods: [{ ...snapshot('user-a').periods[0], items: [{}] }] });
  assert.equal((await store.readAgendaWindow('user-a')).periods.length, 0);
});

test('concurrent saves are serialized and restoration waits for the latest account snapshot', async () => {
  const requests = []; let raw = null;
  const store = createLoader({ 'react-native': { Platform: { OS: 'android' } }, 'expo-file-system/legacy': {
    documentDirectory: '/documents/', readAsStringAsync: async () => raw,
    writeAsStringAsync: async (_path, value) => new Promise(resolve => requests.push(() => { raw = value; resolve(); })),
  } })('agendaWindowStore');
  const first = store.writeAgendaWindow('user-a', snapshot('user-a'));
  const second = store.writeAgendaWindow('user-a', { ...snapshot('user-a'), anchor: '2026-11-15' });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(requests.length, 1);
  requests[0](); await first;
  await new Promise(resolve => setImmediate(resolve)); assert.equal(requests.length, 2);
  let restored = false;
  const reading = store.readAgendaWindow('user-a').then(value => { restored = true; return value; });
  await Promise.resolve(); assert.equal(restored, false);
  requests[1](); await second;
  assert.equal((await reading).anchor, '2026-11-15');
});
