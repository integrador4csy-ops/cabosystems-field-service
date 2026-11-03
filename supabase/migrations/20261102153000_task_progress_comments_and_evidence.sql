-- Auditable task progress with optional comments and private photo evidence.
-- The private `task-evidence` bucket must be created through the Storage API or
-- Dashboard before deployment (10 MB, image/jpeg,image/png,image/webp).

alter table public.task_activity
  add column request_id uuid,
  add column comentario text,
  add column evidencia_path text,
  add column captured_at timestamptz,
  add column accepted_at timestamptz;

update public.task_activity
set request_id=gen_random_uuid(),
    captured_at=(fecha::timestamp at time zone 'America/Mazatlan'),
    accepted_at=(fecha::timestamp at time zone 'America/Mazatlan');

alter table public.task_activity
  alter column request_id set not null,
  alter column captured_at set not null,
  alter column accepted_at set not null,
  add constraint task_activity_comment_length check (comentario is null or length(comentario)<=2000),
  add constraint task_activity_evidence_path check (
    evidencia_path is null or evidencia_path ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  );

create unique index task_activity_actor_request_idx
  on public.task_activity(actor_id,request_id);

-- Storage object paths are project/task/actor/request.ext. Reading follows task
-- visibility; uploading additionally requires progress permission and ownership
-- of the actor path. Referenced evidence is immutable; only an unreferenced upload
-- from a failed request can be removed by its owner.
create function private.task_evidence_access(object_name text, require_progress boolean default false)
returns boolean
language plpgsql stable security definer set search_path='' as $$
declare
  allowed boolean;
  path_parts text[];
  file_parts text[];
  path_project uuid;
  path_task uuid;
  path_actor uuid;
  path_request uuid;
begin
  if auth.uid() is null then return false; end if;
  path_parts := string_to_array(object_name,'/');
  if array_length(path_parts,1)<>4 then return false; end if;
  file_parts := string_to_array(path_parts[4],'.');
  if array_length(file_parts,1)<>2 or lower(file_parts[2]) not in ('jpg','jpeg','png','webp')
  then return false; end if;
  begin
    path_project := path_parts[1]::uuid;
    path_task := path_parts[2]::uuid;
    path_actor := path_parts[3]::uuid;
    path_request := file_parts[1]::uuid;
  exception when invalid_text_representation then return false;
  end;
  if require_progress and path_actor<>auth.uid() then return false; end if;

  select case when require_progress
    then private.task_progress_allowed(t.proyecto_id,t.asignado_a)
    else private.task_visible(t.proyecto_id,t.asignado_a)
  end into allowed
  from public.tareas t
  where t.id=path_task and t.proyecto_id=path_project;
  return coalesce(allowed,false);
end;
$$;
revoke all on function private.task_evidence_access(text,boolean) from public,anon;
grant execute on function private.task_evidence_access(text,boolean) to authenticated;

create function private.task_evidence_cleanup_allowed(object_name text)
returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null
    and split_part(object_name,'/',3)=auth.uid()::text
    and not exists(select 1 from public.task_activity a where a.evidencia_path=object_name);
$$;
revoke all on function private.task_evidence_cleanup_allowed(text) from public,anon;
grant execute on function private.task_evidence_cleanup_allowed(text) to authenticated;

create policy task_evidence_select on storage.objects for select to authenticated
  using (bucket_id='task-evidence' and private.task_evidence_access(name,false));
create policy task_evidence_insert on storage.objects for insert to authenticated
  with check (bucket_id='task-evidence' and private.task_evidence_access(name,true));
create policy task_evidence_delete_unreferenced on storage.objects for delete to authenticated
  using (bucket_id='task-evidence' and private.task_evidence_cleanup_allowed(name));

