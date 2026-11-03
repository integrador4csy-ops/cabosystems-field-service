-- Automatic system activity messages published to linked villa chat groups.
-- Extends chat message types with 'sistema' and dispatches auditable task progress.

-- 1. Extend chat_mensajes tipo check constraint
alter table public.chat_mensajes drop constraint if exists chat_mensajes_tipo_check;
alter table public.chat_mensajes add constraint chat_mensajes_tipo_check
  check (tipo in ('texto', 'imagen', 'video', 'sticker', 'archivo', 'audio', 'sistema'));

-- 2. Protect system audit messages from deletion by regular message senders
drop policy if exists "Eliminación de mensajes propios o por admin" on public.chat_mensajes;
create policy "Eliminación de mensajes propios o por admin" on public.chat_mensajes
  for delete
  to authenticated
  using (
    (remitente_id = auth.uid() and tipo <> 'sistema')
    or public.check_is_group_admin(grupo_id, auth.uid())
  );

-- 3. Automatic publishing trigger function
create or replace function private.publish_task_activity_to_chats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  group_row record;
  action_summary text;
  status_display text;
  deterministic_id uuid;
  system_meta jsonb;
begin
  if new.proyecto_id is null then
    return new;
  end if;

  if new.accion = 'subtarea' then
    if new.siguiente = 'true' then
      action_summary := format('%s completó la subtarea «%s» en «%s»',
        coalesce(new.actor_name, 'Un integrante'),
        coalesce(new.subtarea_titulo, 'Subtarea'),
        coalesce(new.tarea_titulo, 'Tarea')
      );
    else
      action_summary := format('%s reabrió la subtarea «%s» en «%s»',
        coalesce(new.actor_name, 'Un integrante'),
        coalesce(new.subtarea_titulo, 'Subtarea'),
        coalesce(new.tarea_titulo, 'Tarea')
      );
    end if;
  else
    status_display := case new.siguiente
      when 'en_proceso' then 'En Proceso'
      when 'completada' then 'Completada'
      when 'pendiente' then 'Pendiente'
      else coalesce(new.siguiente, 'actualizado')
    end;
    action_summary := format('%s cambió «%s» a %s',
      coalesce(new.actor_name, 'Un integrante'),
      coalesce(new.tarea_titulo, 'Tarea'),
      status_display
    );
  end if;

  system_meta := jsonb_build_object(
    'system_type', 'task_progress',
    'task_activity_id', new.id,
    'request_id', new.request_id,
    'task_id', new.tarea_id,
    'task_title', new.tarea_titulo,
    'project_id', new.proyecto_id,
    'desarrollo', new.desarrollo,
    'villa', new.villa,
    'subtask_id', new.subtarea_id,
    'subtask_title', new.subtarea_titulo,
    'action', new.accion,
    'anterior', new.anterior,
    'siguiente', new.siguiente,
    'estado', new.estado_registrado,
    'comentario', new.comentario,
    'evidencia_path', new.evidencia_path
  );

  for group_row in
    select id
      from public.chat_grupos
     where proyecto_id = new.proyecto_id
  loop
    -- Deterministic UUID: md5(request_id || ':' || group_id) avoids duplicate messages on retry
    deterministic_id := md5(new.request_id::text || ':' || group_row.id::text)::uuid;

    insert into public.chat_mensajes (
      id,
      grupo_id,
      remitente_id,
      tipo,
      contenido,
      media_url,
      media_meta,
      created_at
    ) values (
      deterministic_id,
      group_row.id,
      new.actor_id,
      'sistema',
      action_summary,
      new.evidencia_path,
      system_meta,
      coalesce(new.accepted_at, new.captured_at, clock_timestamp())
    )
    on conflict (id) do nothing;
  end loop;

  return new;
end;
$$;

revoke all on function private.publish_task_activity_to_chats() from public, anon, authenticated;

drop trigger if exists tr_publish_task_activity_to_chats on public.task_activity;
create trigger tr_publish_task_activity_to_chats
  after insert on public.task_activity
  for each row execute function private.publish_task_activity_to_chats();
