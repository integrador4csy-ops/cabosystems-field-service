begin;
do $$
declare actor uuid; room uuid;
begin
 select p.id,g.id into actor,room from public.profiles p cross join public.chat_grupos g where p.rol='admin' limit 1;
 if actor is null then raise exception 'No fixture administrator/group found'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('test.chat_room',room::text,true);
end $$;
set local role authenticated;
do $$
declare parent_id uuid := gen_random_uuid(); child_id uuid := gen_random_uuid(); self_id uuid := gen_random_uuid();
 room uuid := current_setting('test.chat_room')::uuid; actor uuid := auth.uid();
begin
 insert into public.chat_mensajes(id,grupo_id,remitente_id,tipo,contenido)
 values(parent_id,room,actor,'texto','Transactional test: original');
 insert into public.chat_mensajes(id,grupo_id,remitente_id,tipo,contenido,reply_to_id)
 values(child_id,room,actor,'texto','Transactional test: reply',parent_id);
 if not exists(select 1 from public.chat_mensajes where id=child_id and reply_to_id=parent_id) then raise exception 'Reply not persisted'; end if;
 insert into public.chat_pins(mensaje_id,grupo_id,pinned_by) values(parent_id,room,actor);
 if not exists(select 1 from public.chat_pins where mensaje_id=parent_id) then raise exception 'Pin not persisted'; end if;
 begin
  insert into public.chat_mensajes(id,grupo_id,remitente_id,tipo,contenido,reply_to_id)
  values(self_id,room,actor,'texto','Invalid self reply',self_id);
  raise exception 'Self-reply was allowed';
 exception when check_violation then null; end;
 begin
  insert into public.chat_mensajes(grupo_id,remitente_id,tipo,contenido,reply_to_id)
  values(room,actor,'texto','Invalid missing parent',gen_random_uuid());
  raise exception 'Missing parent was allowed';
 exception when foreign_key_violation then null; end;
 delete from public.chat_mensajes where id=parent_id;
 if exists(select 1 from public.chat_pins where mensaje_id=parent_id) then raise exception 'Pin did not cascade'; end if;
 if not exists(select 1 from public.chat_mensajes where id=child_id and reply_to_id is null) then raise exception 'Reply did not survive original deletion'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from public.chat_pins) then raise exception 'Nonmember can read pins'; end if;
 begin
  insert into public.chat_pins(mensaje_id,grupo_id,pinned_by) values(child_id,room,auth.uid());
  raise exception 'Nonmember can pin';
 exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: reply persistence, pin persistence, self-reply prevention, missing parent prevention, deletion cleanup and nonmember isolation; all test writes rolled back' as result;
