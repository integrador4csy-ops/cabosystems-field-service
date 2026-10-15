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
  const migrated = await db.query("select p.id,p.desarrollo,p.desarrollo_id,m.usuario_id from public.proyectos p join public.proyecto_participantes m on m.proyecto_id=p.id where p.id='f1000000-0000-0000-0000-000000000002'");
  assert.equal(migrated.rows[0]?.usuario_id, 'f1000000-0000-0000-0000-000000000001');
  assert.equal(migrated.rows[0]?.desarrollo, 'Existing development');
  assert.ok(migrated.rows[0]?.desarrollo_id);
  console.log('PASS: existing villa IDs, development labels and assigned-user access survive migration.');
  const results = await db.exec(readFileSync(new URL('./project_access.sql', import.meta.url), 'utf8'));
  const message = results.at(-1)?.rows[0]?.result;
  assert.match(message, /^PASS:/);
  console.log(message);
  const check = await db.query("select count(*)::integer as n from public.proyectos where id::text like 'c1000000%'");
  assert.equal(check.rows[0].n, 0, 'Fixtures must roll back');
  console.log('PASS: no fixture rows remain after rollback. PostgreSQL runs locally in memory.');
  await db.exec(`
    create function public.fixture_anonymous_authority_bypass(target uuid) returns void language plpgsql security definer set search_path='' as $$ begin
      update public.profiles set rol='admin' where id=target;
    end $$;
    begin;
    set local role anon;
    do $$ begin
      begin
        perform public.fixture_anonymous_authority_bypass('f1000000-0000-0000-0000-000000000001');
        raise exception 'Anonymous definer bypass was allowed';
      exception when insufficient_privilege then null; end;
    end $$;
    rollback;
  `);
  console.log('PASS: anonymous calls through legacy SECURITY DEFINER code cannot elevate a user.');
} finally { await db.close(); }
