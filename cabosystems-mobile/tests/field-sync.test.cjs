const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports, globals = {}) {
  const module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, Date, Error, Number, Math, Set, require: name => { if (!(name in imports)) throw Error(name); return imports[name]; }, ...globals });
  return module.exports;
}
const settle = async () => { for (let index = 0; index < 8; index++) await new Promise(resolve => setImmediate(resolve)); };
function setup() {
  const entries = []; const timers = new Map(); const deleted = []; const sent = []; let appListener; let networkListener; let serial = 0;
  const app = { currentState: 'active', addEventListener: (_, listener) => { appListener = listener; return { remove() { appListener = undefined; } }; } };
  const state = { error: null, diskError: false, remoteCalls: 0 };
  const store = {
    firstPendingFieldRecord: async owner => entries.find(entry => entry.record.owner === owner && !entry.synced) || null,
    savePendingFieldRecord: async record => { if (state.diskError) throw Error('Disk full'); entries.push({ record, attempts: 0, nextAttempt: 0, blocked: false, synced: false }); },
    markFieldComplete: async record => { entries.find(entry => entry.record.id === record.id).synced = true; },
    markFieldFailed: async (record, attempts, nextAttempt, blocked) => { Object.assign(entries.find(entry => entry.record.id === record.id), { attempts, nextAttempt, blocked }); },
    latestLocalFieldRecord: async owner => { const entry = entries.findLast(item => item.record.owner === owner); return entry ? { ...entry.record, synced: entry.synced } : null; },
    retryPendingFieldRecords: async (owner, includeBlocked = true) => entries.filter(entry => entry.record.owner === owner && !entry.synced && (includeBlocked || !entry.blocked)).forEach(entry => Object.assign(entry, { nextAttempt: 0, blocked: false })),
    fieldOutboxSummary: async owner => ({ count: entries.filter(entry => entry.record.owner === owner && !entry.synced).length, blocked: entries.filter(entry => entry.record.owner === owner && entry.blocked).length, error: null }),
  };
  const service = load('lib/fieldSync.ts', {
    'react-native': { AppState: app, Platform: { OS: 'android' } },
    '@react-native-community/netinfo': { __esModule: true, default: { addEventListener: listener => { networkListener = listener; return () => { networkListener = undefined; }; } } },
    'expo-crypto': { randomUUID: () => `uuid-${++serial}` },
    'expo-file-system/legacy': { documentDirectory: 'file:///documents/', makeDirectoryAsync: async () => {}, copyAsync: async () => {}, deleteAsync: async uri => { deleted.push(uri); } },
    './api': { getLatestFieldRecord: async () => { state.remoteCalls++; return null; } },
    './fieldOutbox': load('lib/fieldOutbox.ts', {}), './fieldOutboxStore': store,
    './fieldOutboxRemote': { sendPendingFieldRecord: async (record, guard) => { guard(); if (state.error) throw state.error; sent.push(record.id); } },
    './evidencePhoto': { optimizeEvidencePhoto: async () => 'file:///optimized.jpg' },
  }, { setTimeout(callback, delay) { const id = ++serial; timers.set(id, { callback, delay }); return id; }, clearTimeout(id) { timers.delete(id); } });
  return { service, state, entries, timers, deleted, sent,
    connect(connected) { networkListener?.({ isConnected: connected, isInternetReachable: connected }); },
    background() { app.currentState = 'background'; appListener?.('background'); },
    foreground() { app.currentState = 'active'; appListener?.('active'); },
    input: { owner: 'alice', projectId: 'villa', photoUri: 'file:///camera.jpg', tipo: 'check_in', latitude: 22, longitude: -109, comments: null },
  };
}
test('offline save is durable before acknowledgment; reconnect sends it and idle polling stops', async () => {
  const app = setup(); const stop = app.service.startFieldSync('alice');
  await app.service.queueFieldRecord(app.input); await settle();
  assert.equal(app.entries.length, 1); assert.equal(app.sent.length, 0); assert.equal(app.timers.size, 0);
  const latest = await app.service.getLatestOfflineFieldRecord('alice');
  assert.equal(latest.tipo, 'check_in'); assert.equal(app.state.remoteCalls, 0);
  assert.equal(app.deleted.includes('file:///camera.jpg'), false);
  app.connect(true); await settle();
  assert.equal(app.sent.length, 1); assert.equal(app.entries[0].synced, true); assert.equal(app.timers.size, 0);
  assert.ok(app.deleted.includes(app.entries[0].record.photoUri)); stop();
});
test('storage failure never acknowledges success or removes the original camera photo', async () => {
  const app = setup(); app.state.diskError = true;
  await assert.rejects(() => app.service.queueFieldRecord(app.input), /Disk full/);
  assert.equal(app.entries.length, 0); assert.equal(app.sent.length, 0);
  assert.equal(app.deleted.includes('file:///camera.jpg'), false);
  assert.ok(app.deleted.some(uri => uri.startsWith('file:///documents/field-evidence/')));
});
test('background pauses retries; reconnect resumes immediately without overriding blocked errors', async () => {
  const app = setup(); const stop = app.service.startFieldSync('alice');
  app.state.error = Error('offline'); app.connect(true); await app.service.queueFieldRecord(app.input); await settle();
  assert.equal(app.entries[0].attempts, 1); assert.equal(app.timers.size, 1);
  app.background(); assert.equal(app.timers.size, 0);
  app.state.error = null; app.foreground(); await settle(); assert.equal(app.sent.length, 1); assert.equal(app.timers.size, 0);
  app.state.error = { code: '42501' }; await app.service.queueFieldRecord(app.input); await settle();
  assert.equal(app.entries[1].blocked, true); assert.equal(app.timers.size, 0);
  app.connect(false); app.connect(true); await settle(); assert.equal(app.entries[1].blocked, true);
  app.state.error = null; await app.service.retryFieldSync('alice'); await settle(); assert.equal(app.sent.length, 2); stop();
});
test('pending records from one account are never drained by another account', async () => {
  const app = setup(); const stopAlice = app.service.startFieldSync('alice');
  await app.service.queueFieldRecord(app.input); stopAlice();
  const stopBob = app.service.startFieldSync('bob'); app.connect(true); await settle();
  assert.equal(app.sent.length, 0); assert.equal((await app.service.fieldOutboxSummary('bob')).count, 0); stopBob();
  const stopAliceAgain = app.service.startFieldSync('alice'); app.connect(true); await settle(); assert.equal(app.sent.length, 1); stopAliceAgain();
});
