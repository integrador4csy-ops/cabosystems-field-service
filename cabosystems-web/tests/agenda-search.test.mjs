import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
function load(file, imports = {}) {
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(code, { module, exports: module.exports, Date, Map, Set, Intl, Promise, Error, require: name => { if (name in imports) return imports[name]; throw new Error(`Unexpected ${name}`); } });
  return module.exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const event = patch => ({ id: 'local', titulo: 'Reunión con Sebastián', descripcion: null, ubicacion: 'Oficina', fecha: '2027-02-01', hora: '10:00', tipo: 'evento', repeticion: 'ninguna', intervalo: 1, dias_semana: [], repetir_hasta: null, created_at: '', ...patch });
for (const platform of ['web', 'mobile']) {
  const root = platform === 'web' ? '../src/lib/' : '../../cabosystems-mobile/lib/';
  const dateName = platform === 'web' ? 'taskDates' : 'agenda';
  const dates = load(`${root}${dateName}.ts`);
  const search = load(`${root}agendaSearch.ts`, { [`./${dateName}`]: dates });
  test(`${platform}: global search matches accents, case, substrings and all terms across fields and years`, () => {
    assert.equal(search.matchesAgendaSearch(event(), 'seBAst'), true);
    assert.equal(search.matchesAgendaSearch(event(), 'sebastian oficina'), true);
    assert.equal(search.matchesAgendaSearch(event(), 'sebastian taller'), false);
    assert.equal(search.matchesAgendaSearch(event({ google: { calendarName: 'Sebastián' } }), 'SEBASTIAN'), true);
    const results = search.localAgendaSearch([event({ fecha: '2020-01-01' }), event({ id: 'future' })], 'sebastian', '2026-10-23');
    assert.equal(results.length, 2);
    assert.deepEqual(plain(search.sortAgendaSearch(results, '2026-10-23').map(hit => hit.event.id)), ['future', 'local']);
  });
  test(`${platform}: recurrent series have one result and an accurate next date without infinite expansion`, () => {
    const series = event({ fecha: '2028-01-31', repeticion: 'mensual' });
    assert.equal(search.nextAgendaDate(series, '2028-02-01'), '2028-02-29');
    assert.equal(search.nextAgendaDate({ ...series, intervalo: 2 }, '2028-02-01'), '2028-03-31');
    assert.equal(search.nextAgendaDate({ ...series, repetir_hasta: '2028-02-01' }, '2028-02-02'), null);
    assert.equal(search.nextAgendaDate(event({ fecha: '2026-10-19', repeticion: 'semanal', intervalo: 2, dias_semana: [1, 7] }), '2026-10-26'), '2026-11-02');
    assert.equal(search.nextAgendaDate(event({ fecha: '2026-10-19', repeticion: 'diaria', intervalo: 3 }), '2026-10-23'), '2026-10-25');
    assert.equal(search.localAgendaSearch([series], 'sebast', '2028-02-01').length, 1);
    assert.equal(series.occurrence_date, undefined);
  });
  test(`${platform}: relevance puts exact and partial title matches ahead of newer description-only matches`, () => {
    const hits = search.localAgendaSearch([
      event({ id: 'description', titulo: 'Visita', descripcion: 'Sebastián', fecha: '2026-10-24' }),
      event({ id: 'partial', titulo: 'Reunión con Sebastián', fecha: '2026-10-25' }),
      event({ id: 'exact', titulo: 'SEBASTIÁN', fecha: '2020-01-01' }),
    ], 'sebastian', '2026-10-23');
    assert.deepEqual(plain(search.sortAgendaSearch(hits, '2026-10-23', 'sebastian').map(hit => hit.event.id)), ['exact', 'partial', 'description']);
  });
  test(`${platform}: API pages indexed local matches outside the visible month and never accepts partial Google results`, async () => {
    const records = Array.from({ length: 501 }, (_, i) => event({ id: String(i), fecha: i === 500 ? '2020-01-01' : '2027-02-01' }));
    const calls = []; let fail = false;
    const builder = { select: () => builder, order: () => builder, range: async (from, to) => { calls.push([from, to]); return { data: records.slice(from, to + 1), error: null }; } };
    const api = load(`${root}agendaSearchApi.ts`, { './agendaSearch': search, './supabase': { supabase: { rpc: async (name, args) => { assert.equal(name, 'agenda_search_local'); assert.equal(args.p_query, 'sebast'); return builder.range(args.p_offset, args.p_offset + args.p_limit - 1); }, from: () => { throw new Error('Full table download forbidden'); }, functions: { invoke: async (_, { body }) => { assert.equal(body.action, 'search'); assert.equal(body.query, 'sebast'); return fail ? { error: new Error('Denied') } : { data: { hits: [], unavailableCalendars: 1 } }; } } } } });
    const result = await api.searchCompanyAgenda('sebast', '2026-10-23');
    assert.equal(result.hits.length, 501); assert.equal(result.unavailableCalendars, 1);
    assert.deepEqual(calls, [[0, 499], [500, 999]]);
    fail = true; await assert.rejects(api.searchCompanyAgenda('sebast', '2026-10-23'), /Google Calendar/);
    calls.length = 0; await api.searchCompanyAgenda(' ', '2026-10-23'); assert.equal(calls.length, 0);
  });
}
