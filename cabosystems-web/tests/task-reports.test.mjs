import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
import vm from 'node:vm';

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const logic = await import(`data:text/javascript;base64,${Buffer.from(compile('../src/lib/taskReports.ts')).toString('base64')}`);
const migration = readFileSync(new URL('../../supabase/migrations/20261029220523_task_activity_reports.sql', import.meta.url), 'utf8');
const uid = number => `a1000000-0000-0000-0000-${String(number).padStart(12, '0')}`;

test('report transport includes all pages, fixes the upper ID and rejects partial downloads or cancelled requests', async () => {
  const calls = [];
  let fail = false;
  const module = { exports: {} };
  const source = ts.transpileModule(readFileSync(new URL('../src/lib/taskReportsApi.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports: module.exports, module, require(name) {
    if (name === './taskReports') return logic;
    if (name === './supabase') return { supabase: { rpc(name, params) { calls.push(params); return { async abortSignal() {
      if (params.p_after && fail) return { error: new Error('network') };
      const start = params.p_after || 0, count = start ? 3 : 500;
      return { data: Array.from({ length: count }, (_, index) => ({ id: start + index + 1, hasta_id: 503 })) };
    } }; } } };
    throw Error(name);
  } });
  const fetch = signal => module.exports.getTaskReport('2026-10-01', '2026-10-31', uid(1), uid(2), signal);
  const rows = await fetch(new AbortController().signal);
  assert.equal(rows.length, 503); assert.equal(calls[1].p_after, 500); assert.equal(calls[1].p_until, 503);
  assert.equal(calls[0].p_actor, uid(1)); assert.equal(calls[0].p_project, uid(2));
  fail = true; await assert.rejects(fetch(new AbortController().signal), /network/);
  const request = new AbortController(); request.abort(); const count = calls.length;
  await assert.rejects(fetch(request.signal), /abort/i); assert.equal(calls.length, count);
  await assert.rejects(module.exports.getTaskReport('2026-11-01', '2026-10-01', '', '', new AbortController().signal), /Periodo/);
});

