import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
function load(file, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date, Map, Set, Promise, Error, AbortController, setTimeout, clearTimeout,
    require: name => { if (name in imports) return imports[name]; throw new Error(`Unexpected ${name}`); } });
  return module.exports;
}
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const sample = (id, google = false) => ({ id, titulo: 'Sebastián', fecha: '2026-10-23', hora: null, ubicacion: null, descripcion: null,
  repeticion: 'ninguna', intervalo: 1, dias_semana: [], repetir_hasta: null,
  ...(google ? { google: { calendarId: 'office', calendarName: 'Oficina', etag: 'v1' } } : {}) });
for (const platform of ['web', 'mobile']) {
  const root = platform === 'web' ? '../src/lib/' : '../../cabosystems-mobile/lib/';
  const dateName = platform === 'web' ? 'taskDates' : 'agenda';
  const search = load(`${root}agendaSearch.ts`, { [`./${dateName}`]: load(`${root}${dateName}.ts`) });
  function fixture() {
    const state = { local: [sample('local')], google: [], remote: null, dateGate: null, calls: [], signals: [] };
    const supabase = {
      rpc() {
        const result = Promise.resolve({ data: state.local, error: null });
        result.abortSignal = signal => { state.signals.push(signal); return result; }; return result;
      },
      functions: { async invoke(_name, { body, signal }) {
        state.calls.push(body); state.signals.push(signal);
        if (body.action === 'prepare-search') return { data: { ready: true } };
        const value = body.action === 'search-dates'
          ? (state.dateGate || Promise.resolve({ dates: [] }))
          : (state.remote || Promise.resolve({ hits: state.google, unavailableCalendars: 0 }));
        return new Promise(resolve => {
          const cancel = () => resolve({ error: new Error('Aborted') }); signal?.addEventListener('abort', cancel, { once: true });
          value.then(data => { signal?.removeEventListener('abort', cancel); resolve({ data }); });
        });
      } },
    };
    const api = load(`${root}agendaSearchApi.ts`, { './supabase': { supabase }, './agendaSearch': search });
    const { AgendaSearchClient } = load(`${root}agendaSearchClient.ts`, { './agendaSearchApi': api, './agendaSearch': search });
    return { state, api, AgendaSearchClient };
  }
  test(`${platform}: local matches render while the Google response remains unresolved`, async () => {
    const { state, api } = fixture(); const gate = deferred(); state.remote = gate.promise; const updates = [];
    const pending = api.searchCompanyAgenda('sebast', '2026-10-23', { onUpdate: data => updates.push(data) });
    await tick();
    assert.equal(updates.at(-1).hits[0].event.id, 'local'); assert.equal(updates.at(-1).googlePending, true);
    gate.resolve({ hits: [{ event: sample('google', true), series: false, nextDate: null }], unavailableCalendars: 0 });
    const result = await pending; assert.equal(result.hits.length, 2); assert.equal(result.pending, false);
  });
  test(`${platform}: cancelling a query aborts both transports and cannot publish late results`, async () => {
    const { state, api } = fixture(); const gate = deferred(); state.remote = gate.promise; const controller = new AbortController(); const updates = [];
    const pending = api.searchCompanyAgenda('sebast', '2026-10-23', { signal: controller.signal, onUpdate: data => updates.push(data) });
    await tick(); const before = updates.length; controller.abort();
    await assert.rejects(pending, error => error.name === 'AbortError');
    gate.resolve({ hits: [], unavailableCalendars: 0 }); await tick();
    assert.equal(updates.length, before); assert.ok(state.signals.every(signal => signal === controller.signal && signal.aborted));
  });
  test(`${platform}: cached prefix matches appear before transport and survive a faster empty local response`, async () => {
    const { state, AgendaSearchClient } = fixture(); state.local = [];
    state.google = [{ event: sample('google', true), series: false, nextDate: null }];
    const client = new AgendaSearchClient(0);
    await client.search('seb', '2026-10-23', new AbortController().signal, () => {});
    const gate = deferred(); state.remote = gate.promise; const updates = [];
    const pending = client.search('sebast', '2026-10-23', new AbortController().signal, data => updates.push(data));
    await tick(); await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(updates.length); assert.ok(updates.every(data => data.hits.some(hit => hit.event.id === 'google')));
    gate.resolve({ hits: [], unavailableCalendars: 0 }); assert.equal((await pending).hits.length, 0);
    client.clear(); state.remote = gate.promise;
    const cleared = []; await client.search('seb', '2026-10-23', new AbortController().signal, data => cleared.push(data));
    assert.ok(cleared.every(data => data.hits.length === 0));
  });
  test(`${platform}: date enrichment is independent and cached; another session cannot inherit text matches`, async () => {
    const { state, AgendaSearchClient } = fixture(); state.local = [];
    const hit = { event: sample('gcal:office:series', true), series: true, nextDate: null, nextDatePending: true };
    state.google = [hit]; const client = new AgendaSearchClient(0); const updates = [];
    const result = await client.search('seb', '2026-10-23', new AbortController().signal, data => updates.push(data));
    assert.equal(result.hits.length, 1); assert.equal(state.calls.filter(call => call.action === 'search-dates').length, 0);
    const gate = deferred(); state.dateGate = gate.promise;
    const dates = client.completeDates(result.hits, '2026-10-23', new AbortController().signal);
    gate.resolve({ dates: [{ id: hit.event.id, nextDate: '2027-01-01' }] }); await dates;
    await client.completeDates(result.hits, '2026-10-23', new AbortController().signal);
    assert.equal(state.calls.filter(call => call.action === 'search-dates').length, 1);
    const other = new AgendaSearchClient(0); state.google = []; const foreign = [];
    await other.search('seb', '2026-10-23', new AbortController().signal, data => foreign.push(data));
    assert.ok(foreign.every(data => data.hits.length === 0));
  });
}

test('server authorization snapshots expire after 30 seconds and use the latest checked access role', async () => {
  let state = { calendar_id: 'office', calendar_name: 'Oficina', access_role: 'reader', synced_at: new Date().toISOString(), sync_token: 'opaque' };
  const builder = { select: () => builder, eq: () => builder, in: async () => ({ data: [state], error: null }) };
  const { createSearchIndexStore } = load('../../supabase/functions/_shared/google-calendar/search-store.ts');
  const store = createSearchIndexStore({ from: () => builder });
  const selected = [{ id: 'office', name: 'Oficina', accessRole: 'writer' }];
  const authorized = await store.authorizedCalendars('revision', selected);
  assert.equal(authorized[0].accessRole, 'reader'); assert.equal('sync_token' in authorized[0], false);
  state = { ...state, synced_at: new Date(Date.now() - 31_000).toISOString() };
  assert.equal(await store.authorizedCalendars('revision', selected), null);
  state = { ...state, synced_at: null }; assert.equal(await store.authorizedCalendars('revision', selected), null);
});
