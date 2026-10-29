const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual remote pipeline against a controlled PostgREST adapter.
// No production data or user session is used by these tests.
function setup() {
  const state = { owner: 'alice', active: true, uploads: [], statuses: [], tasks: [], records: [], missingPhoto: false, uncertainRecord: false, uncertainTask: false, deny: false };
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: state.owner } } }, error: null }) },
    from(table) {
      const filters = []; const orders = []; let operation = 'select'; let value; let one = false; let limit;
      const builder = {
        select() { return this; }, eq(key, expected) { filters.push([key, expected]); return this; },
        order(key, options) { orders.push([key, options]); return this; }, limit(count) { limit = count; return this; },
        maybeSingle() { one = true; return this; }, single() { one = true; return this; },
        insert(input) { operation = 'insert'; value = input; return this; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            const rows = table === 'tareas' ? state.tasks : state.records;
            if (operation === 'insert') {
              if (state.deny) return { data: null, error: { code: '42501', message: 'Not allowed' } };
              if (rows.some(row => row.id === value.id)) return { data: null, error: { code: '23505' } };
              rows.push({ ...value });
              const flag = table === 'tareas' ? 'uncertainTask' : 'uncertainRecord';
              if (state[flag]) { state[flag] = false; return { data: null, error: { message: 'Response lost after commit' } }; }
              return { data: null, error: null };
            }
            let found = rows.filter(row => filters.every(([key, expected]) => row[key] === expected));
            found = [...found].sort((a, b) => {
              for (const [key, options] of orders) { const comparison = String(a[key] || '').localeCompare(String(b[key] || '')); if (comparison) return options?.ascending === false ? -comparison : comparison; }
              return 0;
            });
            if (limit) found = found.slice(0, limit);
            return { data: one ? found[0] || null : found, error: null };
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const imports = {
    './supabase': { supabase: client },
    './api': { uploadEvidencePhoto: async (uri, key) => { state.uploads.push({ uri, key }); state.onUpload?.(); return `https://storage.invalid/${key}`; }, updateTaskStatus: async (id, status) => { state.statuses.push([id, status]); } },
    './fieldOutboxStore': { saveFieldTask: async (record, taskId) => { record.taskId = taskId; } },
    'expo-file-system/legacy': { getInfoAsync: async () => ({ exists: !state.missingPhoto }) },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/fieldOutboxRemote.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: name => { if (!(name in imports)) throw Error(name); return imports[name]; }, Error });
  const send = record => module.exports.sendPendingFieldRecord(record, () => { if (!state.active) throw Error('paused'); });
  const record = { id: 'operation', owner: 'alice', projectId: 'villa', taskId: null, photoUri: 'file:///photo.jpg', capturedAt: '2026-10-26T10:00:00.000Z', tipo: 'check_in', latitude: 22, longitude: -109, comments: 'original' };
  return { state, send, record };
}
test('lost insert response can be retried without duplicate records or repeated photo upload', async () => {
  const { state, send, record } = setup(); state.uncertainRecord = true;
  await assert.rejects(() => send(record));
  assert.equal(state.records.length, 1); assert.equal(record.taskId, 'operation');
  await send(record); await send(record);
  assert.equal(state.records.length, 1); assert.equal(state.tasks.length, 1); assert.equal(state.uploads.length, 1);
  assert.equal(state.records[0].fecha_hora, record.capturedAt);
  assert.equal(state.records[0].latitud, 22); assert.equal(state.records[0].comentarios, 'original');
});
test('task creation uses stable identity even when its response is lost', async () => {
  const { state, send, record } = setup(); state.uncertainTask = true;
  await assert.rejects(() => send(record)); await send(record);
  assert.equal(state.tasks.length, 1); assert.equal(state.tasks[0].id, record.id); assert.equal(state.records.length, 1);
});
test('account switches and background transitions never send the next stage', async () => {
  const { state, send, record } = setup(); state.owner = 'bob';
  await assert.rejects(() => send(record)); assert.equal(state.tasks.length, 0); assert.equal(state.uploads.length, 0);
  state.owner = 'alice'; state.onUpload = () => { state.active = false; };
  await assert.rejects(() => send(record)); assert.equal(state.records.length, 0);
});
test('missing photos and denied writes remain errors rather than false success', async () => {
  const { state, send, record } = setup(); state.missingPhoto = true;
  await assert.rejects(() => send(record), error => error.code === 'LOCAL_PHOTO_MISSING');
  assert.equal(state.uploads.length, 0); assert.equal(state.records.length, 0);
  state.missingPhoto = false; state.deny = true;
  await assert.rejects(() => send(record), error => error.code === '42501');
  assert.equal(state.records.length, 0);
});
test('an older offline arrival does not overwrite the status from a newer departure', async () => {
  const { state, send, record } = setup(); state.tasks.push({ id: 'task', proyecto_id: 'villa', asignado_a: 'alice', estatus: 'completada' });
  state.records.push({ id: 'newer', tarea_id: 'task', tecnico_id: 'alice', fecha_hora: '2026-10-26T12:00:00.000Z' });
  await send(record); assert.equal(state.statuses.length, 0);
});
