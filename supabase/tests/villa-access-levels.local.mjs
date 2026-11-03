import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const require = createRequire(new URL('../../cabosystems-web/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');
const db = new PGlite();

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_user::text $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid(),auth.role() to anon,authenticated;
    create schema storage;
    create table storage.buckets(id text primary key,name text not null,public boolean not null default false,
      file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id bigint generated always as identity primary key,bucket_id text not null,
      name text not null,owner_id uuid);
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
  `);

  await db.exec(readFileSync(new URL('../migrations/001_initial_schema.sql', import.meta.url), 'utf8'));
  await db.exec(`
    alter table public.proyectos rename column unidad to villa;
    alter table public.tareas alter column asignado_a drop not null;
    alter table public.profiles add column avatar_url text;
    grant select,insert,update,delete on all tables in schema public to authenticated,anon;
    grant execute on function public.get_my_role() to authenticated,anon;
  `);

  await db.exec(readFileSync(new URL('../migrations/20261015215504_project_hierarchy_and_access.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261015220443_harden_legacy_profile_access.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261014190102_task_scheduled_date.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261028184222_villa_task_progress.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261028185402_task_assignee_informational.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261028190342_task_progress_all_access_scopes.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261029220523_task_activity_reports.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261102120000_task_visibility_and_priority.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261102153000_task_progress_comments_and_evidence.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261102230000_villa_participant_access_levels.sql', import.meta.url), 'utf8'));

  const uid = (n) => 'c3000000-0000-0000-0000-' + String(n).padStart(12, '0');
  const adminId = uid(1);
  const supervisorId = uid(2);
  const techMyTasks = uid(3);
  const techAllTasks = uid(4);
  const techOther = uid(5);

  for (const [id, name, rol] of [
    [adminId, 'Admin User', 'admin'],
    [supervisorId, 'Supervisor User', 'supervisor_instalacion'],
    [techMyTasks, 'Tech Restricted', 'instalador'],
    [techAllTasks, 'Tech Full Villa', 'instalador'],
    [techOther, 'Tech Outsider', 'instalador'],
  ]) {
    await db.query('insert into auth.users(id, email) values($1, $2)', [id, `${rol}@test.invalid`]);
    await db.query('insert into public.profiles(id, nombre, rol, activo) values($1, $2, $3, true)', [id, name, rol]);
  }

  const devId = 'd3000000-0000-0000-0000-000000000001';
  await db.query('insert into desarrollos(id, nombre) values($1, $2)', [devId, 'Cabo del Sol']);

  const villaId = 'e3000000-0000-0000-0000-000000000001';
  await db.query('insert into proyectos(id, desarrollo_id, desarrollo, villa, equipo_revision) values($1, $2, $3, $4, 0)', [
    villaId, devId, 'Cabo del Sol', 'Villa 01'
  ]);

  const task1 = 'a3000000-0000-0000-0000-000000000001';
  const task2 = 'a3000000-0000-0000-0000-000000000002';
  await db.query('insert into tareas(id, proyecto_id, asignado_a, titulo) values($1, $2, $3, $4)', [
    task1, villaId, techMyTasks, 'Tarea de Tech Restricted'
  ]);
  await db.query('insert into tareas(id, proyecto_id, asignado_a, titulo) values($1, $2, $3, $4)', [
    task2, villaId, techAllTasks, 'Tarea de Tech Full Villa'
  ]);

  const login = async (id) => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [id]);
    await db.exec('set role authenticated');
  };

  // Test 1: save_project_team with 'mis_tareas' vs 'todas_las_tareas'
  await login(adminId);
  await db.query(`select public.save_project_team($1, null, null, array[$2, $3]::uuid[], 0, array[$3]::uuid[])`, [
    villaId, techMyTasks, techAllTasks
  ]);

  const members = (await db.query('select usuario_id, tipo_acceso from proyecto_participantes order by usuario_id')).rows;
  assert.deepEqual(members, [
    { usuario_id: techMyTasks, tipo_acceso: 'mis_tareas' },
    { usuario_id: techAllTasks, tipo_acceso: 'todas_las_tareas' },
  ]);
  console.log('PASS: save_project_team correctly assigns mis_tareas and todas_las_tareas');

  // Test 2: Tech Restricted (mis_tareas) can only see task1 (their assigned task), NOT task2
  await login(techMyTasks);
  const techTasks = (await db.query('select id from tareas order by id')).rows.map((r) => r.id);
  assert.deepEqual(techTasks, [task1]);
  console.log('PASS: user with mis_tareas sees ONLY their assigned task in the villa');

  // Test 3: Tech Full Villa (todas_las_tareas) sees BOTH task1 and task2 in the villa
  await login(techAllTasks);
  const allTasks = (await db.query('select id from tareas order by id')).rows.map((r) => r.id);
  assert.deepEqual(allTasks, [task1, task2]);
  console.log('PASS: user with todas_las_tareas sees ALL tasks of that villa');

  // Test 4: Supervisor de instalacion has global access and sees all tasks everywhere
  await login(supervisorId);
  const supTasks = (await db.query('select id from tareas order by id')).rows.map((r) => r.id);
  assert.deepEqual(supTasks, [task1, task2]);
  console.log('PASS: supervisor_instalacion has global access and sees all tasks');

  // Test 5: Admin has global access and sees all tasks everywhere
  await login(adminId);
  const admTasks = (await db.query('select id from tareas order by id')).rows.map((r) => r.id);
  assert.deepEqual(admTasks, [task1, task2]);
  console.log('PASS: admin has global access and sees all tasks');

  // Test 6: Tech Outsider (not participant, not assigned) sees 0 tasks
  await login(techOther);
  const outsiderTasks = (await db.query('select id from tareas order by id')).rows.map((r) => r.id);
  assert.deepEqual(outsiderTasks, []);
  console.log('PASS: outsider sees 0 tasks');

  console.log('ALL VILLA ACCESS LEVELS DB TESTS PASSED!');
} finally {
  await db.close();
}
