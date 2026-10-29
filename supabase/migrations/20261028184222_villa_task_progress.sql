-- Villa members report progress; only scoped administrators/supervisors edit content.
create function private.task_editor(project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.project_visible(project_id) and exists (
    select 1 from public.profiles u where u.id=auth.uid() and u.activo=true
      and u.rol in ('admin','supervisor_instalacion')
  );
$$;
create function private.task_progress_member(project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.task_editor(project_id) or exists (
    select 1 from public.profiles u join public.proyectos p on p.id=project_id
    where u.id=auth.uid() and u.activo=true and (
      p.integrador_id=u.id or p.tecnico_id=u.id or exists (
        select 1 from public.proyecto_participantes m where m.proyecto_id=p.id and m.usuario_id=u.id
      )
    )
  );
$$;
revoke all on function private.task_editor(uuid),private.task_progress_member(uuid) from public,anon;
grant execute on function private.task_editor(uuid),private.task_progress_member(uuid) to authenticated;

drop policy tareas_assignee_update on public.tareas;
drop policy subtareas_assignee_update on public.subtareas;
create policy tareas_member_progress on public.tareas for update to authenticated
  using (private.task_progress_member(proyecto_id)) with check (private.task_progress_member(proyecto_id));
create policy subtareas_member_progress on public.subtareas for update to authenticated
  using (exists(select 1 from public.tareas t where t.id=tarea_id and private.task_progress_member(t.proyecto_id)))
  with check (exists(select 1 from public.tareas t where t.id=tarea_id and private.task_progress_member(t.proyecto_id)));
create policy tareas_supervisor_editor on public.tareas for all to authenticated
  using (private.task_editor(proyecto_id)) with check (private.task_editor(proyecto_id));
create policy subtareas_supervisor_editor on public.subtareas for all to authenticated
  using (exists(select 1 from public.tareas t where t.id=tarea_id and private.task_editor(t.proyecto_id)))
  with check (exists(select 1 from public.tareas t where t.id=tarea_id and private.task_editor(t.proyecto_id)));

create or replace function private.protect_task_fields() returns trigger language plpgsql set search_path='' as $$
declare project_id uuid;
begin
  if auth.uid() is not null then
    if tg_table_name='tareas' then project_id := old.proyecto_id;
    else select t.proyecto_id into project_id from public.tareas t where t.id=old.tarea_id;
    end if;
    if not coalesce(private.task_editor(project_id),false) then
      if tg_table_name='tareas' and (to_jsonb(new)-'estatus') is distinct from (to_jsonb(old)-'estatus') then
        raise exception 'Solo administradores y supervisores pueden editar los datos de una tarea' using errcode='42501';
      end if;
      if tg_table_name='subtareas' and (to_jsonb(new)-'completada') is distinct from (to_jsonb(old)-'completada') then
        raise exception 'Solo puedes marcar las subtareas de tu villa' using errcode='42501';
      end if;
    end if;
  end if;
  return new;
end; $$;

create function public.get_task_permissions(p_task_id uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('user_id',auth.uid(),
    'can_progress',private.task_progress_member(t.proyecto_id),
    'can_edit',private.task_editor(t.proyecto_id))
  from public.tareas t where t.id=p_task_id;
$$;
revoke all on function public.get_task_permissions(uuid) from public,anon;
grant execute on function public.get_task_permissions(uuid) to authenticated;
