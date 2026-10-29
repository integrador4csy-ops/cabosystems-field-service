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
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select current_user::text $$;
    grant usage on schema public,auth to anon,authenticated;
    grant execute on function auth.uid(),auth.role() to anon,authenticated;
  `);
  // The existing schema, plus only the columns actually used by this feature.
  await db.exec(readFileSync(new URL('../migrations/001_initial_schema.sql', import.meta.url), 'utf8'));
  await db.exec(`
    alter table public.proyectos rename column unidad to villa;
    alter table public.tareas alter column asignado_a drop not null;
    alter table public.profiles add column avatar_url text;
    grant select,insert,update,delete on all tables in schema public to authenticated,anon;
    grant execute on function public.get_my_role() to authenticated,anon;
    create policy legacy_tasks_all on tareas for all using(true) with check(true);
    create policy legacy_subtasks_all on subtareas for all using(true) with check(true);
    create function public.admin_editar_colaborador(p_user_id uuid,p_nombre text,p_rol text,p_activo boolean)
    returns jsonb language plpgsql security definer as $$ begin
      update public.profiles set nombre=p_nombre,rol=p_rol,activo=p_activo where id=p_user_id;
      return jsonb_build_object('success',true);
    exception when others then return jsonb_build_object('success',false); end $$;
  `);
  await db.exec(`
    insert into auth.users(id,email) values('f1000000-0000-0000-0000-000000000001','existing-fixture@example.invalid');
    insert into public.profiles(id,nombre,rol,activo) values('f1000000-0000-0000-0000-000000000001','Existing technician','instalador',true);
    insert into public.proyectos(id,desarrollo,villa) values('f1000000-0000-0000-0000-000000000002','Existing development','Existing villa');
    insert into public.tareas(id,proyecto_id,asignado_a,titulo) values('f1000000-0000-0000-0000-000000000003','f1000000-0000-0000-0000-000000000002','f1000000-0000-0000-0000-000000000001','Existing assignment');
  `);
  await db.exec(readFileSync(new URL('../migrations/20261015215504_project_hierarchy_and_access.sql', import.meta.url), 'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261015220443_harden_legacy_profile_access.sql', import.meta.url), 'utf8'));

  await db.exec(readFileSync(new URL('../migrations/20261028184222_villa_task_progress.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261028185402_task_assignee_informational.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261028190342_task_progress_all_access_scopes.sql', import.meta.url),'utf8'));
  await db.exec(readFileSync(new URL('../migrations/20261029220523_task_activity_reports.sql', import.meta.url),'utf8'));
  const project='f1000000-0000-0000-0000-000000000002';
  const task='f1000000-0000-0000-0000-000000000003';
  const otherProject='f1000000-0000-0000-0000-000000000004';
  const otherTask='f1000000-0000-0000-0000-000000000005';
  const sub='f1000000-0000-0000-0000-000000000006';
  const uid=i=>'b2000000-0000-0000-0000-'+String(i).padStart(12,'0');
  for(let i=1;i<=7;i++){
    await db.query('insert into auth.users(id,email) values($1,$2)',[uid(i),'fixture-'+i+'@example.invalid']);
    await db.query('insert into profiles(id,nombre,rol,activo) values($1,$2,$3,$4)',[uid(i),'Fixture '+i,i===1?'admin':i===2?'supervisor_instalacion':'aux_integracion',i!==6]);
  }
  await db.query('insert into proyectos(id,desarrollo,villa) values($1,$2,$3)',[otherProject,'Other development','Other villa']);
  await db.query('insert into tareas(id,proyecto_id,asignado_a,titulo) values($1,$2,$3,$4)',[otherTask,otherProject,null,'Unrelated task']);
  await db.query('insert into subtareas(id,tarea_id,titulo) values($1,$2,$3)',[sub,task,'Original checklist']);
  for(const user of [uid(2),uid(3),uid(6)])await db.query('insert into proyecto_participantes(proyecto_id,usuario_id) values($1,$2)',[project,user]);
  await db.query('insert into proyecto_accesos_globales(usuario_id) values($1)',[uid(4)]);
  const development=(await db.query('select desarrollo_id from proyectos where id=$1',[project])).rows[0].desarrollo_id;
  await db.query('insert into desarrollo_accesos(desarrollo_id,usuario_id) values($1,$2)',[development,uid(5)]);
  const login=async id=>{await db.exec('reset role');await db.query(`select set_config('request.jwt.claim.sub',$1,false)`,[id]);await db.exec('set role authenticated');};
  const permissions=async id=>(await db.query('select public.get_task_permissions($1) as permissions',[id])).rows[0].permissions;
  const visualTask='f1000000-0000-0000-0000-000000000007';
  await db.query('insert into tareas(id,proyecto_id,asignado_a,titulo) values($1,$2,$3,$4)',[visualTask,project,uid(7),'Visual assignment']);
  assert.equal((await db.query('select * from proyecto_participantes where proyecto_id=$1 and usuario_id=$2',[project,uid(7)])).rows.length,0);
  await login(uid(7));
  assert.equal(await permissions(visualTask),null);
  assert.equal((await db.query('update tareas set estatus=$1 where id=$2 returning id',['completada',visualTask])).rows.length,0);
  console.log('PASS: assigning the responsible person alone grants neither membership, visibility nor progress.');
  await login(uid(3));
  assert.deepEqual(await permissions(task),{user_id:uid(3),can_progress:true,can_edit:false});
  assert.equal((await db.query('update tareas set estatus=$1 where id=$2 returning id',['completada',task])).rows.length,1);
  assert.equal((await db.query('update subtareas set completada=true where id=$1 returning id',[sub])).rows.length,1);
  for(const sql of [`update tareas set titulo='Unauthorized' where id='${task}'`,`update tareas set asignado_a='${uid(3)}' where id='${task}'`,`update subtareas set titulo='Unauthorized' where id='${sub}'`,`update tareas set proyecto_id='${otherProject}' where id='${task}'`]) await assert.rejects(db.exec(sql),/Solo/);
  assert.equal((await db.query('delete from tareas where id=$1 returning id',[task])).rows.length,0);
  await assert.rejects(db.query('insert into tareas(proyecto_id,asignado_a,titulo) values($1,$2,$3)',[project,uid(3),'Unauthorized']),/row-level security/);
  assert.equal((await db.query('update tareas set estatus=$1 where id=$2 returning id',['completada',otherTask])).rows.length,0);
  assert.equal(await permissions(otherTask),null);
  console.log('PASS: villa member updates another assignee and checklist, but cannot edit, move, create or delete.');
  for(const user of [uid(4),uid(5)]){
    await login(user);assert.deepEqual(await permissions(task),{user_id:user,can_progress:true,can_edit:false});
    assert.equal((await db.query('update tareas set estatus=$1 where id=$2 returning id',['pendiente',task])).rows.length,1);
    assert.equal((await db.query('update subtareas set completada=false where id=$1 returning id',[sub])).rows.length,1);
    await assert.rejects(db.query('update tareas set titulo=$1 where id=$2',['Unauthorized',task]),/Solo/);
  }
  console.log('PASS: global and development access grants progress without content editing.');
  await login(uid(4));
  assert.deepEqual(await permissions(otherTask),{user_id:uid(4),can_progress:true,can_edit:false});
  assert.equal((await db.query('update tareas set estatus=$1 where id=$2 returning id',['completada',otherTask])).rows.length,1);
  await db.exec('reset role');
  await db.query('delete from proyecto_accesos_globales where usuario_id=$1',[uid(4)]);
  await login(uid(4));assert.equal(await permissions(otherTask),null);
  assert.equal((await db.query('update tareas set estatus=$1 where id=$2 returning id',['pendiente',otherTask])).rows.length,0);
  console.log('PASS: global access works in a second villa and disappears after revocation.');
  await login(uid(6));assert.equal(await permissions(task),null);
  assert.equal((await db.query('update tareas set estatus=$1 where id=$2 returning id',['pendiente',task])).rows.length,0);
  await login(uid(2));assert.deepEqual(await permissions(task),{user_id:uid(2),can_progress:true,can_edit:true});
  assert.equal((await db.query('update tareas set titulo=$1 where id=$2 returning id',['Supervisor edit',task])).rows.length,1);
  assert.equal((await db.query('update subtareas set titulo=$1 where id=$2 returning id',['Supervisor checklist',sub])).rows.length,1);
  assert.equal(await permissions(otherTask),null);
  await assert.rejects(db.query('update tareas set proyecto_id=$1 where id=$2',[otherProject,task]),/row-level security/);
  console.log('PASS: active supervisor edits only accessible villas; inactive users have no write access.');
  await login(uid(1));assert.deepEqual(await permissions(otherTask),{user_id:uid(1),can_progress:true,can_edit:true});
  assert.equal((await db.query('update tareas set titulo=$1 where id=$2 returning id',['Admin edit',otherTask])).rows.length,1);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select public.get_task_permissions($1)',[task]),/permission denied/);
  console.log('PASS: administrator access remains available and anonymous RPC calls are denied.');
} finally { await db.close(); }
