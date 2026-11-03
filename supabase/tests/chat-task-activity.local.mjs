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
  await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated;`);

  // Seed profiles and projects
  const adminId = '11111111-1111-4111-8111-111111111111';
  const supervisorId = '22222222-2222-4222-8222-222222222222';
  const techId = '33333333-3333-4333-8333-333333333333';
  const outsiderId = '44444444-4444-4444-8444-444444444444';

  const projectAId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const projectBId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

  await db.exec(`
    insert into auth.users (id, email) values
      ('${adminId}', 'admin@cabo.test'),
      ('${supervisorId}', 'super@cabo.test'),
      ('${techId}', 'tech@cabo.test'),
      ('${outsiderId}', 'outsider@cabo.test');

    insert into public.profiles (id, nombre, rol, activo) values
      ('${adminId}', 'Admin User', 'admin', true),
      ('${supervisorId}', 'Supervisor User', 'supervisor_instalacion', true),
      ('${techId}', 'Tech User', 'instalador', true),
      ('${outsiderId}', 'Outsider User', 'instalador', true);

    insert into public.proyectos (id, desarrollo, villa) values
      ('${projectAId}', 'Chileno Bay', 'Villa 101'),
      ('${projectBId}', 'El Dorado', 'Villa 202');

    -- Grant tech access to projectA
    insert into public.proyecto_participantes (proyecto_id, usuario_id) values
      ('${projectAId}', '${techId}');
  `);

  // Create chat groups:
  // groupA1 linked to projectA
  // groupA2 linked to projectA (second chat for same villa)
  // groupB linked to projectB
  // groupGeneral without villa
  const groupA1Id = '90000000-0000-4000-8000-000000000001';
  const groupA2Id = '90000000-0000-4000-8000-000000000002';
  const groupBId  = '90000000-0000-4000-8000-000000000003';
  const groupGenId= '90000000-0000-4000-8000-000000000004';

  await db.exec(`
    insert into public.chat_grupos (id, nombre, creado_por, proyecto_id) values
      ('${groupA1Id}', 'Chat Villa 101 Primario', '${adminId}', '${projectAId}'),
      ('${groupA2Id}', 'Chat Villa 101 Secundario', '${adminId}', '${projectAId}'),
      ('${groupBId}',  'Chat Villa 202', '${adminId}', '${projectBId}'),
      ('${groupGenId}','Chat General', '${adminId}', null);

    insert into public.chat_miembros (grupo_id, profile_id, rol) values
      ('${groupA1Id}', '${techId}', 'miembro'),
      ('${groupA1Id}', '${adminId}', 'admin'),
      ('${groupA2Id}', '${techId}', 'miembro'),
      ('${groupA2Id}', '${adminId}', 'admin'),
      ('${groupBId}',  '${outsiderId}', 'miembro'),
      ('${groupGenId}','${techId}', 'miembro');
  `);

  // Create a task and subtask in project A
  const taskId = '55555555-5555-4555-8555-555555555555';
  const subtaskId = '66666666-6666-4666-8666-666666666666';

  await db.exec(`
    insert into public.tareas (id, proyecto_id, titulo, estatus, asignado_a, prioridad) values
      ('${taskId}', '${projectAId}', 'Instalación de Rack', 'pendiente', '${techId}', 'alta');

    insert into public.subtareas (id, tarea_id, titulo, completada) values
      ('${subtaskId}', '${taskId}', 'Cablear patch panel', false);
  `);

  const setAuth = async (userId) => {
    await db.exec(`
      set local role to authenticated;
      select set_config('request.jwt.claim.sub', '${userId}', true);
      select set_config('request.jwt.claim.role', 'authenticated', true);
    `);
  };

  // TEST 1: Updating task status generates system message in BOTH linked chats, none in groupB or general
  await db.exec('begin;');
  await setAuth(techId);
  await db.exec(`
    update public.tareas set estatus = 'en_proceso' where id = '${taskId}';
  `);
  await db.exec('commit;');

  let msgsA1 = (await db.query(`select * from public.chat_mensajes where grupo_id = '${groupA1Id}' and tipo = 'sistema';`)).rows;
  let msgsA2 = (await db.query(`select * from public.chat_mensajes where grupo_id = '${groupA2Id}' and tipo = 'sistema';`)).rows;
  let msgsB  = (await db.query(`select * from public.chat_mensajes where grupo_id = '${groupBId}' and tipo = 'sistema';`)).rows;
  let msgsGen= (await db.query(`select * from public.chat_mensajes where grupo_id = '${groupGenId}' and tipo = 'sistema';`)).rows;

  assert.equal(msgsA1.length, 1, 'Group A1 should have 1 system message');
  assert.equal(msgsA2.length, 1, 'Group A2 should have 1 system message');
  assert.equal(msgsB.length, 0, 'Group B should have 0 system messages');
  assert.equal(msgsGen.length, 0, 'General group should have 0 system messages');

  assert.match(msgsA1[0].contenido, /Tech User cambió «Instalación de Rack» a En Proceso/);
  assert.equal(msgsA1[0].remitente_id, techId);
  assert.equal(msgsA1[0].media_meta.system_type, 'task_progress');
  assert.equal(msgsA1[0].media_meta.task_title, 'Instalación de Rack');
  console.log('PASS: task status change dispatches system message to all linked groups');

  // TEST 2: Completing subtask with comment and evidence via record_task_progress
  const requestId = '77777777-7777-4777-8777-777777777777';
  const evidencePath = `${projectAId}/${taskId}/${techId}/${requestId}.jpg`;

  await db.exec('begin;');
  await setAuth(techId);
  const progressRes = await db.query(`
    select public.record_task_progress(
      '${requestId}'::uuid,
      '${taskId}'::uuid,
      null,
      '${subtaskId}'::uuid,
      true,
      'Terminé el cableado y etiquetado.',
      '${evidencePath}',
      now()
    );
  `);
  await db.exec('commit;');

  msgsA1 = (await db.query(`select * from public.chat_mensajes where grupo_id = '${groupA1Id}' and tipo = 'sistema' order by created_at desc;`)).rows;
  assert.equal(msgsA1.length, 2, 'Group A1 should now have 2 system messages');
  const latestMsg = msgsA1[0];
  assert.match(latestMsg.contenido, /Tech User completó la subtarea «Cablear patch panel» en «Instalación de Rack»/);
  assert.equal(latestMsg.media_url, evidencePath);
  assert.equal(latestMsg.media_meta.comentario, 'Terminé el cableado y etiquetado.');
  assert.equal(latestMsg.media_meta.evidencia_path, evidencePath);
  console.log('PASS: subtask completion includes comment, evidence and custom format');

  // TEST 3: Idempotency - retry does not duplicate messages
  await db.exec('begin;');
  await setAuth(techId);
  await db.query(`
    select public.record_task_progress(
      '${requestId}'::uuid,
      '${taskId}'::uuid,
      null,
      '${subtaskId}'::uuid,
      true,
      'Terminé el cableado y etiquetado.',
      '${evidencePath}',
      now()
    );
  `);
  await db.exec('commit;');

  msgsA1 = (await db.query(`select * from public.chat_mensajes where grupo_id = '${groupA1Id}' and tipo = 'sistema';`)).rows;
  assert.equal(msgsA1.length, 2, 'Message count must remain 2 after retrying existing requestId');
  console.log('PASS: idempotent retry does not produce duplicate chat messages');

  // TEST 4: Tech cannot delete system messages
  await db.exec('begin;');
  await setAuth(techId);
  await db.exec(`delete from public.chat_mensajes where id = '${latestMsg.id}';`);
  await db.exec('commit;');

  const checkMsg = (await db.query(`select * from public.chat_mensajes where id = '${latestMsg.id}';`)).rows;
  assert.equal(checkMsg.length, 1, 'Technician cannot delete system activity message');
  console.log('PASS: technician cannot delete system message');

  // TEST 5: Admin can delete system message if needed
  await db.exec('begin;');
  await setAuth(adminId);
  await db.exec(`delete from public.chat_mensajes where id = '${latestMsg.id}';`);
  await db.exec('commit;');

  const checkMsgAdmin = (await db.query(`select * from public.chat_mensajes where id = '${latestMsg.id}';`)).rows;
  assert.equal(checkMsgAdmin.length, 0, 'Admin can delete system message');
  console.log('PASS: admin can delete system message');

  console.log('ALL CHAT TASK ACTIVITY DB TESTS PASSED!');
} catch (err) {
  console.error('Test failed:', err);
  process.exit(1);
}
