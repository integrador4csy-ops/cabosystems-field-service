import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const compile = name => ts.transpileModule(readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const query = { exports: {} }; runInNewContext(compile('sessionQueryCache'), query);
const agenda = { exports: {} }; runInNewContext(compile('agendaRangeCache'), agenda);
function fixture() {
  const env = { exports: {}, queueMicrotask, navigator: { onLine: true, connection: { saveData: false, effectiveType: '4g' } }, document: { visibilityState: 'visible' }, require: id => id === './sessionQueryCache' ? query.exports : agenda.exports };
  runInNewContext(compile('sectionResources'), env);
  return { env, resources: new env.exports.SectionResources(), canSpeculate: env.exports.canSpeculate };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('intent data waits for the initial section, then runs one speculative load at a time', async () => {
  const { resources } = fixture(); const calls = []; let finish;
  const first = resources.prefetch(() => { calls.push('tasks'); return new Promise(resolve => { finish = resolve; }); });
  const second = resources.prefetch(async () => { calls.push('agenda'); });
  await tick(); assert.deepEqual(calls, []);
  resources.markReady(); await tick(); assert.deepEqual(calls, ['tasks']);
  finish(); await Promise.all([first, second]); assert.deepEqual(calls, ['tasks', 'agenda']);
});

test('logout prevents queued intent queries even when the first screen never finished', async () => {
  const { resources } = fixture(); let calls = 0;
  const pending = resources.prefetch(async () => { calls++; });
  resources.clear(); await pending;
  assert.equal(calls, 0);
});

test('Strict Mode replay does not dispose a live session, but real unmount does', async () => {
  const { resources } = fixture(); let calls = 0;
  const first = resources.retain(); first();
  const final = resources.retain(); await tick();
  resources.markReady(); await resources.prefetch(async () => { calls++; });
  assert.equal(calls, 1);
  final(); await tick(); await resources.prefetch(async () => { calls++; });
  assert.equal(calls, 1);
});

test('moving to another menu target discards outdated queued intent data', async () => {
  const { resources } = fixture(); const calls = [];
  resources.setIntent('tasks');
  const old = resources.prefetch(async () => calls.push('tasks'), 'tasks');
  resources.setIntent('agenda');
  const latest = resources.prefetch(async () => calls.push('agenda'), 'agenda');
  resources.markReady(); await Promise.all([old, latest]);
  assert.deepEqual(calls, ['agenda']);
});

test('optional data is skipped while critical queries are pending or the connection is limited', async () => {
  const { env, resources, canSpeculate } = fixture(); resources.markReady(); let calls = 0; let finish;
  const critical = resources.queries.load('active-view', () => new Promise(resolve => { finish = resolve; }));
  await tick(); await resources.prefetch(async () => { calls++; }); assert.equal(calls, 0);
  finish('ready'); await critical;
  env.navigator.connection.saveData = true; assert.equal(canSpeculate(), false);
  await resources.prefetch(async () => { calls++; }); assert.equal(calls, 0);
  env.navigator.connection.saveData = false; env.navigator.connection.effectiveType = '2g'; assert.equal(canSpeculate(), false);
  env.navigator.connection.effectiveType = '4g'; env.document.visibilityState = 'hidden'; assert.equal(canSpeculate(), false);
  env.document.visibilityState = 'visible'; env.navigator.onLine = false; assert.equal(canSpeculate(), false);
});