-- The trigger remains the only writer to task_activity. RPC metadata is stored in
-- transaction-local settings, while legacy direct progress updates still produce
-- a complete history row with a generated request identifier.
create or replace function private.record_task_activity() returns trigger
language plpgsql security definer set search_path='' as $$
declare
  task_row public.tareas%rowtype;
  project_row public.proyectos%rowtype;
  person_name text;
  assigned_name text;
  before_value text;
  after_value text;
  sub_id uuid;
  sub_title text;
  progress_request uuid;
  progress_comment text;
  progress_evidence text;
  progress_captured timestamptz;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name='tareas' then
    if tg_op='UPDATE' then
      if old.estatus is not distinct from new.estatus then return new; end if;
      before_value := old.estatus;
    elsif new.estatus='pendiente' then return new;
    end if;
    task_row := new; after_value := new.estatus;
  else
    if tg_op='UPDATE' then
      if old.completada is not distinct from new.completada then return new; end if;
      before_value := old.completada::text;
    elsif not new.completada then return new;
    end if;
    select * into strict task_row from public.tareas where id=new.tarea_id;
    after_value := new.completada::text; sub_id := new.id; sub_title := new.titulo;
  end if;
  if not coalesce(private.task_progress_allowed(task_row.proyecto_id,task_row.asignado_a),false) then
    raise exception 'No tienes permiso para registrar avances en esta tarea' using errcode='42501';
  end if;
  select nombre into strict person_name from public.profiles where id=auth.uid() and activo=true;
  select * into strict project_row from public.proyectos where id=task_row.proyecto_id;
  select nombre into assigned_name from public.profiles where id=task_row.asignado_a;

  progress_request := nullif(current_setting('app.task_progress_request_id',true),'')::uuid;
  progress_comment := nullif(btrim(current_setting('app.task_progress_comment',true)),'');
  progress_evidence := nullif(current_setting('app.task_progress_evidence',true),'');
  progress_captured := nullif(current_setting('app.task_progress_captured_at',true),'')::timestamptz;

  insert into public.task_activity(fecha,actor_id,actor_name,proyecto_id,desarrollo,villa,tarea_id,tarea_titulo,
    subtarea_id,subtarea_titulo,accion,anterior,siguiente,estado_registrado,encargado_nombre,
    request_id,comentario,evidencia_path,captured_at,accepted_at)
  values ((statement_timestamp() at time zone 'America/Mazatlan')::date,auth.uid(),person_name,
    task_row.proyecto_id,project_row.desarrollo,project_row.villa,task_row.id,task_row.titulo,sub_id,sub_title,
    case when tg_table_name='tareas' then 'estado' else 'subtarea' end,before_value,after_value,
    task_row.estatus,assigned_name,coalesce(progress_request,gen_random_uuid()),progress_comment,
    progress_evidence,coalesce(progress_captured,statement_timestamp()),statement_timestamp());
  return new;
end;
$$;
revoke all on function private.record_task_activity() from public,anon,authenticated;

create function public.record_task_progress(
  p_request_id uuid,
  p_task_id uuid,
  p_task_status text default null,
  p_subtask_id uuid default null,
  p_subtask_completed boolean default null,
  p_comment text default null,
  p_evidence_path text default null,
  p_captured_at timestamptz default null
) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
  task_row public.tareas%rowtype;
  activity_row public.task_activity%rowtype;
  clean_comment text := nullif(btrim(p_comment),'');
  clean_evidence text := nullif(btrim(p_evidence_path),'');
  action_count integer;
