begin;
-- Disposable identities, projects and grants. Everything is rolled back.
insert into auth.users(id,email) select ('a1000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'project-access-test-'||i||'@example.invalid' from generate_series(1,6) i;
insert into public.profiles(id,nombre,rol,activo) select ('a1000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'Access fixture '||i,case when i=1 then 'admin' else 'integrador' end,true from generate_series(1,6) i
on conflict(id) do update set rol=excluded.rol,activo=true;
insert into public.desarrollos(id,nombre) values ('b1000000-0000-0000-0000-000000000001','__Access fixture A'),('b1000000-0000-0000-0000-000000000002','__Access fixture B');
insert into public.proyectos(id,desarrollo_id,desarrollo,villa,integrador_id) values
('c1000000-0000-0000-0000-000000000001','b1000000-0000-0000-0000-000000000001','__Access fixture A','A1','a1000000-0000-0000-0000-000000000005'),
('c1000000-0000-0000-0000-000000000002','b1000000-0000-0000-0000-000000000001','__Access fixture A','A2',null),
('c1000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-000000000002','__Access fixture B','B1',null);
insert into public.proyecto_participantes(proyecto_id,usuario_id) values('c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002');
insert into public.proyecto_accesos_globales(usuario_id) values('a1000000-0000-0000-0000-000000000003');
insert into public.desarrollo_accesos(desarrollo_id,usuario_id) values('b1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000004');
insert into public.tareas(id,proyecto_id,asignado_a,titulo) values('d1000000-0000-0000-0000-000000000001','c1000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000002','Fixture task');
insert into public.subtareas(id,tarea_id,titulo) values('e1000000-0000-0000-0000-000000000001','d1000000-0000-0000-0000-000000000001','Fixture subtask');
set local role authenticated;
do $$
declare n integer; rows integer;
begin
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000002',true);
  select count(*) into n from public.proyectos where id::text like 'c1000000%'; if n<>1 then raise exception 'Member sees % villas, expected 1',n; end if;
  select count(*) into n from public.desarrollos where id::text like 'b1000000%'; if n<>1 then raise exception 'Member sees wrong developments'; end if;
  if exists(select 1 from public.proyectos where id='c1000000-0000-0000-0000-000000000002') then raise exception 'Member sees sibling villa'; end if;
  update public.tareas set estatus='en_proceso' where id='d1000000-0000-0000-0000-000000000001'; get diagnostics rows=row_count; if rows<>1 then raise exception 'Assignee cannot update status'; end if;
  update public.subtareas set completada=true where id='e1000000-0000-0000-0000-000000000001'; get diagnostics rows=row_count; if rows<>1 then raise exception 'Assignee cannot complete checklist'; end if;
  begin update public.tareas set proyecto_id='c1000000-0000-0000-0000-000000000002' where id='d1000000-0000-0000-0000-000000000001'; raise exception 'Task reassignment allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.proyecto_accesos_globales(usuario_id) values(auth.uid()); raise exception 'Self-global grant allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.desarrollo_accesos(desarrollo_id,usuario_id) values('b1000000-0000-0000-0000-000000000002',auth.uid()); raise exception 'Self-development grant allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.proyecto_participantes(proyecto_id,usuario_id) values('c1000000-0000-0000-0000-000000000003',auth.uid()); raise exception 'Self-member grant allowed'; exception when insufficient_privilege then null; end;
  begin update public.profiles set rol='admin' where id=auth.uid(); raise exception 'Self-role escalation allowed'; exception when insufficient_privilege then null; end;
  begin perform public.save_project_team('c1000000-0000-0000-0000-000000000001',null,null,'{}',0); raise exception 'Member can manage team'; exception when insufficient_privilege then null; end;
  perform public.admin_editar_colaborador(auth.uid(),'Escalation attempt','admin',true);
  if (select rol from public.profiles where id=auth.uid())='admin' then raise exception 'Legacy RPC role escalation allowed'; end if;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000005',true);
  select count(*) into n from public.proyectos where id::text like 'c1000000%'; if n<>1 then raise exception 'Lead cannot access villa'; end if;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000006',true);
  if exists(select 1 from public.proyectos where id::text like 'c1000000%') then raise exception 'Outsider sees projects'; end if;
  if exists(select 1 from public.tareas where id='d1000000-0000-0000-0000-000000000001') then raise exception 'Outsider sees tasks'; end if;
  if exists(select 1 from public.subtareas where id='e1000000-0000-0000-0000-000000000001') then raise exception 'Outsider sees subtasks'; end if;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
  select count(*) into n from public.proyectos where id::text like 'c1000000%'; if n<>3 then raise exception 'Global user missing existing villas'; end if;
  if (select rol from public.profiles where id=auth.uid())<>'integrador' then raise exception 'Global grant changed role'; end if;
  begin insert into public.desarrollos(nombre) values('Denied global creation'); raise exception 'Global user can create development'; exception when insufficient_privilege then null; end;
  begin insert into public.proyectos(desarrollo_id,desarrollo,villa) values('b1000000-0000-0000-0000-000000000001','__Access fixture A','Denied'); raise exception 'Global user can create villa'; exception when insufficient_privilege then null; end;
  update public.proyectos set integrador_id=auth.uid() where id='c1000000-0000-0000-0000-000000000001'; get diagnostics rows=row_count; if rows<>0 then raise exception 'Global user can update villa'; end if;
  delete from public.proyecto_accesos_globales where usuario_id=auth.uid(); get diagnostics rows=row_count; if rows<>0 then raise exception 'Global user can modify grants'; end if;
  delete from public.tareas where id='d1000000-0000-0000-0000-000000000001'; get diagnostics rows=row_count; if rows<>0 then raise exception 'Global user can delete task'; end if;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
  insert into public.proyectos(id,desarrollo_id,desarrollo,villa) values('c1000000-0000-0000-0000-000000000004','b1000000-0000-0000-0000-000000000001','__Access fixture A','Future villa');
  insert into public.desarrollos(id,nombre) values('b1000000-0000-0000-0000-000000000003','__Access future development');
  insert into public.proyectos(id,desarrollo_id,desarrollo,villa) values('c1000000-0000-0000-0000-000000000005','b1000000-0000-0000-0000-000000000003','__Access future development','Future project');
  perform public.save_project_team('c1000000-0000-0000-0000-000000000003',null,'a1000000-0000-0000-0000-000000000005',array['a1000000-0000-0000-0000-000000000006']::uuid[],0);
  begin perform public.save_project_team('c1000000-0000-0000-0000-000000000003',null,null,'{}',0); raise exception 'Stale team revision accepted'; exception when serialization_failure then null; end;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
  select count(*) into n from public.proyectos where id::text like 'c1000000%'; if n<>5 then raise exception 'Global user missing future projects'; end if;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000004',true);
  select count(*) into n from public.proyectos where id::text like 'c1000000%'; if n<>3 then raise exception 'Development grant missing future villa or leaking sibling development'; end if;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000006',true);
  if not exists(select 1 from public.proyectos where id='c1000000-0000-0000-0000-000000000003') then raise exception 'New participant cannot see project'; end if;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
  delete from public.proyecto_accesos_globales where usuario_id='a1000000-0000-0000-0000-000000000003';
  delete from public.desarrollo_accesos where usuario_id='a1000000-0000-0000-0000-000000000004';
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000003',true);
  if exists(select 1 from public.proyectos where id::text like 'c1000000%') then raise exception 'Revoked global user still sees project'; end if;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000004',true);
  if exists(select 1 from public.proyectos where id::text like 'c1000000%') then raise exception 'Revoked development user still sees project'; end if;
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000001',true);
  update public.profiles set activo=false where id='a1000000-0000-0000-0000-000000000005';
  perform set_config('request.jwt.claim.sub','a1000000-0000-0000-0000-000000000005',true);
  if exists(select 1 from public.proyectos where id::text like 'c1000000%') then raise exception 'Inactive lead still sees projects'; end if;
end $$;
set local role anon;
do $$ begin
  if exists(select 1 from public.proyectos where id::text like 'c1000000%') then raise exception 'Anonymous user sees projects'; end if;
  begin perform public.save_project_team('c1000000-0000-0000-0000-000000000001',null,null,'{}',0); raise exception 'Anonymous user can call team RPC'; exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: project hierarchy, per-villa/development/global scopes, future inheritance, leads, assigned progress, outsider/anonymous isolation, revocation, inactive users, role escalation protection and concurrent team updates. All fixtures rolled back.' as result;
