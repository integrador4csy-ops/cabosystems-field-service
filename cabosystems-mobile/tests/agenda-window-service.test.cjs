const test = require('node:test');
const assert = require('node:assert/strict');
const createLoader = require('./helpers/agenda-loader.cjs');
const tick = () => new Promise(resolve => setImmediate(resolve));

test('deferred sign-in preserves main priority until background preparation starts', async () => {
  const timers = new Map(); let next = 0, calls = 0;
  const load = createLoader({
    'react-native': { Platform: { OS: 'web' }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'expo-file-system/legacy': {},
    './companyAgendaApi': { getCompanyEvents: async () => { calls++; return []; }, getGoogleCalendars: async () => [] },
  }, { localStorage: { getItem: () => null, setItem() {} }, setTimeout: (callback, delay) => { timers.set(++next, { callback, delay }); return next; }, clearTimeout: id => timers.delete(id) });
  const service = load('agendaWindowService');
  const stop = service.startAgendaWindow('main-first', false);
  try {
    await tick(); assert.equal(calls, 0);
    const manager = service.getAgendaWindow('main-first'); assert.equal(manager.ready, false);
    manager.setActive(true); await manager.initialize();
    for (let i = 0; i < 10; i++) await tick();
    const count = load('agendaPeriodWindow').agendaYearWindow(manager.anchor, manager.view).length;
    assert.equal(calls, count); assert.equal(manager.cache.records().length, count);
  } finally { stop(); for (const timer of [...timers.values()]) if (timer.delay === 0) timer.callback(); }
});

test('sign-in prewarms the selected year before the tab mounts and Strict Mode does not create a second cache', async () => {
  const timers = new Map(); let timerId = 0, networkCalls = 0; const events = new Set();
  const app = { currentState: 'active', addEventListener(_name, callback) { events.add(callback); return { remove: () => events.delete(callback) }; } };
  const load = createLoader({
    'react-native': { Platform: { OS: 'web' }, AppState: app }, 'expo-file-system/legacy': {},
    './companyAgendaApi': { getCompanyEvents: async () => { networkCalls++; return []; }, getGoogleCalendars: async () => [] },
  }, { localStorage: { getItem: () => null, setItem() {} }, setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id) });
  const service = load('agendaWindowService');
  const stop = service.startAgendaWindow('user-a');
  const manager = service.getAgendaWindow('user-a');
  stop(); const stopAgain = service.startAgendaWindow('user-a');
  try {
    for (let index = 0; index < 10; index++) await tick();
    assert.equal(service.getAgendaWindow('user-a'), manager);
    const count = load('agendaPeriodWindow').agendaYearWindow(manager.anchor, manager.view).length;
    assert.equal(networkCalls, count, 'No Schedule screen is needed to prewarm the year');
    assert.equal(manager.cache.records().length, count);
    assert.equal(events.size, 1);
    app.currentState = 'background'; for (const callback of events) callback('background');
    await manager.flush();
    assert.equal([...timers.values()].some(timer => timer.delay === 60_000), false, 'No network polling while suspended');
  } finally {
    stopAgain();
    for (const timer of [...timers.values()]) if (timer.delay === 0) timer.callback();
  }
});

test('logout discards late responses before another account warms its own window', async () => {
  let currentAccount = 'user-a', timerId = 0;
  const delayed = [], timers = new Map(), memory = new Map();
  const load = createLoader({
    'react-native': { Platform: { OS: 'web' }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) } },
    'expo-file-system/legacy': {},
    './companyAgendaApi': {
      getGoogleCalendars: async () => [],
      getCompanyEvents: async from => { const account = currentAccount; const items = [{ id: account, titulo: account, fecha: from }]; return account === 'user-a' ? new Promise(resolve => delayed.push(() => resolve(items))) : items; },
    },
  }, { localStorage: { getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value) }, setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; }, clearTimeout: id => timers.delete(id) });
  const service = load('agendaWindowService');
  const stopA = service.startAgendaWindow('user-a'); const managerA = service.getAgendaWindow('user-a');
  await tick(); assert.equal(delayed.length, 2);
  stopA(); currentAccount = 'user-b';
  const stopB = service.startAgendaWindow('user-b'); const managerB = service.getAgendaWindow('user-b');
  try {
    for (const timer of [...timers.values()]) if (timer.delay === 0) timer.callback();
    for (const finish of delayed) finish();
    for (let index = 0; index < 10; index++) await tick();
    assert.equal(managerA.cache.records().length, 0);
    assert.equal(managerB.cache.records().length, load('agendaPeriodWindow').agendaYearWindow(managerB.anchor, managerB.view).length);
    assert.equal(managerB.cache.records().every(period => period.items.every(item => item.id === 'user-b')), true);
    await managerB.flush();
    const saved = JSON.parse(memory.get('agenda-window:user-b'));
    assert.equal(saved.owner, 'user-b'); assert.equal(saved.periods.every(period => period.items.every(item => item.id === 'user-b')), true);
  } finally { stopB(); for (const timer of [...timers.values()]) if (timer.delay === 0) timer.callback(); }
});
