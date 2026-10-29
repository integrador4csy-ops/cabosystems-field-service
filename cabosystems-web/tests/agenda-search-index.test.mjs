import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';

const migration = readFileSync(new URL('../../supabase/migrations/20261023193925_agenda_search_index.sql', import.meta.url), 'utf8');
const revision = 'a1000000-0000-0000-0000-000000000001';
const other = 'a1000000-0000-0000-0000-000000000002';
const raw = (id, summary, patch = {}) => ({ id, etag: 'v1', summary, start: { date: '2026-10-23' }, end: { date: '2026-10-24' }, ...patch });
async function fixture() {
  const db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    create table public.agenda_eventos(id uuid primary key default gen_random_uuid(),titulo text,descripcion text,ubicacion text,fecha date default '2026-10-23');
    alter table public.agenda_eventos enable row level security;
    grant select,insert,update,delete on public.agenda_eventos to authenticated;
    create policy agenda_read on public.agenda_eventos for select to authenticated using(current_setting('app.active',true)='yes');
    create policy agenda_write on public.agenda_eventos for all to authenticated using(current_setting('app.active',true)='yes') with check(current_setting('app.active',true)='yes');
    create table public.google_calendar_connection(id boolean primary key default true,revision uuid not null);
    insert into public.google_calendar_connection values(true,'${revision}');
    grant select,update on public.google_calendar_connection to service_role;`);
  await db.exec(migration);
  const backgroundMigration = readdirSync(new URL('../../supabase/migrations/', import.meta.url)).find(name => name.endsWith('_agenda_search_background_refresh.sql'));
  await db.exec(readFileSync(new URL('../../supabase/migrations/' + backgroundMigration, import.meta.url), 'utf8'));
  return db;
}
async function asRole(db, role, query, params = []) {
  await db.exec(`begin; set local role ${role};`);
  try { const result = await db.query(query, params); await db.exec('commit'); return result.rows; }
  catch (error) { await db.exec('rollback'); throw error; }
}
async function claim(db, role = 'writer', name = 'Oficina') {
  return (await asRole(db, 'service_role', 'select public.agenda_search_claim($1,$2,$3,$4) value', [revision, 'office', role, name]))[0].value;
}
async function commit(db, lease, token, items, full = false, role = 'writer') {
  return asRole(db, 'service_role', 'select public.agenda_search_commit($1,$2,$3,$4,$5,$6,$7,$8)', [revision, 'office', lease, role, 'Oficina', token, full, JSON.stringify(items)]);
}
async function search(db, query, role = 'writer') {
  return asRole(db, 'service_role', 'select * from public.agenda_search_google($1,$2,$3)', [revision, JSON.stringify([{ id: 'office', name: 'Oficina', accessRole: role }]), query]);
}

test('local indexed RPC preserves RLS, accents, literal wildcards, pagination and trigger integrity', async () => {
  const db = await fixture();
  try {
    await db.exec("set app.active='yes'");
    await asRole(db, 'authenticated', `insert into agenda_eventos(titulo,ubicacion,search_text) values('Sebastián','Oficina','forged'),('Visita','Sebastián',''),('100% listo','Taller',''),('Unidad_1','Taller','')`);
    const rows = await asRole(db, 'authenticated', "select * from public.agenda_search_local('SEBASTIAN oficina')");
    assert.equal(rows.length, 1); assert.equal(rows[0].search_text, 'sebastian oficina cabosystems');
    assert.equal((await asRole(db, 'authenticated', "select * from public.agenda_search_local('sebast',0,1)")).length, 1);
    assert.equal((await asRole(db, 'authenticated', "select * from public.agenda_search_local('sebast',1,1)")).length, 1);
    assert.equal((await asRole(db, 'authenticated', "select * from public.agenda_search_local('%')")).length, 1);
    assert.equal((await asRole(db, 'authenticated', "select * from public.agenda_search_local('_')")).length, 1);
    await asRole(db, 'authenticated', "update agenda_eventos set titulo='Carlos',search_text='sebastian' where titulo='Sebastián'");
    assert.equal((await asRole(db, 'authenticated', "select * from public.agenda_search_local('sebastian oficina')")).length, 0);
    await db.exec("set app.active='no'");
    assert.equal((await asRole(db, 'authenticated', "select * from public.agenda_search_local('sebast')")).length, 0);
    await assert.rejects(asRole(db, 'anon', "select * from public.agenda_search_local('sebast')"), /permission denied/);
  } finally { await db.close(); }
});

test('Google sync commits changes/tokens atomically, applies deletions and fences concurrent workers', async () => {
  const db = await fixture();
  try {
    const first = await claim(db); assert.ok(first.lease); assert.equal(first.token, null);
    const busy = await claim(db); assert.equal(busy.lease, null); assert.equal(busy.ready, false);
    await commit(db, first.lease, 'token-1', [raw('one', 'Sebastián'), raw('two', 'Sebastián viejo')], true);
    assert.equal((await claim(db)).ready, true);
    await asRole(db, 'service_role', "update agenda_google_search_state set synced_at=now()-interval '25 seconds'");
    const background = await claim(db); assert.ok(background.lease, 'Background refresh starts before read authorization expires at 30 seconds');
    await asRole(db, 'service_role', 'select public.agenda_search_release($1,$2,$3)', [revision, 'office', background.lease]);
    assert.equal((await search(db, 'sebast')).length, 2);
    await asRole(db, 'service_role', 'select public.agenda_search_invalidate($1,$2)', [revision, 'office']);
    const next = await claim(db); assert.equal(next.token, 'token-1');
    await assert.rejects(commit(db, other, 'wrong', [raw('leak', 'Sebastián')]), /lease expired/);
    await commit(db, next.lease, 'token-2', [raw('one', 'Carlos'), { id: 'two', status: 'cancelled' }, raw('three', 'Sebastián nuevo')]);
    const matches = await search(db, 'sebastian'); assert.equal(matches.length, 1); assert.equal(matches[0].payload.id, 'three');
    await assert.rejects(commit(db, first.lease, 'old-token', [raw('one', 'Sebastián')]), /lease expired/);
    assert.equal((await search(db, 'sebastian')).length, 1);
    // A write arriving during a sync must not be marked fresh by that older worker.
    await asRole(db, 'service_role', 'select public.agenda_search_invalidate($1,$2)', [revision, 'office']);
    const racing = await claim(db);
    await asRole(db, 'service_role', 'select public.agenda_search_invalidate($1,$2)', [revision, 'office']);
    await commit(db, racing.lease, 'token-3', []);
    assert.ok((await claim(db)).lease, 'Concurrent invalidation requires another incremental sync');
  } finally { await db.close(); }
});

test('Google index is server-only and role/revision changes cannot expose an old document', async () => {
  const db = await fixture();
  try {
    const first = await claim(db); await commit(db, first.lease, 'token-1', [raw('private', 'Sebastián privado')], true);
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(asRole(db, role, 'select * from public.agenda_google_search_documents'), /permission denied/);
      await assert.rejects(asRole(db, role, 'select * from public.agenda_google_search_state'), /permission denied/);
      await assert.rejects(asRole(db, role, "select public.agenda_search_claim($1,'office','reader','Oficina')", [revision]), /permission denied/);
      await assert.rejects(asRole(db, role, "select * from public.agenda_search_google($1,'[]','sebast')", [revision]), /permission denied/);
    }
    assert.equal((await search(db, 'sebast', 'reader')).length, 0);
    const downgraded = await claim(db, 'reader'); assert.equal(downgraded.token, null);
    await commit(db, downgraded.lease, 'reader-token', [], true, 'reader');
    assert.equal((await search(db, 'sebast', 'reader')).length, 0);
    await db.query('update public.google_calendar_connection set revision=$1', [other]);
    assert.equal((await db.query('select * from public.agenda_google_search_state')).rows.length, 0);
    await assert.rejects(commit(db, downgraded.lease, 'stale', [raw('leak', 'Sebastián')], true), /selection changed/);
  } finally { await db.close(); }
});

test('selective lookups use the trigram index instead of transferring the full history', async () => {
  const db = await fixture();
  try {
    await db.exec("insert into agenda_eventos(titulo) select 'Visita de instalación ' || n from generate_series(1,20000) n; insert into agenda_eventos(titulo) values('Reunión Sebastián'); analyze agenda_eventos;");
    const plan = (await db.query("explain (format json) select id from agenda_eventos where search_text like '%sebastian%'" )).rows[0]['QUERY PLAN'];
    assert.match(JSON.stringify(plan), /agenda_eventos_search_idx/);
    assert.equal((await db.query("select * from agenda_search_local('sebastian')")).rows.length, 1);
  } finally { await db.close(); }
});
