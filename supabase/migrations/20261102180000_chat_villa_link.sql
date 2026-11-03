-- Optional link between chat groups and villas (proyectos).
-- Multiple groups can be linked to the same villa.
-- Linking is restricted to villas the user has permission to view.

alter table public.chat_grupos
  add column if not exists proyecto_id uuid references public.proyectos(id) on delete set null;

create index if not exists idx_chat_grupos_proyecto_id
  on public.chat_grupos(proyecto_id);

-- Group members gain minimum project visibility to see the villa label in chat.
create or replace function private.project_visible(project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.profiles u join public.proyectos p on p.id=project_id
    where u.id=auth.uid() and u.activo=true and (
      private.project_global() or p.integrador_id=u.id or p.tecnico_id=u.id
      or exists(select 1 from public.proyecto_participantes m where m.proyecto_id=p.id and m.usuario_id=u.id)
      or exists(select 1 from public.desarrollo_accesos a where a.desarrollo_id=p.desarrollo_id and a.usuario_id=u.id)
      or exists(select 1 from public.tareas t where t.proyecto_id=p.id and t.asignado_a=u.id)
      or exists(select 1 from public.chat_grupos g join public.chat_miembros cm on cm.grupo_id=g.id where g.proyecto_id=p.id and cm.profile_id=u.id)));
$$;

create or replace function private.validate_chat_grupo_proyecto()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.proyecto_id is not null then
    if not exists (select 1 from public.proyectos where id = new.proyecto_id) then
      raise exception 'La villa especificada no existe' using errcode = '23503';
    end if;
    if auth.uid() is not null and not private.project_visible(new.proyecto_id) then
      raise exception 'No tienes permiso para vincular esta villa al grupo' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_validate_chat_grupo_proyecto on public.chat_grupos;
create trigger trg_validate_chat_grupo_proyecto
  before insert or update of proyecto_id on public.chat_grupos
  for each row execute function private.validate_chat_grupo_proyecto();

drop policy if exists "Creación de grupos para admins y supervisores" on public.chat_grupos;
create policy "Creación de grupos para admins y supervisores" on public.chat_grupos
  for insert to authenticated
  with check (
    auth.uid() = creado_por and
    exists (select 1 from public.profiles where id = auth.uid() and rol in ('admin', 'supervisor_instalacion')) and
    (proyecto_id is null or private.project_visible(proyecto_id))
  );

drop policy if exists "Actualización de grupos para admin del grupo" on public.chat_grupos;
create policy "Actualización de grupos para admin del grupo" on public.chat_grupos
  for update to authenticated
  using (public.check_is_group_admin(id, auth.uid()))
  with check (
    public.check_is_group_admin(id, auth.uid()) and
    (proyecto_id is null or private.project_visible(proyecto_id))
  );
