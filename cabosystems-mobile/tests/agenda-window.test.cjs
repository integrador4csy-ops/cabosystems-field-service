const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./helpers/agenda-loader.cjs');
const load = createLoader();
const { AgendaWindowManager } = load('agendaWindowManager');
const { AgendaPeriodCache } = load('agendaPeriodCache');
const { agendaPeriodWindow } = load('agendaPeriodWindow');
const { moveAgendaPeriod } = load('agendaGestures');
const key = period => `${period.from}:${period.to}`;
const tick = () => new Promise(resolve => setImmediate(resolve));
const snapshot = (owner, periods = []) => ({ version: 1, owner, anchor: '2026-10-15', view: 'month', calendars: [], calendarsLoaded: Date.now(), periods });
const record = period => ({ ...period, loaded: Date.now(), items: [{ id: period.from, titulo: 'Fixture', fecha: period.from }] });

test('month, week and day windows include three periods on each side and retain six after one move', () => {
  for (const view of ['month', 'week', 'day']) {
    const current = agendaPeriodWindow('2026-10-15', view);
    const next = agendaPeriodWindow(moveAgendaPeriod('2026-10-15', view, 1), view);
    assert.equal(current.length, 7); assert.equal(next.length, 7);
    assert.equal(new Set(current.map(key)).size, 7);
    assert.equal(next.filter(period => current.some(existing => key(existing) === key(period))).length, 6);
  }
  assert.equal(agendaPeriodWindow('1900-01-01', 'day').length, 4);
});

test('seven periods preload with at most two requests; moving the center fetches only the new extreme', async () => {
  const requests = [], writes = []; let active = 0, maximum = 0;
  const manager = new AgendaWindowManager('user-a', {
    read: async () => snapshot('user-a'), write: async (_owner, value) => writes.push(value), fetchCalendars: async () => [],
    fetchEvents: (from, to) => new Promise(resolve => { active++; maximum = Math.max(maximum, active); requests.push({ from, to, finish() { active--; resolve([{ id: from, titulo: 'Fixture', fecha: from }]); } }); }),
  });
  let finished = 0;
  const drain = async () => {
    for (let round = 0; round < 30; round++) {
      while (finished < requests.length) requests[finished++].finish();
      await tick(); if (!active) return;
    }
    throw Error('Prefetch did not settle');
  };
  try {
    await manager.initialize(); await tick(); assert.equal(requests.length, 2);
    await drain(); assert.equal(requests.length, 7); assert.equal(maximum, 2);
    assert.equal(manager.cache.records().length, 7);
    assert.equal(writes.length, 0, 'Disk writes are coalesced instead of writing per response');
    manager.select('2026-11-15', 'month'); await drain();
    assert.equal(requests.length, 8, 'Six overlapping periods come from memory');
    const expected = agendaPeriodWindow('2026-11-15', 'month').map(key).sort();
    assert.deepEqual(Array.from(manager.cache.records().map(key)).sort(), Array.from(expected));
    assert.equal(manager.cache.read(...['2026-06-29', '2026-08-02']), null, 'The obsolete extreme is evicted');
    await manager.flush(); assert.equal(writes.length, 1); assert.equal(writes[0].periods.length, 7);
    assert.equal(writes[0].anchor, '2026-11-15');
  } finally { manager.dispose(); }
});

test('all seven saved periods restore before networking and remain visible if refresh fails', async () => {
  const saved = snapshot('user-a', agendaPeriodWindow('2026-10-15', 'month').map(period => ({ ...record(period), loaded: Date.now() - 120_000 })));
  let calls = 0;
  const manager = new AgendaWindowManager('user-a', { read: async () => saved, write: async () => {}, fetchCalendars: async () => [], fetchEvents: async () => { calls++; throw Error('offline'); } });
  try {
    manager.setActive(false); await manager.initialize();
    assert.equal(manager.ready, true); assert.equal(calls, 0);
    for (const period of saved.periods) assert.equal(manager.cache.read(period.from, period.to), period.items);
    manager.setActive(true); for (let index = 0; index < 8; index++) await tick();
    assert.equal(calls, 7);
    assert.equal(manager.cache.records().length, 7, 'Failed refresh never clears restored events');
  } finally { manager.dispose(); }
});

