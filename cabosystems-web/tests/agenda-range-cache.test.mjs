import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/lib/agendaRangeCache.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { AgendaRangeCache } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const event = (id, fecha, occurrence_date) => ({ id, fecha, occurrence_date });

test('a loaded month serves weeks and days, including recurring occurrences, without another request', async () => {
  let calls = 0;
  const cache = new AgendaRangeCache(async () => { calls++; return [event('local', '2026-10-19'), event('series', '2026-01-01', '2026-10-20'), event('outside', '2026-10-30')]; });
  await cache.load('2026-09-28', '2026-11-01');
  assert.deepEqual((await cache.load('2026-10-19', '2026-10-25')).map(item => item.id), ['local', 'series']);
  assert.deepEqual(cache.read('2026-10-20', '2026-10-20').events.map(item => item.id), ['series']);
  assert.equal(cache.read('2026-10-21', '2026-10-21').events.length, 0);
  assert.equal(calls, 1);
});

test('navigation reuses an in-flight preload and invalidation rejects old results from the cache', async () => {
  const pending = [];
  const cache = new AgendaRangeCache(() => new Promise(resolve => pending.push(resolve)));
  const old = cache.load('2026-10-01', '2026-10-31');
  assert.equal(cache.load('2026-10-01', '2026-10-31'), old);
  cache.clear();
  const next = cache.load('2026-10-01', '2026-10-31');
  pending[1]([event('new', '2026-10-20')]); await next;
  pending[0]([event('old', '2026-10-20')]); await old;
  assert.equal(cache.read('2026-10-20', '2026-10-20').events[0].id, 'new');
});

test('expired data stays available for immediate display while a fresh query runs', async () => {
  let now = 0; let calls = 0;
  const cache = new AgendaRangeCache(async () => [event(String(++calls), '2026-10-20')], () => now);
  await cache.load('2026-10-01', '2026-10-31');
  now = 120_001;
  assert.equal(cache.read('2026-10-20', '2026-10-20').fresh, false);
  assert.equal(cache.read('2026-10-20', '2026-10-20').events[0].id, '1');
  await cache.load('2026-10-01', '2026-10-31');
  assert.equal(cache.read('2026-10-20', '2026-10-20').events[0].id, '2');
});

test('memory stays bounded by both period count and event count', async () => {
  const cache = new AgendaRangeCache(async from => [event(from, from)]);
  for (let month = 1; month <= 6; month++) {
    const date = `2026-${String(month).padStart(2, '0')}-01`;
    await cache.load(date, date);
  }
  assert.equal(cache.read('2026-01-01', '2026-01-01'), null);
  assert.ok(cache.read('2026-06-01', '2026-06-01'));
  const large = new AgendaRangeCache(async from => Array.from({ length: 12_000 }, (_, index) => event(String(index), from)));
  await large.load('2026-10-01', '2026-10-31');
  await large.load('2026-11-01', '2026-11-30');
  assert.equal(large.read('2026-10-01', '2026-10-31'), null);
  assert.equal(large.read('2026-11-01', '2026-11-30').events.length, 12_000);
});

test('failed preloads remain retryable and separate sessions do not share calendar data', async () => {
  let fail = true;
  const cache = new AgendaRangeCache(async () => { if (fail) throw new Error('offline'); return []; });
  await assert.rejects(cache.load('2026-10-01', '2026-10-31'), /offline/);
  assert.equal(cache.read('2026-10-01', '2026-10-31'), null);
  fail = false; await cache.load('2026-10-01', '2026-10-31');
  assert.deepEqual(cache.read('2026-10-01', '2026-10-31').events, []);
  const anotherSession = new AgendaRangeCache(async () => []);
  assert.equal(anotherSession.read('2026-10-01', '2026-10-31'), null);
});

test('speculative months cannot evict the visible month when the event budget is full', async () => {
  const cache = new AgendaRangeCache(async from => Array.from({ length: 12_000 }, (_, index) => event(String(index), from)));
  cache.setVisibleRange('2026-10-01', '2026-10-31');
  await cache.load('2026-10-01', '2026-10-31');
  await cache.load('2026-11-01', '2026-11-30');
  assert.equal(cache.read('2026-10-01', '2026-10-31').events.length, 12_000);
  assert.equal(cache.read('2026-11-01', '2026-11-30'), null);
});

test('the moving window retains the current month and two months on each side', async () => {
  const cache = new AgendaRangeCache(async from => [event(from, from)]);
  const load = month => cache.load(`2026-${month}-01`, `2026-${month}-28`);
  cache.setVisibleRange('2026-06-01', '2026-06-28');
  for (const month of ['06', '07', '05', '08', '04']) await load(month);
  cache.setVisibleRange('2026-07-01', '2026-07-28');
  for (const month of ['07', '08', '06', '09', '05']) await load(month);
  assert.equal(cache.read('2026-04-01', '2026-04-28'), null);
  for (const month of ['05', '06', '07', '08', '09']) assert.ok(cache.read(`2026-${month}-01`, `2026-${month}-28`));
});
