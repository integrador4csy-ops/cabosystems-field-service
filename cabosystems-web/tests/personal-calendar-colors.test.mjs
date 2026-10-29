import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
for (const file of ['../src/lib/calendarColorPreferences.ts', '../../cabosystems-mobile/lib/calendarColorPreferences.ts']) test(file + ' scopes saves and resets to the account and reports errors', async () => {
  const calls = []; let result = { data: [], error: null };
  const query = {
    select(...args) { calls.push(['select', ...args]); return this; },
    eq(...args) { calls.push(['eq', ...args]); return this; }, order() { return this; },
    range() { return Promise.resolve(result); }, single() { return Promise.resolve(result); },
    then(resolve) { return Promise.resolve(result).then(resolve); },
    delete() { calls.push(['delete']); return this; },
    upsert(...args) { calls.push(['upsert', ...args]); return this; },
  };
  const mock = { from(table) { assert.equal(table, 'agenda_calendar_colors'); return query; } };
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  new Function('require', 'exports', source)(() => ({ supabase: mock }), exports);
  await exports.saveCalendarColor('user-a', 'calendar', '#ABCDEF');
  assert.deepEqual(calls.find(c => c[0] === 'upsert'), ['upsert', { user_id: 'user-a', calendar_id: 'calendar', color: '#abcdef' }, { onConflict: 'user_id,calendar_id' }]);
  calls.length = 0; await exports.saveCalendarColor('user-b', 'calendar', null);
  assert.deepEqual(calls, [['delete'], ['eq', 'user_id', 'user-b'], ['eq', 'calendar_id', 'calendar']]);
  calls.length = 0; result = { data: [{ calendar_id: 'calendar', color: '#123456' }], error: null };
  assert.deepEqual(await exports.getCalendarColors('user-a'), { calendar: '#123456' });
  assert.ok(calls.some(c => c[0] === 'eq' && c[1] === 'user_id' && c[2] === 'user-a'));
  calls.length = 0; await assert.rejects(exports.saveCalendarColor('user-a', 'calendar', 'red')); assert.equal(calls.length, 0);
  result = { data: null, error: new Error('denied') };
  await assert.rejects(exports.saveCalendarColor('user-a', 'calendar', '#ffffff'), /denied/);
  await assert.rejects(exports.getCalendarColors('user-a'), /denied/);
});
const migration = readFileSync(new URL('../../supabase/migrations/20261027235709_personal_calendar_colors.sql', import.meta.url), 'utf8');
const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002';
test('personal color RLS isolates accounts and validates writes', async () => {
 const db = new PGlite();
 try {
 await db.exec(`create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 create table public.profiles(id uuid primary key, activo boolean);
 grant select on public.profiles to authenticated;
 insert into public.profiles values ('${a}',true),('${b}',true);`);
 await db.exec(migration);
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`);
 await db.query('insert into agenda_calendar_colors values ($1,$2,$3)',[a,'shared-calendar','#ff0000']);
 await assert.rejects(db.query('insert into agenda_calendar_colors values ($1,$2,$3)',[b,'other','#00ff00']),/row-level security/);
 for (const [id,color] of [['','#ffffff'],['x'.repeat(1025),'#ffffff'],['invalid','red']]) await assert.rejects(db.query('insert into agenda_calendar_colors values ($1,$2,$3)',[a,id,color]),/check constraint/);
 await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
 assert.equal((await db.query('select * from agenda_calendar_colors')).rows.length,0);
 await db.query('insert into agenda_calendar_colors values ($1,$2,$3)',[b,'shared-calendar','#0000ff']);
 assert.equal((await db.query('update agenda_calendar_colors set color=$1 where user_id=$2 returning *',['#ffffff',a])).rows.length,0);
 assert.equal((await db.query('delete from agenda_calendar_colors where user_id=$1 returning *',[a])).rows.length,0);
 assert.equal((await db.query('select color from agenda_calendar_colors')).rows[0].color,'#0000ff');
 await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
 assert.equal((await db.query('select color from agenda_calendar_colors')).rows[0].color,'#ff0000');
 await db.query('delete from agenda_calendar_colors where user_id=$1',[a]);
 assert.equal((await db.query('select * from agenda_calendar_colors')).rows.length,0);
 await db.exec(`reset role; update profiles set activo=false where id='${b}'; set role authenticated; select set_config('request.jwt.claim.sub','${b}',false);`);
 assert.equal((await db.query('select * from agenda_calendar_colors')).rows.length,0);
 await assert.rejects(db.query('insert into agenda_calendar_colors values ($1,$2,$3)',[b,'other','#ffffff']),/row-level security/);
 await db.exec('reset role; set role anon');
 await assert.rejects(db.query('select * from agenda_calendar_colors'),/permission denied/);
 } finally {await db.close();}
});
for (const file of ['../src/lib/agendaPresentation.ts','../../cabosystems-mobile/lib/companyAgendaPresentation.ts']) test(file+' applies personal colors without mutating events',async()=>{
 const source=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
 const {calendarAppearance,calendarTextColor}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 assert.equal(calendarTextColor('invalid'),'#FFFFFF');
 const event=Object.freeze({google:Object.freeze({calendarColor:'#ff0000'})});
 assert.equal(calendarAppearance(event,'#0000ff').backgroundColor,'#0000ff');
 assert.equal(event.google.calendarColor,'#ff0000');
 assert.equal(calendarAppearance({},'#ffffff').color,'#000000');
 assert.equal(calendarAppearance({},'#000000').color,'#FFFFFF');
 for (const color of ['#f78c26', '#ff8c1a', '#a47ae2', '#f6bf26', '#777777', '#343e48', '#8e24aa', '#0000ff', '#747474']) {
  assert.equal(calendarAppearance({},color).color,'#FFFFFF',color);
  assert.equal(calendarAppearance({google:{calendarColor:color}}).color,'#FFFFFF',color);
 }
 for (const color of ['#ffff00', '#9fe1e7', '#f5f5f5', '#ffffff', '#e0e0e0', '#fff4df']) {
  assert.equal(calendarAppearance({},color).color,'#000000',color);
  assert.equal(calendarAppearance({google:{calendarColor:color}}).color,'#000000',color);
 }
 assert.equal(calendarAppearance({}),undefined);
});
