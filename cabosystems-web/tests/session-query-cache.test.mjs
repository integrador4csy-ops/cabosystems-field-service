import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/lib/sessionQueryCache.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { SessionQueryCache } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const deferred = () => { let resolve, reject; const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; }); return { promise, resolve, reject }; };
const tick = () => new Promise(resolve => setImmediate(resolve));

test('hover, click and reopening a section reuse one request and its fresh result', async () => {
  const cache = new SessionQueryCache(); const request = deferred(); let calls = 0;
  const loader = () => { calls++; return request.promise; };
  const hover = cache.load('tasks', loader);
  const click = cache.load('tasks', loader);
  assert.equal(hover, click);
  await tick(); assert.equal(calls, 1);
  request.resolve([{ id: 'task' }]); await click;
  assert.deepEqual(cache.read('tasks'), [{ id: 'task' }]);
  await cache.load('tasks', loader); assert.equal(calls, 1);
});

test('expired data remains readable during refresh and survives a failed refresh', async () => {
  let now = 0; const cache = new SessionQueryCache(() => now);
  await cache.load('directory', async () => ['villa']); now = 31_000;
  const request = deferred(); const refresh = cache.load('directory', () => request.promise);
  assert.deepEqual(cache.read('directory'), ['villa']);
  request.reject(new Error('offline')); await assert.rejects(refresh, /offline/);
  assert.deepEqual(cache.read('directory'), ['villa']);
  await cache.load('directory', async () => ['villa-new']);
  assert.deepEqual(cache.read('directory'), ['villa-new']);
});

test('a write refresh supersedes an earlier prefetch even when responses arrive out of order', async () => {
  const cache = new SessionQueryCache(); const old = deferred(); const fresh = deferred();
  const prefetch = cache.load('tasks', () => old.promise);
  const refresh = cache.load('tasks', () => fresh.promise, true);
  fresh.resolve(['updated']); await refresh;
  old.resolve(['old']); assert.deepEqual(await prefetch, ['updated']);
  assert.deepEqual(cache.read('tasks'), ['updated']);
});

test('an older subscriber joins the newer refresh instead of overwriting it', async () => {
  const cache = new SessionQueryCache(); const old = deferred(); const fresh = deferred();
  const first = cache.load('groups', () => old.promise);
  const second = cache.load('groups', () => fresh.promise, true);
  old.resolve(['old']); await tick(); fresh.resolve(['new']);
  assert.deepEqual(await first, ['new']); assert.deepEqual(await second, ['new']);
});

test('logout clears data and late responses cannot restore it or enter another session', async () => {
  const oldSession = new SessionQueryCache(); const otherSession = new SessionQueryCache(); const request = deferred();
  const pending = oldSession.load('team', () => request.promise);
  oldSession.clear(); request.resolve(['private']); await pending;
  assert.equal(oldSession.read('team'), undefined); assert.equal(otherSession.read('team'), undefined);
  assert.equal(oldSession.busy, false);
});

test('cache size is bounded and invalidated data is fetched again', async () => {
  const cache = new SessionQueryCache();
  for (let index = 0; index < 25; index++) await cache.load(`group:${index}`, async () => index);
  assert.equal(cache.read('group:0'), undefined); assert.equal(cache.read('group:24'), 24);
  cache.invalidate('group:24');
  assert.equal(await cache.load('group:24', async () => 42), 42);
});
