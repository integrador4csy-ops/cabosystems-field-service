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
    grant usage on schema storage to authenticated,anon;
    grant select,insert,delete on storage.objects to authenticated,anon;
  `);

  await db.exec(readFileSync(new URL('../migrations/001_initial_schema.sql', import.meta.url), 'utf8'));
  await db.exec(`
    alter table public.proyectos rename column unidad to villa;
    alter table public.tareas alter column asignado_a drop not null;
    alter table public.profiles add column avatar_url text;
    grant select,insert,update,delete on all tables in schema public to authenticated,anon;
    grant execute on function public.get_my_role() to authenticated,anon;
    create policy legacy_tasks_all on tareas for all using(true) with check(true);
    create policy legacy_subtasks_all on subtareas for all using(true) with check(true);
  `);

  let chatMigration = readFileSync(new URL('../migrations/003_chat_system.sql', import.meta.url), 'utf8');
  chatMigration = chatMigration.split('-- HABILITAR SUPABASE REALTIME')[0];
  await db.exec(chatMigration);
  await db.exec(readFileSync(new URL('../migrations/20261015215504_project_hierarchy_and_access.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261015220443_harden_legacy_profile_access.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261014190102_task_scheduled_date.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261028184222_villa_task_progress.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261028185402_task_assignee_informational.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261028190342_task_progress_all_access_scopes.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261029220523_task_activity_reports.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261102120000_task_visibility_and_priority.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261102153000_task_progress_comments_and_evidence.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261102180000_chat_villa_link.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261102210000_chat_task_activity_system_messages.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261102220000_chat_group_task_activity.sql', import.meta.url), 'utf8'));
  await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated;`);

  // Seed profiles and projects
  const adminId = '11111111-1111-4111-8111-111111111111';
  const supervisorId = '22222222-2222-4222-8222-222222222222';
  const memberId = '33333333-3333-4333-8333-333333333333';
  const outsiderId = '44444444-4444-4444-8444-444444444444';

  const projectAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const projectBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  await db.exec(`
    insert into auth.users (id, email) values
      ('${adminId}', 'admin@cabo.test'),
      ('${supervisorId}', 'super@cabo.test'),
      ('${memberId}', 'member@cabo.test'),
      ('${outsiderId}', 'outsider@cabo.test');

    insert into public.profiles (id, nombre, rol, activo) values
      ('${adminId}', 'Admin User', 'admin', true),
      ('${supervisorId}', 'Supervisor User', 'supervisor_instalacion', true),
      ('${memberId}', 'Chat Member', 'instalador', true),
      ('${outsiderId}', 'Outsider Tech', 'instalador', true);

    insert into public.proyectos (id, desarrollo, villa) values
      ('${projectAId}', 'Chileno Bay', 'Villa 101'),
      ('${projectBId}', 'El Dorado', 'Villa 202');
  `);

  // Groups:
  // groupA linked to projectA (memberId is a member)
  // groupGeneral (no villa)
  const groupAId = '90000000-0000-4000-8000-000000000001';
  const groupGenId = '90000000-0000-4000-8000-000000000002';

  await db.exec(`
    insert into public.chat_grupos (id, nombre, creado_por, proyecto_id) values
      ('${groupAId}', 'Chat Villa 101', '${adminId}', '${projectAId}'),
      ('${groupGenId}', 'Chat General', '${adminId}', null);

    insert into public.chat_miembros (grupo_id, profile_id, rol) values
      ('${groupAId}', '${memberId}', 'miembro'),
      ('${groupAId}', '${adminId}', 'admin'),
      ('${groupGenId}', '${memberId}', 'miembro');
  `);

  // Tasks in project A
  const task1Id = '55555555-5555-4555-8555-555555555551';
  const task2Id = '55555555-5555-4555-8555-555555555552';

  await db.exec(`
    insert into public.tareas (id, proyecto_id, titulo, estatus, asignado_a, prioridad) values
      ('${task1Id}', '${projectAId}', 'Levantamiento de red', 'completada', '${memberId}', 'alta'),
      ('${task2Id}', '${projectAId}', 'Instalación de Rack', 'en_proceso', '${memberId}', 'media');

    -- Insert mock task activity entries for project A
    insert into public.task_activity (
      fecha, actor_id, actor_name, proyecto_id, desarrollo, villa,
      tarea_id, tarea_titulo, subtarea_id, subtarea_titulo,
      accion, anterior, siguiente, estado_registrado, request_id, comentario, evidencia_path,
      captured_at, accepted_at
    ) values
      ('2026-11-02', '${memberId}', 'Chat Member', '${projectAId}', 'Chileno Bay', 'Villa 101',
       '${task1Id}', 'Levantamiento de red', null, null,
       'estado', 'pendiente', 'completada', 'completada', gen_random_uuid(), 'Todo revisado y aprobado.', null,
       now() - interval '2 hours', now() - interval '2 hours'),
      ('2026-11-02', '${memberId}', 'Chat Member', '${projectAId}', 'Chileno Bay', 'Villa 101',
       '${task2Id}', 'Instalación de Rack', null, null,
       'estado', 'pendiente', 'en_proceso', 'en_proceso', gen_random_uuid(), 'Iniciando montaje.', null,
       now() - interval '1 hour', now() - interval '1 hour');
  `);

  const setAuth = async (userId) => {
    await db.exec(`
      set local role to authenticated;
      select set_config('request.jwt.claim.sub', '${userId}', true);
      select set_config('request.jwt.claim.role', 'authenticated', true);
    `);
  };

  // TEST 1: Member calls get_chat_group_task_activity
  await db.exec('begin;');
  await setAuth(memberId);
  const rows = (await db.query(`select * from public.get_chat_group_task_activity('${groupAId}'::uuid, 10, 0);`)).rows;
  await db.exec('commit;');

  assert.equal(rows.length, 2, 'Should return 2 task activities for Villa 101');
  assert.equal(rows[0].tarea_titulo, 'Instalación de Rack', 'First item should be newest (Instalación de Rack)');
  assert.equal(rows[1].tarea_titulo, 'Levantamiento de red', 'Second item should be older (Levantamiento de red)');
  assert.equal(rows[0].comentario, 'Iniciando montaje.');
  console.log('PASS: group member queries villa task activity ordered newest first');

  // TEST 2: Pagination with limit and offset
  await db.exec('begin;');
  await setAuth(memberId);
  const paged1 = (await db.query(`select * from public.get_chat_group_task_activity('${groupAId}'::uuid, 1, 0);`)).rows;
  const paged2 = (await db.query(`select * from public.get_chat_group_task_activity('${groupAId}'::uuid, 1, 1);`)).rows;
  await db.exec('commit;');

  assert.equal(paged1.length, 1);
  assert.equal(paged1[0].tarea_titulo, 'Instalación de Rack');
  assert.equal(paged2.length, 1);
  assert.equal(paged2[0].tarea_titulo, 'Levantamiento de red');
  console.log('PASS: pagination with limit and offset works correctly');

  // TEST 3: Outsider (not in group) gets 0 rows
  await db.exec('begin;');
  await setAuth(outsiderId);
  const outsiderRows = (await db.query(`select * from public.get_chat_group_task_activity('${groupAId}'::uuid, 10, 0);`)).rows;
  await db.exec('commit;');

  assert.equal(outsiderRows.length, 0, 'Outsider should receive 0 rows');
  console.log('PASS: outsider cannot query task activity of a group they are not member of');

  // TEST 4: General group without villa gets 0 rows
  await db.exec('begin;');
  await setAuth(memberId);
  const generalRows = (await db.query(`select * from public.get_chat_group_task_activity('${groupGenId}'::uuid, 10, 0);`)).rows;
  await db.exec('commit;');

  assert.equal(generalRows.length, 0, 'General chat without villa returns 0 rows');
  console.log('PASS: general chat without linked villa returns empty task activity');

  // TEST 5: Evidence access for group members vs outsiders
  const reqId = '88888888-8888-4888-8888-888888888888';
  const testEvidencePath = `${projectAId}/${task1Id}/${memberId}/${reqId}.jpg`;

  await db.exec('begin;');
  await setAuth(memberId);
  const memberEvidence = (await db.query(`select private.task_evidence_access('${testEvidencePath}', false) as allowed;`)).rows[0].allowed;
  await db.exec('commit;');
  assert.equal(memberEvidence, true, 'Chat group member should have read access to evidence for linked villa');

  await db.exec('begin;');
  await setAuth(outsiderId);
  const outsiderEvidence = (await db.query(`select private.task_evidence_access('${testEvidencePath}', false) as allowed;`)).rows[0].allowed;
  await db.exec('commit;');
  assert.equal(outsiderEvidence, false, 'Outsider must not have access to evidence');
  console.log('PASS: chat member has evidence read access, outsider is denied');

  console.log('ALL CHAT GROUP TASK ACTIVITY DB TESTS PASSED!');
} catch (err) {
  console.error('Test failed:', err);
  process.exit(1);
}
