const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moduleCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/agendaPeriodCache.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exportsForCache = {};
vm.runInNewContext(moduleCode, { exports: exportsForCache, Date, Map, Promise });
const { AgendaPeriodCache } = exportsForCache;

test('adjacent periods are immediately available after prefetch and concurrent requests are shared', async () => {
  const calls = [];
  const cache = new AgendaPeriodCache(async (from, to) => { calls.push([from, to]); return [{ id: from }]; });
  assert.equal(cache.read('2026-11-01', '2026-11-30'), null);
  const pending = cache.load('2026-11-01', '2026-11-30');
  assert.equal(cache.load('2026-11-01', '2026-11-30'), pending);
  const incoming = await pending;
  assert.equal(cache.read('2026-11-01', '2026-11-30'), incoming);
  assert.equal(await cache.load('2026-11-01', '2026-11-30'), incoming);
  assert.equal(calls.length, 1);
});

test('account changes and mutations cannot repopulate the cache with a late response', async () => {
  const requests = [];
  const cache = new AgendaPeriodCache(() => new Promise(resolve => requests.push(resolve)));
  const stale = cache.load('from', 'to'); await Promise.resolve();
  cache.clear();
  const fresh = cache.load('from', 'to'); await Promise.resolve();
  requests[0]([{ id: 'stale' }]); await stale;
  assert.equal(cache.read('from', 'to'), null);
  assert.equal(cache.load('from', 'to'), fresh, 'Old completion cannot remove the new in-flight request');
  const items = [{ id: 'fresh' }]; requests[1](items); await fresh;
  assert.equal(cache.read('from', 'to'), items);
  const otherAccount = new AgendaPeriodCache(async () => []);
  assert.equal(otherAccount.read('from', 'to'), null);
});

test('expired periods refresh, failed reads retain known data, and only seven periods remain in memory', async () => {
  let now = 0, calls = 0, fail = false;
  const cache = new AgendaPeriodCache(async () => { calls++; if (fail) throw new Error('offline'); return [{ id: String(calls) }]; }, () => now);
  const first = await cache.load('a', 'b');
  now = 60_001;
  fail = true;
  await assert.rejects(cache.load('a', 'b'), /offline/);
  assert.equal(cache.read('a', 'b'), first);
  fail = false;
  const updated = await cache.load('a', 'b'); assert.notEqual(updated, first);
  await cache.load('a', 'b', true); assert.equal(calls, 4);
  for (let index = 0; index < 7; index++) await cache.load(`page-${index}`, `end-${index}`);
  assert.equal(cache.read('a', 'b'), null);
  assert.notEqual(cache.read('page-5', 'end-5'), null);
});

test('view changes synchronously reuse a cached month before selection effects, without stale derived data', async () => {
 let calls=0;
 let original=[{id:'earlier',fecha:'2026-10-02'},{id:'selected',fecha:'2026-10-20'},{id:'recurring',fecha:'2026-01-01',occurrence_date:'2026-10-21'}];
 const cache=new AgendaPeriodCache(async()=>{calls++;return original;});
 await cache.load('2026-10-01','2026-10-31');
 const week=cache.read('2026-10-19','2026-10-25');
 assert.deepEqual(Array.from(week,event=>event.id),['selected','recurring']);
 assert.equal(cache.read('2026-10-19','2026-10-25'),week,'Stable reference avoids regrouping cached events');
 assert.equal(cache.read('2026-10-22','2026-10-22').length,0,'Known empty days are available synchronously');
 assert.equal(cache.read('2026-09-28','2026-10-04'),null,'Partial coverage must not hide missing events');
 assert.equal(calls,1);assert.equal(cache.records().length,1,'Derived views do not displace the persisted window');
 original=[...original,{id:'updated',fecha:'2026-10-20'}];
 await cache.load('2026-10-01','2026-10-31',true);
 assert.deepEqual(Array.from(cache.read('2026-10-19','2026-10-25'),event=>event.id),['selected','recurring','updated']);
 cache.clear();assert.equal(cache.read('2026-10-19','2026-10-25'),null);
});