begin
  if auth.uid() is null or p_request_id is null or p_task_id is null then
    raise exception 'Solicitud de avance no valida' using errcode='22023';
  end if;

  select * into activity_row from public.task_activity
  where actor_id=auth.uid() and request_id=p_request_id;
  if found then return to_jsonb(activity_row); end if;

  action_count := (p_task_status is not null)::integer
    + (p_subtask_id is not null or p_subtask_completed is not null)::integer;
  if action_count<>1
    or (p_subtask_id is null)<>(p_subtask_completed is null)
    or (p_task_status is not null and p_task_status not in ('pendiente','en_proceso','completada'))
    or length(coalesce(clean_comment,''))>2000
  then raise exception 'Parametros de avance no validos' using errcode='22023'; end if;

  select * into task_row from public.tareas where id=p_task_id for update;
  if not found or not coalesce(private.task_progress_allowed(task_row.proyecto_id,task_row.asignado_a),false) then
    raise exception 'No tienes permiso para registrar avances en esta tarea' using errcode='42501';
  end if;
  if p_captured_at is not null and p_captured_at>statement_timestamp()+interval '5 minutes' then
    raise exception 'La fecha de captura no puede estar en el futuro' using errcode='22023';
  end if;
  if clean_evidence is not null and clean_evidence not in (
    task_row.proyecto_id::text||'/'||task_row.id::text||'/'||auth.uid()::text||'/'||p_request_id::text||'.jpg',
    task_row.proyecto_id::text||'/'||task_row.id::text||'/'||auth.uid()::text||'/'||p_request_id::text||'.jpeg',
    task_row.proyecto_id::text||'/'||task_row.id::text||'/'||auth.uid()::text||'/'||p_request_id::text||'.png',
    task_row.proyecto_id::text||'/'||task_row.id::text||'/'||auth.uid()::text||'/'||p_request_id::text||'.webp'
  ) then raise exception 'Ruta de evidencia no valida' using errcode='22023'; end if;

  perform set_config('app.task_progress_request_id',p_request_id::text,true);
  perform set_config('app.task_progress_comment',coalesce(clean_comment,''),true);
  perform set_config('app.task_progress_evidence',coalesce(clean_evidence,''),true);
  perform set_config('app.task_progress_captured_at',coalesce(p_captured_at,statement_timestamp())::text,true);

  if p_task_status is not null then
    update public.tareas set estatus=p_task_status where id=p_task_id;
  else
    update public.subtareas set completada=p_subtask_completed
    where id=p_subtask_id and tarea_id=p_task_id;
    if not found then raise exception 'Subtarea no encontrada' using errcode='22023'; end if;
  end if;

  select * into activity_row from public.task_activity
  where actor_id=auth.uid() and request_id=p_request_id;
  if not found then
    raise exception 'El avance no contiene un cambio efectivo' using errcode='22023';
  end if;

  perform set_config('app.task_progress_request_id','',true);
  perform set_config('app.task_progress_comment','',true);
  perform set_config('app.task_progress_evidence','',true);
  perform set_config('app.task_progress_captured_at','',true);
  return to_jsonb(activity_row);
end;
$$;
revoke all on function public.record_task_progress(uuid,uuid,text,uuid,boolean,text,text,timestamptz)
  from public,anon;
grant execute on function public.record_task_progress(uuid,uuid,text,uuid,boolean,text,text,timestamptz)
  to authenticated;

-- PostgreSQL requires dropping the function before extending its row type.
drop function public.get_task_activity_report(date,date,uuid,uuid,bigint,bigint,integer);
create function public.get_task_activity_report(p_from date,p_to date,p_actor uuid default null,
  p_project uuid default null,p_after bigint default 0,p_until bigint default null,p_limit integer default 500)
returns table(id bigint,fecha date,actor_id uuid,actor_name text,proyecto_id uuid,desarrollo text,villa text,
  tarea_id uuid,tarea_titulo text,subtarea_id uuid,subtarea_titulo text,accion text,anterior text,siguiente text,
  estado_registrado text,encargado_nombre text,request_id uuid,comentario text,evidencia_path text,
  captured_at timestamptz,accepted_at timestamptz,estado_actual text,hasta_id bigint)
language plpgsql stable security invoker set search_path='' as $$
begin
  if p_from is null or p_to is null or p_from>p_to or p_limit is null or p_limit<1 or p_limit>1000
    or p_after is null or p_after<0 then raise exception 'Parametros de informe no validos' using errcode='22023'; end if;
  return query select a.id,a.fecha,a.actor_id,a.actor_name,a.proyecto_id,a.desarrollo,a.villa,
    a.tarea_id,a.tarea_titulo,a.subtarea_id,a.subtarea_titulo,a.accion,a.anterior,a.siguiente,
    a.estado_registrado,a.encargado_nombre,a.request_id,a.comentario,a.evidencia_path,a.captured_at,
    a.accepted_at,t.estatus,max(a.id) over()
  from public.task_activity a left join public.tareas t on t.id=a.tarea_id and t.proyecto_id=a.proyecto_id
  where a.fecha between p_from and p_to and (p_actor is null or a.actor_id=p_actor)
    and (p_project is null or a.proyecto_id=p_project) and a.id>p_after and (p_until is null or a.id<=p_until)
  order by a.id limit p_limit;
end; $$;
revoke all on function public.get_task_activity_report(date,date,uuid,uuid,bigint,bigint,integer)
  from public,anon;
grant execute on function public.get_task_activity_report(date,date,uuid,uuid,bigint,bigint,integer)
  to authenticated;
