const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');
const os = require('node:os');
function load(file, imports = {}) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => { if (name in imports) return imports[name]; throw Error(`Unexpected import ${name}`); }, console, Date, Map, Set, Error, Number, Math, JSON });
  return module.exports;
}
const { createFieldOutboxWorker, isPermanentFieldError } = load('lib/fieldOutbox.ts');
const record = (id, owner = 'alice') => ({ id, owner, projectId: 'villa', taskId: null, photoUri: `file:///photo-${id}.jpg`, capturedAt: '2026-10-26T10:00:00.000Z', tipo: 'check_in', latitude: 22, longitude: -109, comments: null });
test('one FIFO worker survives an uncertain send without dropping or duplicating queued operations', async () => {
  const queue = [record('arrival'), record('departure')]; const sent = []; let fail = true; let release;
  const worker = createFieldOutboxWorker({
    active: owner => owner === 'alice', now: () => 1000,
    first: async () => queue.length ? { record: queue[0], attempts: 0, nextAttempt: 0, blocked: false } : null,
    send: async item => { sent.push(item.id); if (fail) { await new Promise(resolve => { release = resolve; }); throw Error('Connection lost'); } },
    complete: async () => { queue.shift(); }, fail: async () => {},
  });
  const pending = worker('alice'); await new Promise(resolve => setImmediate(resolve));
  assert.equal(worker('alice'), pending); release(); await pending;
  assert.equal(queue.length, 2); assert.deepEqual(sent, ['arrival']);
  fail = false; await worker('alice');
  assert.deepEqual(sent, ['arrival', 'arrival', 'departure']); assert.equal(queue.length, 0);
});
test('backoff, blocked arrivals and account changes prevent later sends', async () => {
  let active = true; let calls = 0; let entry = { record: record('one'), attempts: 0, nextAttempt: 2000, blocked: false };
  const worker = createFieldOutboxWorker({ active: () => active, now: () => 1000, first: async () => entry, send: async () => { calls++; active = false; }, complete: async () => {}, fail: async () => {} });
  await worker('alice'); assert.equal(calls, 0);
  entry = { ...entry, nextAttempt: 0, blocked: true }; await worker('alice'); assert.equal(calls, 0);
  entry.blocked = false; await worker('alice'); assert.equal(calls, 1);
  await worker('bob'); assert.equal(calls, 1);
});
test('retry delays are capped and permission errors stay available for review', async () => {
  let failure;
  const worker = createFieldOutboxWorker({ active: () => true, now: () => 1000,
    first: async () => ({ record: record('one'), attempts: 30, nextAttempt: 0, blocked: false }),
    send: async () => { throw { code: '42501', message: 'Not authorized' }; }, complete: async () => assert.fail('must not complete'), fail: async (...args) => { failure = args; } });
  await worker('alice'); assert.equal(failure[2], 301000); assert.equal(failure[3], true);
  assert.equal(isPermanentFieldError({ statusCode: '503' }), false);
  assert.equal(isPermanentFieldError({ statusCode: '403' }), true);
});
test('SQLite persists operations across restarts, isolates accounts and retains original time and task identity', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'csy-outbox-test-'));
  const file = path.join(directory, 'outbox.db'); const connections = [];
  const reopen = () => load('lib/fieldOutboxStore.ts', { 'expo-sqlite': { openDatabaseAsync: async () => {
    const db = new DatabaseSync(file); connections.push(db);
    return { execAsync: async sql => db.exec(sql), runAsync: async (sql, ...args) => db.prepare(sql).run(...args), getFirstAsync: async (sql, ...args) => db.prepare(sql).get(...args) || null };
  } } });
  try {
    const first = reopen(); const arrival = record('arrival');
    await first.savePendingFieldRecord(arrival); await first.savePendingFieldRecord(record('departure'));
    await first.savePendingFieldRecord(record('private', 'bob'));
    await first.saveFieldTask(arrival, 'stable-task');
    await first.markFieldFailed(arrival, 1, 5000, true, 'Review permissions');
    const restarted = reopen(); const saved = await restarted.firstPendingFieldRecord('alice');
    assert.equal(saved.record.id, 'arrival'); assert.equal(saved.record.taskId, 'stable-task');
    assert.equal(saved.record.capturedAt, arrival.capturedAt); assert.equal(saved.blocked, true);
    assert.equal((await restarted.firstPendingFieldRecord('bob')).record.id, 'private');
    await restarted.retryPendingFieldRecords('alice'); assert.equal((await restarted.firstPendingFieldRecord('alice')).blocked, false);
    await restarted.markFieldComplete(arrival); assert.equal((await restarted.firstPendingFieldRecord('alice')).record.id, 'departure');
    assert.equal((await restarted.fieldOutboxSummary('alice')).count, 1);
    await restarted.cacheFieldProjects('alice', [{ id: 'villa' }]);
    assert.equal((await restarted.readFieldProjects('bob')).length, 0);
    assert.equal((await restarted.readFieldProjects('alice'))[0].id, 'villa');
    await assert.rejects(() => restarted.savePendingFieldRecord(arrival));
  } finally {
    connections.forEach(db => db.close());
    assert.equal(path.dirname(path.resolve(directory)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(directory).startsWith('csy-outbox-test-'));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
test('photo resizing bounds landscape and portrait images without upscaling', async () => {
  const photos = load('lib/evidencePhoto.ts', { 'expo-image-manipulator': {} });
  assert.equal(photos.evidencePhotoSize(6000, 4000).width, 1600);
  assert.equal(photos.evidencePhotoSize(4000, 6000).height, 1600);
  assert.equal(photos.evidencePhotoSize(640, 480).width, 640);
});
