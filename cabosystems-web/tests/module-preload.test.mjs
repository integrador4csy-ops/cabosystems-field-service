import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/lib/modulePreload.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { sharedModule, preloadModules } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const flush = () => new Promise(resolve => setImmediate(resolve));

function idleQueue() {
  const tasks = new Set();
  return {
    schedule(task) { tasks.add(task); return () => tasks.delete(task); },
    run() { const task = tasks.values().next().value; if (task) { tasks.delete(task); task(); } },
    size: () => tasks.size,
  };
}

test('background preload and opening a view share the same download', async () => {
  let calls = 0; let finish;
  const load = sharedModule(() => { calls++; return new Promise(resolve => { finish = resolve; }); });
  const first = load(); const second = load();
  assert.equal(first, second); assert.equal(calls, 1);
  finish({ component: 'map' });
  assert.deepEqual(await second, { component: 'map' });
  assert.equal(load(), first);
});

test('a failed speculative download can be retried when opening the view', async () => {
  let fail = true;
  const load = sharedModule(async () => { if (fail) throw new Error('offline'); return 'map'; });
  await assert.rejects(load(), /offline/);
  fail = false; assert.equal(await load(), 'map');
});

test('modules load sequentially during idle slots and a failure does not block later modules', async () => {
  const queue = idleQueue(); const calls = []; let finish;
  const stop = preloadModules([
    () => { calls.push('map'); return new Promise(resolve => { finish = resolve; }); },
    async () => { calls.push('tasks'); throw new Error('offline'); },
    async () => { calls.push('agenda'); },
  ], queue.schedule);
  assert.deepEqual(calls, []);
  queue.run(); await flush();
  assert.deepEqual(calls, ['map']); assert.equal(queue.size(), 0);
  finish(); await flush();
  queue.run(); await flush();
  queue.run(); await flush();
  assert.deepEqual(calls, ['map', 'tasks', 'agenda']);
  stop();
});

test('leaving the session cancels queued modules, including after an in-flight download', async () => {
  const queue = idleQueue(); const calls = []; let finish;
  const stop = preloadModules([
    () => { calls.push('map'); return new Promise(resolve => { finish = resolve; }); },
    async () => { calls.push('private-view'); },
  ], queue.schedule);
  queue.run(); await flush(); stop(); finish(); await flush(); queue.run();
  assert.deepEqual(calls, ['map']); assert.equal(queue.size(), 0);
  const cancelled = preloadModules([async () => { calls.push('cancelled'); }], queue.schedule);
  cancelled(); queue.run(); await flush();
  assert.deepEqual(calls, ['map']);
});
