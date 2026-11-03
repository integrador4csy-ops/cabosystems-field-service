-- Chat Group Task Activity ("Tareas realizadas" section in group info).
-- Allows members of a villa-linked chat to query the villa's auditable task activity and evidence.

-- 1. Index on task_activity for paginated project queries
create index if not exists idx_task_activity_project_id_desc
  on public.task_activity(proyecto_id, id desc);

-- 2. Update task_evidence_access to allow viewing evidence for users with project visibility
create or replace function private.task_evidence_access(object_name text, require_progress boolean default false)
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
    else (private.task_visible(t.proyecto_id,t.asignado_a) or private.project_visible(t.proyecto_id))
  end into allowed
  from public.tareas t
  where t.id=path_task and t.proyecto_id=path_project;
  return coalesce(allowed,false);
end;
$$;

revoke all on function private.task_evidence_access(text,boolean) from public,anon;
grant execute on function private.task_evidence_access(text,boolean) to authenticated;

-- 3. RPC to get official task activity for a chat group's linked villa
create or replace function public.get_chat_group_task_activity(
  p_group_id uuid,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id bigint,
  request_id uuid,
  actor_name text,
  tarea_id uuid,
  tarea_titulo text,
  subtarea_id uuid,
  subtarea_titulo text,
  accion text,
  anterior text,
  siguiente text,
  estado_registrado text,
  comentario text,
  evidencia_path text,
  captured_at timestamptz,
  accepted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return;
  end if;

  -- Verify user is an active member of this group
  select cg.proyecto_id
    into v_project_id
    from public.chat_grupos cg
    join public.chat_miembros cm on cm.grupo_id = cg.id
   where cg.id = p_group_id
     and cm.profile_id = v_user_id;

  if not found or v_project_id is null then
    return;
  end if;

  return query
  select a.id,
         a.request_id,
         a.actor_name,
         a.tarea_id,
         a.tarea_titulo,
         a.subtarea_id,
         a.subtarea_titulo,
         a.accion,
         a.anterior,
         a.siguiente,
         a.estado_registrado,
         a.comentario,
         a.evidencia_path,
         a.captured_at,
         a.accepted_at
    from public.task_activity a
   where a.proyecto_id = v_project_id
   order by a.id desc
   limit least(coalesce(p_limit, 20), 50)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.get_chat_group_task_activity(uuid, integer, integer) from public, anon;
grant execute on function public.get_chat_group_task_activity(uuid, integer, integer) to authenticated;
