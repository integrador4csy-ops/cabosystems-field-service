import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const migration = readFileSync(new URL('../../supabase/migrations/20261023234734_villa_task_templates.sql', import.meta.url), 'utf8');
const stages = JSON.parse(readFileSync(new URL('../../supabase/seeds/villa-task-template.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../src/lib/taskTemplates.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { validTaskTemplate, templateSelectionCounts } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const admin = 'a1000000-0000-0000-0000-000000000001', staff = 'a1000000-0000-0000-0000-000000000002', inactive = 'a1000000-0000-0000-0000-000000000003';
const villa = 'b1000000-0000-0000-0000-000000000001', other = 'b1000000-0000-0000-0000-000000000002';

async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('app.user',true),'')::uuid$$;
    grant usage on schema auth,private,public to authenticated,anon;
    create table public.profiles(id uuid primary key,activo boolean,rol text);
    insert into public.profiles values('${admin}',true,'admin'),('${staff}',true,'instalador'),('${inactive}',false,'admin');
    create table public.proyectos(id uuid primary key,allowed_user uuid);
    insert into public.proyectos values('${villa}','${staff}'),('${other}',null);
    create function private.project_admin() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.profiles where id=auth.uid() and activo and rol='admin') $$;
    create function private.project_visible(id uuid) returns boolean language sql stable security definer set search_path='' as $$ select private.project_admin() or exists(select 1 from public.proyectos p join public.profiles u on u.id=auth.uid() where p.id=$1 and p.allowed_user=u.id and u.activo) $$;
    create table public.tareas(id uuid primary key default gen_random_uuid(),proyecto_id uuid references public.proyectos(id) on delete cascade,titulo text not null,estatus text default 'pendiente',asignado_a uuid,fecha_programada date,created_at timestamptz default now());
    create table public.subtareas(id uuid primary key default gen_random_uuid(),tarea_id uuid references public.tareas(id) on delete cascade,titulo text not null,completada boolean default false,created_at timestamptz default now());
    alter table public.proyectos enable row level security; alter table public.tareas enable row level security; alter table public.subtareas enable row level security;
    grant select,insert,update,delete on public.proyectos,public.tareas,public.subtareas to authenticated;
    create policy projects_read on public.proyectos for select to authenticated using(private.project_visible(id));
    create policy projects_admin on public.proyectos for all to authenticated using(private.project_admin()) with check(private.project_admin());
    create policy tasks_read on public.tareas for select to authenticated using(private.project_visible(proyecto_id));
    create policy tasks_admin on public.tareas for all to authenticated using(private.project_admin()) with check(private.project_admin());
    create policy subtasks_read on public.subtareas for select to authenticated using(exists(select 1 from public.tareas t where t.id=tarea_id));
    create policy subtasks_admin on public.subtareas for all to authenticated using(private.project_admin()) with check(private.project_admin());`);
  await db.exec(migration);
  return db;
}
async function run(db, query, params = [], user = admin, role = 'authenticated') {
  await db.exec(`begin; set local role ${role};`);
  try {
    await db.query("select set_config('app.user',$1,true)", [user]);
    const result = await db.query(query, params); await db.exec('commit'); return result.rows;
  } catch (error) { await db.exec('rollback'); throw error; }
}
async function apply(db, project = villa, numbers = stages.map(stage => stage.number), version = 1, user = admin) {
  return (await run(db, 'select public.apply_project_task_template($1,$2,$3,$4) result', [project, 'csy-general', version, numbers], user))[0].result;
}
async function totals(db) { return (await db.query('select (select count(*)::int from tareas) tasks,(select count(*)::int from subtareas) subtasks,(select count(*)::int from project_task_template_applications) applications')).rows[0]; }

test('canonical company template contains all 16 stages and 78 numbered subtasks', () => {
  assert.deepEqual(stages.map(stage => stage.number), Array.from({ length: 16 }, (_, i) => i + 1));
  assert.deepEqual(templateSelectionCounts(stages, stages.map(stage => stage.number)), { tasks: 16, subtasks: 78 });
  assert.deepEqual(templateSelectionCounts(stages, [7, 9, 10, 12, 16]), { tasks: 5, subtasks: 0 });
  assert.equal(stages[1].subtasks[2], 'Levantamiento en sitio y/o planos');
  assert.equal(stages[3].subtasks[5], 'Asignación de responsables de instalación e integración');
  assert.ok(validTaskTemplate({ nombre: 'CSY', etapas: stages }));
  assert.equal(validTaskTemplate({ nombre: 'CSY', etapas: [stages[0], stages[0]] }), false);
});

test('application copies a complete independent checklist and retry cannot duplicate it', async () => {
  const db = await fixture();
  try {
    const seeded = (await db.query('select etapas from project_task_templates')).rows[0].etapas;
    assert.deepEqual(seeded, stages);
    assert.deepEqual(await totals(db), { tasks: 0, subtasks: 0, applications: 0 });
    assert.deepEqual(await apply(db), { alreadyApplied: false, tasks: 16, subtasks: 78 });
    const tasks = await run(db, 'select * from tareas order by orden_plantilla');
    assert.equal(tasks[0].titulo, '1. Contacto con el cliente');
    assert.equal(tasks[15].titulo, '16. Pendientes y notas');
    assert.ok(tasks.every(task => task.estatus === 'pendiente' && task.asignado_a === null && task.fecha_programada === null));
    assert.equal((await run(db, "select titulo from subtareas where titulo like '4.6 %'"))[0].titulo, '4.6 Asignación de responsables de instalación e integración');
    assert.deepEqual(await apply(db), { alreadyApplied: true, tasks: 16, subtasks: 78 });
    assert.deepEqual(await totals(db), { tasks: 16, subtasks: 78, applications: 1 });
    await assert.rejects(run(db, 'insert into project_task_template_applications select gen_random_uuid(),proyecto_id,plantilla_id,version,contenido,tareas_creadas,subtareas_creadas,created_by,created_at from project_task_template_applications'), /duplicate key/);
  } finally { await db.close(); }
});

test('partial selection preserves manual tasks and later template edits never rewrite a villa', async () => {
  const db = await fixture();
  try {
    await run(db, "insert into tareas(proyecto_id,titulo) values($1,'Tarea existente')", [villa]);
    assert.deepEqual(await apply(db, villa, [1, 7]), { alreadyApplied: false, tasks: 2, subtasks: 2 });
    await run(db, "update subtareas set completada=true where titulo like '1.1 %'");
    const edited = structuredClone(stages); edited[0].title = 'Nuevo contacto'; edited[0].subtasks[0] = 'Nueva instrucción';
    await run(db, "update project_task_templates set etapas=$1 where id='csy-general' and version=1", [JSON.stringify(edited)]);
    assert.equal((await run(db, 'select version from project_task_templates'))[0].version, 2);
    assert.deepEqual(await apply(db, other, [1], 2), { alreadyApplied: false, tasks: 1, subtasks: 2 });
    assert.equal((await run(db, "select count(*)::int n from tareas where proyecto_id=$1 and titulo='1. Contacto con el cliente'", [villa]))[0].n, 1);
    assert.equal((await run(db, "select completada from subtareas where titulo='1.1 Contacto con el cliente'"))[0].completada, true);
    assert.equal((await run(db, "select contenido from project_task_template_applications where proyecto_id=$1", [villa]))[0].contenido[0].title, stages[0].title);
    assert.equal((await run(db, "select count(*)::int n from tareas where titulo='Tarea existente'"))[0].n, 1);
    assert.deepEqual(await apply(db, villa, [1], 2), { alreadyApplied: true, tasks: 2, subtasks: 2 });
    assert.equal((await run(db, 'select count(*)::int n from project_task_template_applications', [], staff))[0].n, 1);
  } finally { await db.close(); }
});

test('permissions, version conflicts and invalid selections fail without writing tasks', async () => {
  const db = await fixture();
  try {
    await assert.rejects(run(db, "select apply_project_task_template($1,'csy-general',1,array[1])", [villa], '', 'anon'), /permission denied/);
    await assert.rejects(apply(db, villa, [1], 1, staff), /Solo administradores/);
    await assert.rejects(apply(db, villa, [1], 1, inactive), /Solo administradores/);
    await assert.rejects(apply(db, villa, [1], 99), /plantilla cambio/);
    for (const selection of [[], [1, 1], [99], [null]]) await assert.rejects(apply(db, villa, selection), /Seleccion de etapas invalida/);
    await assert.rejects(apply(db, 'b1000000-0000-0000-0000-000000000099', [1]), /Villa no disponible/);
    await assert.rejects(run(db, "update project_task_templates set etapas='[{}]'"), /Etapa invalida/);
    await assert.rejects(run(db, "insert into project_task_template_applications(proyecto_id,plantilla_id,version,contenido,tareas_creadas,subtareas_creadas) values($1,'csy-general',1,'[]',0,0)", [villa], staff), /row-level security/);
    assert.deepEqual(await totals(db), { tasks: 0, subtasks: 0, applications: 0 });
    assert.equal((await run(db, 'select version from project_task_templates'))[0].version, 1);
  } finally { await db.close(); }
});

test('a failing subtask rolls back both task creation and the application marker', async () => {
  const db = await fixture();
  try {
    await db.exec(`create function private.fail_test_step() returns trigger language plpgsql as $$begin if new.titulo like '2.1 %' then raise exception 'test failure'; end if; return new; end$$;
      create trigger fail_step before insert on subtareas for each row execute function private.fail_test_step();`);
    await assert.rejects(apply(db), /test failure/);
    assert.deepEqual(await totals(db), { tasks: 0, subtasks: 0, applications: 0 });
  } finally { await db.close(); }
});
