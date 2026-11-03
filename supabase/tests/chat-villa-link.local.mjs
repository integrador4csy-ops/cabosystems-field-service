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
  await db.exec(readFileSync(new URL('../migrations/20261102180000_chat_villa_link.sql', import.meta.url), 'utf8'));
  await db.exec(`grant select,insert,update,delete on all tables in schema public to authenticated;`);

  const adminId = 'a0000000-0000-0000-0000-000000000001';
  const supervisorId = 'a0000000-0000-0000-0000-000000000002';
  const techId = 'a0000000-0000-0000-0000-000000000003';
  const outsiderTechId = 'a0000000-0000-0000-0000-000000000004';

  const villaAllowedId = 'b0000000-0000-0000-0000-000000000001';
  const villaForbiddenId = 'b0000000-0000-0000-0000-000000000002';

  // Seed profiles
  await db.exec(`
    insert into auth.users(id, email) values
      ('${adminId}', 'admin@example.com'),
      ('${supervisorId}', 'super@example.com'),
      ('${techId}', 'tech@example.com'),
      ('${outsiderTechId}', 'tech2@example.com');

    insert into public.profiles(id, nombre, rol, activo) values
      ('${adminId}', 'Admin User', 'admin', true),
      ('${supervisorId}', 'Supervisor In Scope', 'supervisor_instalacion', true),
      ('${techId}', 'Field Tech', 'instalador', true),
      ('${outsiderTechId}', 'Outsider Tech', 'instalador', true);

    insert into public.desarrollos(id, nombre) values
      ('c0000000-0000-0000-0000-000000000001', 'El Dorado'),
      ('c0000000-0000-0000-0000-000000000002', 'Chileno Bay');

    insert into public.proyectos(id, desarrollo_id, desarrollo, villa) values
      ('${villaAllowedId}', 'c0000000-0000-0000-0000-000000000001', 'El Dorado', 'Villa 101'),
      ('${villaForbiddenId}', 'c0000000-0000-0000-0000-000000000002', 'Chileno Bay', 'Villa 202');

    -- Give supervisor access only to El Dorado
    insert into public.desarrollo_accesos(desarrollo_id, usuario_id) values
      ('c0000000-0000-0000-0000-000000000001', '${supervisorId}');
  `);

  const asUser = async (userId, sql) => {
    return await db.transaction(async (tx) => {
      await tx.exec(`set local role authenticated; set local "request.jwt.claim.sub" = '${userId}';`);
      return await tx.query(sql);
    });
  };

  const asUserExec = async (userId, sql) => {
    return await db.transaction(async (tx) => {
      await tx.exec(`set local role authenticated; set local "request.jwt.claim.sub" = '${userId}';`);
      await tx.exec(sql);
    });
  };

  // Test 1: Supervisor can create group linked to villa in their scope
  const groupId1 = 'd0000000-0000-0000-0000-000000000001';
  await asUserExec(supervisorId, `
    insert into public.chat_grupos(id, nombre, creado_por, proyecto_id)
    values('${groupId1}', 'Equipo Villa 101', '${supervisorId}', '${villaAllowedId}');
    insert into public.chat_miembros(grupo_id, profile_id, rol)
    values('${groupId1}', '${supervisorId}', 'admin'), ('${groupId1}', '${techId}', 'miembro');
  `);
  console.log('PASS: supervisor creates chat linked to accessible villa');

  // Test 2: Supervisor CANNOT create group linked to villa outside their scope
  const groupIdForbidden = 'd0000000-0000-0000-0000-000000000002';
  let failedAsExpected = false;
  try {
    await asUserExec(supervisorId, `
      insert into public.chat_grupos(id, nombre, creado_por, proyecto_id)
      values('${groupIdForbidden}', 'Equipo Chileno', '${supervisorId}', '${villaForbiddenId}');
    `);
  } catch (err) {
    failedAsExpected = true;
    assert.match(err.message, /No tienes permiso para vincular esta villa al grupo|new row violates row-level security/i);
  }
  assert.equal(failedAsExpected, true, 'Supervisor should not link group to forbidden villa');
  console.log('PASS: supervisor blocked from linking forbidden villa');

  // Test 3: Tech cannot create group
  let techCreateFailed = false;
  try {
    await asUserExec(techId, `
      insert into public.chat_grupos(id, nombre, creado_por, proyecto_id)
      values('d0000000-0000-0000-0000-000000000003', 'Tech Group', '${techId}', '${villaAllowedId}');
    `);
  } catch (err) {
    techCreateFailed = true;
  }
  assert.equal(techCreateFailed, true, 'Tech should not be allowed to create groups');
  console.log('PASS: technician cannot create groups');

  // Test 4: Group creation without villa (proyecto_id = null) succeeds
  const groupGeneralId = 'd0000000-0000-0000-0000-000000000004';
  await asUserExec(supervisorId, `
    insert into public.chat_grupos(id, nombre, creado_por, proyecto_id)
    values('${groupGeneralId}', 'Chat General', '${supervisorId}', null);
    insert into public.chat_miembros(grupo_id, profile_id, rol)
    values('${groupGeneralId}', '${supervisorId}', 'admin');
  `);
  console.log('PASS: group creation without villa succeeds');

  // Test 5: Multiple groups can link to the same villa
  const groupId2 = 'd0000000-0000-0000-0000-000000000005';
  await asUserExec(adminId, `
    insert into public.chat_grupos(id, nombre, creado_por, proyecto_id)
    values('${groupId2}', 'Supervisión Villa 101', '${adminId}', '${villaAllowedId}');
  `);
  console.log('PASS: multiple groups can link to the same villa');

  // Test 6: Group admin updates group to unlink villa
  await asUserExec(supervisorId, `
    update public.chat_grupos set proyecto_id = null where id = '${groupId1}';
  `);
  const checkUnlinked = await asUser(supervisorId, `select proyecto_id from public.chat_grupos where id = '${groupId1}'`);
  assert.equal(checkUnlinked.rows[0].proyecto_id, null);
  console.log('PASS: unlinking villa sets proyecto_id to null');

  // Test 7: Group admin links villa back
  await asUserExec(supervisorId, `
    update public.chat_grupos set proyecto_id = '${villaAllowedId}' where id = '${groupId1}';
  `);
  const checkRelinked = await asUser(supervisorId, `select proyecto_id from public.chat_grupos where id = '${groupId1}'`);
  assert.equal(checkRelinked.rows[0].proyecto_id, villaAllowedId);
  console.log('PASS: linking villa back succeeds');

  // Test 8: Tech in the group can read group and see linked villa row
  const techVillaRead = await asUser(techId, `
    select p.id, p.desarrollo, p.villa
    from public.chat_grupos g
    join public.proyectos p on p.id = g.proyecto_id
    where g.id = '${groupId1}'
  `);
  assert.equal(techVillaRead.rows.length, 1);
  assert.equal(techVillaRead.rows[0].villa, 'Villa 101');
  console.log('PASS: technician in group can read linked villa metadata');

  // Test 9: Technician still CANNOT read tasks they are not assigned to
  // Insert an unassigned task or task assigned to someone else
  await db.exec(`
    insert into public.tareas(id, proyecto_id, titulo, asignado_a)
    values('e0000000-0000-0000-0000-000000000001', '${villaAllowedId}', 'Secret task for admin', '${adminId}');
  `);
  const techTaskRead = await asUser(techId, `
    select * from public.tareas where id = 'e0000000-0000-0000-0000-000000000001'
  `);
  assert.equal(techTaskRead.rows.length, 0, 'Tech must NOT see task assigned to someone else even if in chat');
  console.log('PASS: technician in chat still cannot see tasks assigned to others');

  // Test 10: Non-member technician cannot see private chat
  const outsiderChatRead = await asUser(outsiderTechId, `
    select * from public.chat_grupos where id = '${groupId1}'
  `);
  assert.equal(outsiderChatRead.rows.length, 0, 'Outsider should not see group');
  console.log('PASS: outsider cannot see group');

  console.log('ALL DB TESTS PASSED!');
} catch (err) {
  console.error('Test error:', err);
  process.exit(1);
}