test('daily, Monday-to-Sunday weekly and monthly ranges use calendar dates and Los Cabos today', () => {
  assert.deepEqual(logic.reportRange('week', '2026-11-01'), { from: '2026-10-26', to: '2026-11-01' });
  assert.deepEqual(logic.reportRange('month', '2028-02-22'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(logic.reportRange('day', '2026-12-31'), { from: '2026-12-31', to: '2026-12-31' });
  assert.equal(logic.reportToday(new Date('2026-10-29T02:00:00Z')), '2026-10-28');
  for (const date of ['2026-02-30', '', '2026-13-01', '2026-1-1']) assert.equal(logic.validReportDate(date), false);
});

test('person sections group by identity, retain name changes and order actions by date', () => {
  const rows = [
    { actor_id: uid(1), actor_name: 'Anterior', id: 1, fecha: '2026-10-29' },
    { actor_id: uid(2), actor_name: 'Mismo nombre', id: 2, fecha: '2026-10-28' },
    { actor_id: uid(1), actor_name: 'Mismo nombre', id: 3, fecha: '2026-10-30' },
    { actor_id: uid(1), actor_name: 'Anterior', id: 0, fecha: '2026-10-27' },
  ];
  const groups = logic.reportPeople(rows);
  assert.equal(groups.length, 2, 'Two people sharing a name never merge');
  const first = groups.find(group => group.id === uid(1));
  assert.equal(first.name, 'Mismo nombre');
  assert.deepEqual(first.rows.map(row => row.id), [0, 1, 3]);
  assert.equal(rows[0].id, 1, 'Grouping does not reorder the original report');
});

test('database records the real actor and server date, preserves history, filters and protects reports', async () => {
  const db = new PGlite();
  const actor = uid(1), assigned = uid(2), outsider = uid(3), admin = uid(4), villa = uid(10), other = uid(11), task = uid(20), sub = uid(30);
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user',true),'')::uuid$$;
      grant usage on schema auth,private,public to authenticated,anon;
      create table profiles(id uuid primary key,nombre text,activo boolean,rol text);
      create table proyectos(id uuid primary key,desarrollo text,villa text,allowed_user uuid);
      create table tareas(id uuid primary key,proyecto_id uuid,titulo text,estatus text,asignado_a uuid);
      create table subtareas(id uuid primary key,tarea_id uuid,titulo text,completada boolean);
      insert into profiles values('${actor}','Persona real',true,'instalador'),('${assigned}','Encargado distinto',true,'instalador'),('${outsider}','Sin acceso',true,'instalador'),('${admin}','Admin',true,'admin');
      insert into proyectos values('${villa}','Cabo del Sol','Villa 01','${actor}'),('${other}','Otro desarrollo','Villa 02',null);
      create function private.project_visible(project uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles u join public.proyectos p on p.id=project where u.id=auth.uid() and u.activo and (u.rol='admin' or p.allowed_user=u.id)) $$;
      create function private.task_progress_member(project uuid) returns boolean language sql stable as $$select private.project_visible(project)$$;
      alter table tareas enable row level security;
      create policy tasks_visible on tareas for all to authenticated using(private.project_visible(proyecto_id)) with check(private.project_visible(proyecto_id));
      alter table subtareas enable row level security;
      create policy subtasks_visible on subtareas for all to authenticated using(exists(select 1 from tareas where id=tarea_id)) with check(exists(select 1 from tareas where id=tarea_id));
      grant select,insert,update,delete on tareas,subtareas to authenticated;
      insert into tareas values('${task}','${villa}','Tarea original','pendiente','${assigned}');
      insert into subtareas values('${sub}','${task}','Paso original',false);`);
    await db.exec(migration);
    const login = async id => { await db.exec('reset role'); await db.query("select set_config('app.user',$1,false)", [id]); await db.exec('set role authenticated'); };
    await login(actor);
    await db.query('update tareas set estatus=$1 where id=$2', ['en_proceso', task]);
    await db.query('update subtareas set completada=true where id=$1', [sub]);
    await db.query('update subtareas set completada=true where id=$1', [sub]);
    let history = (await db.query('select * from task_activity order by id')).rows;
    assert.equal(history.length, 2, 'Repeated no-op writes do not create activity');
    assert.ok(history.every(row => row.actor_id === actor && row.actor_name === 'Persona real' && row.encargado_nombre === 'Encargado distinto'));
    const today = (await db.query("select (statement_timestamp() at time zone 'America/Mazatlan')::date::text as date")).rows[0].date;
    assert.ok(history.every(row => row.fecha.toISOString().slice(0, 10) === today));
    await db.exec('begin'); await db.query('update subtareas set completada=false where id=$1', [sub]); await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int as count from task_activity')).rows[0].count, 2, 'History is in the same transaction');
    await assert.rejects(db.exec("insert into task_activity(fecha) values(current_date)"), /permission denied/);
    await assert.rejects(db.exec("update task_activity set actor_name='Falso'"), /permission denied/);
    await assert.rejects(db.exec('delete from task_activity'), /permission denied/);
    await db.query('update subtareas set completada=false where id=$1', [sub]);
    await db.query('update tareas set titulo=$1 where id=$2', ['Nombre cambiado', task]);
    history = (await db.query('select * from task_activity order by id')).rows;
    assert.equal(history.length, 3); assert.equal(history[2].siguiente, 'false');
    assert.ok(history.every(row => row.tarea_titulo === 'Tarea original'));
    const first = (await db.query('select * from get_task_activity_report($1,$1,$2,$3,0,null,1)', [today, actor, villa])).rows;
    assert.equal(first.length, 1); assert.equal(first[0].estado_actual, 'en_proceso');
    const until = first[0].hasta_id;
    await db.query('update tareas set estatus=$1 where id=$2', ['completada', task]);
    const next = (await db.query('select * from get_task_activity_report($1,$1,$2,$3,$4,$5,100)', [today, actor, villa, first[0].id, until])).rows;
    assert.equal(next.length, 2, 'Pagination excludes actions appended after the report snapshot');
    assert.equal((await db.query('select * from get_task_activity_report($1,$1,$2,null)', [today, assigned])).rows.length, 0, 'Assignment does not attribute activity');
    await login(outsider); assert.equal((await db.query('select * from task_activity')).rows.length, 0);
    assert.equal((await db.query('select * from get_task_activity_people()')).rows.length, 0);
    await login(admin); assert.equal((await db.query('select * from task_activity')).rows.length, 4);
    await db.query('delete from tareas where id=$1', [task]);
    const deleted = (await db.query('select * from get_task_activity_report($1,$1)', [today])).rows;
    assert.equal(deleted.length, 4); assert.equal(deleted[0].estado_actual, null);
    await db.exec('reset role'); await db.query('update profiles set activo=false where id=$1', [actor]);
    await login(actor); assert.equal((await db.query('select * from task_activity')).rows.length, 0);
    await db.exec('reset role; set role anon');
    await assert.rejects(db.query('select * from get_task_activity_report($1,$1)', [today]), /permission denied/);
  } finally { await db.close(); }
});

test('PDF and XLSX contain full activity, preserve literal spreadsheet strings and paginate long reports', async () => {
  const directory = new URL('./.task-report-test/', import.meta.url); mkdirSync(directory, { recursive: true });
  try {
    writeFileSync(new URL('taskReports.mjs', directory), compile('../src/lib/taskReports.ts'));
    writeFileSync(new URL('export.mjs', directory), compile('../src/lib/taskReportExport.ts').replace("'./taskReports'", "'./taskReports.mjs'"));
    const exports = await import(pathToFileURL(path.resolve(new URL('export.mjs', directory).pathname.replace(/^\/([A-Z]:)/, '$1'))).href);
    const row = { id: 1, fecha: '2026-10-29', actor_id: uid(1), actor_name: '=HYPERLINK("bad")', desarrollo: 'Cabo del Sol', villa: 'Villa 01', tarea_id: uid(2), tarea_titulo: 'Instalación y revisión de cámaras con título largo '.repeat(3), subtarea_id: uid(3), subtarea_titulo: 'Conexión de equipo', accion: 'subtarea', siguiente: 'true', estado_registrado: 'en_proceso', encargado_nombre: 'Encargado', estado_actual: 'completada' };
    const report = { from: '2026-10-01', to: '2026-10-31', person: 'Persona real', project: 'Villa 01', rows: Array.from({ length: 130 }, (_, index) => ({ ...row, id: index + 1 })) };
    const excel = await exports.taskReportExcel(report, false);
    const { default: ExcelJS } = await import('exceljs'); const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await excel.arrayBuffer());
    const sheet = workbook.getWorksheet('Actividad');
    assert.equal(sheet.rowCount, 131); assert.equal(sheet.getCell('B2').value, row.actor_name); assert.equal(sheet.getCell('B2').type, ExcelJS.ValueType.String);
    assert.equal(sheet.getCell('E2').value, row.tarea_titulo); assert.equal(sheet.getCell('I2').value, 'Completada');
    const pdf = await exports.taskReportPdf(report, false); const contents = Buffer.from(await pdf.arrayBuffer()).toString('latin1');
    assert.ok(contents.startsWith('%PDF-')); assert.ok(contents.includes('CaboSystems')); assert.ok((contents.match(/\/Type \/Page\b/g) || []).length > 1);
    const groupedReport = { ...report, rows: [...report.rows.map(item => ({ ...item, actor_name: 'Alpha Person' })), { ...row, id: 131, actor_id: uid(9), actor_name: 'Bravo Person' }] };
    const groupedPdf = Buffer.from(await (await exports.taskReportPdf(groupedReport, false)).arrayBuffer()).toString('latin1');
    const pages = [...groupedPdf.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(match => match[1]);
    assert.ok(pages.filter(page => page.includes('Alpha Person')).length > 1, 'Name repeats on continuation pages');
    assert.ok(pages.some(page => page.includes('Bravo Person')));
    assert.ok(pages.every(page => !(page.includes('Alpha Person') && page.includes('Bravo Person'))), 'Each person starts on a fresh page');
    assert.equal(logic.reportSummary(report.rows).tasks, 1); assert.equal(logic.reportSummary(report.rows).completed, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