test('background pauses queued network work, persists partial results, and resumes the full window', async () => {
  const requests = [], writes = [];
  const manager = new AgendaWindowManager('user-a', { read: async () => snapshot('user-a'), write: async (_owner, value) => writes.push(value), fetchCalendars: async () => [], fetchEvents: (from, to) => new Promise(resolve => requests.push({ from, to, finish: () => resolve([]) })) });
  try {
    await manager.initialize(); await tick(); assert.equal(requests.length, 2);
    manager.setActive(false); requests[0].finish(); requests[1].finish(); await tick(); await manager.flush();
    assert.equal(requests.length, 2); assert.equal(writes.at(-1).periods.length, 2);
    manager.setActive(true);
    let finished = 2;
    for (let round = 0; round < 8; round++) { await tick(); while (finished < requests.length) requests[finished++].finish(); }
    await tick(); assert.equal(requests.length, 7); assert.equal(manager.cache.records().length, 7);
  } finally { manager.dispose(); }
});

test('switching to weeks reuses complete cached month data without fetching', async () => {
  let calls = 0;
  const cache = new AgendaPeriodCache(async () => { calls++; return [{ id: 'inside', titulo: 'Inside', fecha: '2026-10-21' }, { id: 'outside', titulo: 'Outside', fecha: '2026-10-04' }]; });
  await cache.load('2026-09-28', '2026-11-01');
  cache.setWindow([{ from: '2026-10-19', to: '2026-10-25' }]);
  const items = await cache.load('2026-10-19', '2026-10-25');
  assert.equal(items.length, 1); assert.equal(items[0].id, 'inside'); assert.equal(calls, 1);
});

test('annual preload saves every month, reuses distant months and restores offline after restart', async () => {
  let calls = 0, saved;
  const initial = { ...snapshot('year-user'), anchor: '2026-06-15' };
  const manager = new AgendaWindowManager('year-user', {
    preloadYear: true, read: async () => initial, write: async (_owner, data) => { saved = data; },
    fetchCalendars: async () => [], fetchEvents: async (from, to) => { calls++; return record({ from, to }).items; },
  });
  try {
    await manager.initialize(); for (let i = 0; i < 15; i++) await tick();
    assert.equal(calls, 12); assert.equal(manager.cache.records().length, 12);
    for (let month = 1; month <= 12; month++) {
      const period = agendaPeriodWindow(`2026-${String(month).padStart(2, '0')}-15`, 'month')[0];
      assert.notEqual(manager.cache.read(period.from, period.to), null, `Month ${month} is local`);
    }
    manager.select('2026-08-15', 'month'); for (let i = 0; i < 3; i++) await tick();
    assert.equal(calls, 12, 'Moving beyond three months must reuse the year');
    await manager.flush(); assert.equal(saved.periods.length, 12);
    const offline = new AgendaWindowManager('year-user', {
      preloadYear: true, read: async () => saved, write: async () => {}, fetchCalendars: async () => [],
      fetchEvents: async () => { throw Error('Offline'); },
    });
    try {
      offline.setActive(false); await offline.initialize();
      assert.equal(offline.cache.records().length, 12);
      offline.select('2026-02-15', 'month');
      const february = agendaPeriodWindow('2026-02-15', 'month')[0];
      assert.notEqual(offline.cache.read(february.from, february.to), null);
      offline.select('2026-02-15', 'week');
      assert.ok(offline.cache.records().length <= 19, 'Year plus nearby week pages stays bounded');
      assert.equal(offline.cache.records().filter(period => period.to.endsWith('-31')).length > 0, true);
    } finally { offline.dispose(); }
  } finally { manager.dispose(); }
});
