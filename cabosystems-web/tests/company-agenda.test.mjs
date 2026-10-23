import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';

const compile = (name) => ts.transpileModule(readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const url = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const datesUrl = url(compile('taskDates'));
const { agendaDays } = await import(url(compile('agendaDates').replace("'./taskDates'", JSON.stringify(datesUrl))));
const { expandCompanyEvents, occursOn, validRecurrence, NO_RECURRENCE } = await import(url(compile('agendaRecurrence').replace("'./taskDates'", JSON.stringify(datesUrl))));
const reminder = (patch = {}) => ({ id: 'series', titulo: 'Revisar rack', tipo: 'recordatorio', fecha: '2026-10-19', hora: '09:30:00', descripcion: null, ubicacion: null, created_at: '', ...NO_RECURRENCE, ...patch });

test('weekly reminders select Monday through Sunday, skip unselected days and honor the inclusive end', () => {
  const series = reminder({ repeticion: 'semanal', dias_semana: [1, 3, 7], repetir_hasta: '2026-11-01' });
  const results = expandCompanyEvents([series], '2026-10-18', '2026-11-03');
  assert.deepEqual(results.map((e) => e.occurrence_date), ['2026-10-19', '2026-10-21', '2026-10-25', '2026-10-26', '2026-10-28', '2026-11-01']);
  assert.ok(results.every((e) => e.id === series.id && e.fecha === '2026-10-19'));
  assert.equal(series.occurrence_date, undefined, 'Expansion must not mutate the saved series');
  assert.equal(occursOn(series, '2026-10-18'), false);
  assert.deepEqual(expandCompanyEvents([series], '2026-11-02', '2026-11-30'), []);
});

test('custom intervals remain anchored to the original week or day across years and timezones', () => {
  const original = process.env.TZ;
  try {
    for (const zone of ['America/Mazatlan', 'America/New_York', 'Pacific/Auckland']) {
      process.env.TZ = zone;
      const weekly = reminder({ fecha: '2026-12-30', repeticion: 'semanal', intervalo: 2, dias_semana: [1, 3, 7] });
      assert.deepEqual(expandCompanyEvents([weekly], '2026-12-28', '2027-01-17').map((e) => e.occurrence_date), ['2026-12-30', '2027-01-03', '2027-01-11', '2027-01-13', '2027-01-17']);
      const daily = reminder({ fecha: '2026-03-07', repeticion: 'diaria', intervalo: 2 });
      assert.deepEqual(expandCompanyEvents([daily], '2026-03-07', '2026-03-13').map((e) => e.occurrence_date), ['2026-03-07', '2026-03-09', '2026-03-11', '2026-03-13']);
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('monthly reminders clamp short months without drifting and can repeat every N months', () => {
  const series = reminder({ fecha: '2028-01-31', repeticion: 'mensual' });
  assert.deepEqual(expandCompanyEvents([series], '2028-02-01', '2028-04-30').map((e) => e.occurrence_date), ['2028-02-29', '2028-03-31', '2028-04-30']);
  assert.deepEqual(expandCompanyEvents([{ ...series, intervalo: 2 }], '2028-02-01', '2028-07-31').map((e) => e.occurrence_date), ['2028-03-31', '2028-05-31', '2028-07-31']);
  assert.deepEqual(expandCompanyEvents([reminder({ fecha: '2027-01-31', repeticion: 'mensual' })], '2027-02-01', '2027-02-28').map((e) => e.occurrence_date), ['2027-02-28']);
});

test('one-off reminders stay single and invalid rules cannot be saved', () => {
  assert.deepEqual(expandCompanyEvents([reminder()], '2026-10-01', '2026-10-31').map((e) => e.occurrence_date), ['2026-10-19']);
  assert.equal(validRecurrence(reminder()), true);
  assert.equal(validRecurrence(reminder({ tipo: 'evento', repeticion: 'diaria' })), true);
  assert.equal(expandCompanyEvents([reminder({ tipo: 'evento', repeticion: 'diaria' })], '2026-10-19', '2026-10-21').length, 3);
  assert.equal(validRecurrence(reminder({ repeticion: 'semanal', dias_semana: [1, 7] })), true);
  for (const patch of [{ repeticion: 'semanal' }, { intervalo: 0 }, { intervalo: 1.5 }, { intervalo: 366 }, { repeticion: 'mensual', dias_semana: [1] }, { repetir_hasta: '2026-10-18' }, { repetir_hasta: '' }, { fecha: '2026-02-30' }, { repeticion: 'semanal', dias_semana: [0, 8] }]) assert.equal(validRecurrence(reminder(patch)), false, JSON.stringify(patch));
});

test('company calendar includes every date and weekend across months and years', () => {
  for (const anchor of ['2026-10-19', '2026-02-15', '2028-02-29', '2027-01-01']) {
    const days = agendaDays(anchor, 'month');
    assert.equal(days.length % 7, 0);
    assert.equal(new Date(`${days[0]}T12:00:00`).getDay(), 1);
    assert.equal(new Date(`${days.at(-1)}T12:00:00`).getDay(), 0);
    const count = new Date(+anchor.slice(0, 4), +anchor.slice(5, 7), 0).getDate();
    assert.equal(days.filter((day) => day.startsWith(anchor.slice(0, 7))).length, count);
    assert.equal(new Set(days).size, days.length);
  }
  assert.deepEqual(agendaDays('2026-10-24', 'day'), ['2026-10-24']);
  assert.equal(agendaDays('2026-10-24', 'week').at(-1), '2026-10-25');
});

test('agenda database enforces role access, active membership and valid entries', async () => {
  const db = new PGlite();
  const ids = [1, 2, 3, 4, 5].map((n) => `a1000000-0000-0000-0000-${String(n).padStart(12, '0')}`);
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      create table public.profiles (id uuid primary key, rol text, activo boolean);
      insert into profiles values ('${ids[0]}','admin',true),('${ids[1]}','supervisor_instalacion',true),('${ids[2]}','aux_instalacion',true),('${ids[3]}','admin',false);
      alter table profiles enable row level security; grant select on profiles to authenticated;
      create policy self_profile on profiles for select to authenticated using(id=auth.uid());`);
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261019232359_company_agenda.sql', import.meta.url), 'utf8'));
    await db.exec(readFileSync(new URL('../../supabase/migrations/20261019233835_agenda_reminder_recurrence.sql', import.meta.url), 'utf8'));
    const endTimeMigration = readdirSync(new URL('../../supabase/migrations/', import.meta.url)).find((name) => name.endsWith('_agenda_event_end_time.sql'));
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${endTimeMigration}`, import.meta.url), 'utf8'));
    const asUser = async (id, query) => {
      await db.exec(`begin; set local role authenticated; set local request.jwt.claim.sub = '${id}';`);
      try { const result = await db.query(query); await db.exec('commit'); return result; }
      catch (error) { await db.exec('rollback'); throw error; }
    };
    const insert = (kind) => `insert into agenda_eventos(titulo,tipo,fecha) values('Entrega de casa','${kind}','2026-10-24') returning id`;
    const event = (await asUser(ids[0], insert('evento'))).rows[0].id;
    const reminder = (await asUser(ids[1], insert('recordatorio'))).rows[0].id;
    assert.equal((await asUser(ids[0], `select hora_fin from agenda_eventos where id='${event}'`)).rows[0].hora_fin, null);
    await asUser(ids[0], `update agenda_eventos set hora='09:00',hora_fin='10:00' where id='${event}'`);
    await assert.rejects(asUser(ids[0], `update agenda_eventos set hora_fin='08:00' where id='${event}'`));
    await assert.rejects(asUser(ids[0], `update agenda_eventos set hora=null where id='${event}'`));
    await asUser(ids[0], `update agenda_eventos set hora=null,hora_fin=null where id='${event}'`);
    assert.equal((await asUser(ids[0], `select repeticion from agenda_eventos where id='${event}'`)).rows[0].repeticion, 'ninguna');
    const rule = (await asUser(ids[1], `update agenda_eventos set repeticion='semanal', intervalo=2, dias_semana=array[1,7], repetir_hasta='2026-12-31' where id='${reminder}' returning *`)).rows[0];
    assert.equal(rule.repeticion, 'semanal'); assert.deepEqual(rule.dias_semana, [1, 7]);
    const unifiedMigration = readdirSync(new URL('../../supabase/migrations/', import.meta.url)).find(name => name.endsWith('_agenda_unified_events.sql'));
    await db.exec(readFileSync(new URL(`../../supabase/migrations/${unifiedMigration}`, import.meta.url), 'utf8'));
    const migrated = (await asUser(ids[0], `select tipo, repeticion, dias_semana from agenda_eventos where id='${reminder}'`)).rows[0];
    assert.equal(migrated.tipo, 'evento'); assert.equal(migrated.repeticion, 'semanal'); assert.deepEqual(migrated.dias_semana, [1, 7]);
    for (const assignment of ["intervalo=0", "intervalo=366", "dias_semana='{}'", "dias_semana=array[0,8]", "dias_semana=array[null]::integer[]", "repetir_hasta='2026-01-01'", "repeticion='mensual'", "repeticion='ninguna'"]) await assert.rejects(asUser(ids[0], `update agenda_eventos set ${assignment} where id='${reminder}'`));
    assert.equal((await asUser(ids[2], 'select * from agenda_eventos')).rows.length, 2);
    for (const id of [ids[2], ids[3], ids[4]]) {
      await assert.rejects(asUser(id, insert('evento')));
      assert.equal((await asUser(id, `update agenda_eventos set titulo='No permitido' returning id`)).rows.length, 0);
      assert.equal((await asUser(id, 'delete from agenda_eventos returning id')).rows.length, 0);
    }
    for (const id of [ids[3], ids[4]]) assert.equal((await asUser(id, 'select * from agenda_eventos')).rows.length, 0);
    assert.equal((await asUser(ids[1], `update agenda_eventos set titulo='Pruebas de rack' where id='${event}' returning titulo`)).rows[0].titulo, 'Pruebas de rack');
    for (const query of [insert('tarea'), `insert into agenda_eventos(titulo,fecha) values(' ','2026-10-19')`, `insert into agenda_eventos(titulo,fecha) values('Sin fecha',null)`]) await assert.rejects(asUser(ids[0], query));
    for (const query of ['select * from agenda_eventos', insert('evento'), 'update agenda_eventos set titulo=\'No\'', 'delete from agenda_eventos']) {
      await db.exec('begin; set local role anon;');
      await assert.rejects(db.query(query)); await db.exec('rollback');
    }
    assert.equal((await asUser(ids[1], `delete from agenda_eventos where id='${reminder}' returning id`)).rows.length, 1);
    assert.equal((await asUser(ids[0], `delete from agenda_eventos where id='${event}' returning id`)).rows.length, 1);
  } finally { await db.close(); }
});
