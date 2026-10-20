-- Company-wide events are independent of project tasks and their access grants.
create table public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null check (length(btrim(titulo)) between 1 and 160),
  descripcion text check (length(descripcion) <= 5000),
  tipo text not null default 'evento' check (tipo in ('evento', 'recordatorio')),
  fecha date not null check (fecha between date '1900-01-01' and date '9999-12-31'),
  hora time without time zone,
  ubicacion text check (length(ubicacion) <= 240),
  created_at timestamptz not null default now()
);
create index agenda_eventos_fecha_hora_idx on public.agenda_eventos(fecha, hora);

-- Read the authenticated user's canonical profile, independent of profile RLS.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
create function private.agenda_access(manage boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.activo = true
      and (not manage or p.rol in ('admin', 'supervisor_instalacion'))
  );
$$;
revoke all on function private.agenda_access(boolean) from public, anon;
grant execute on function private.agenda_access(boolean) to authenticated;

alter table public.agenda_eventos enable row level security;
revoke all on public.agenda_eventos from public, anon, authenticated;
grant select, insert, update, delete on public.agenda_eventos to authenticated;
create policy agenda_read on public.agenda_eventos for select to authenticated
  using ((select private.agenda_access(false)));
create policy agenda_insert on public.agenda_eventos for insert to authenticated
  with check ((select private.agenda_access(true)));
create policy agenda_update on public.agenda_eventos for update to authenticated
  using ((select private.agenda_access(true))) with check ((select private.agenda_access(true)));
create policy agenda_delete on public.agenda_eventos for delete to authenticated
  using ((select private.agenda_access(true)));

-- Realtime refreshes the shared calendar; RLS still governs subscriber access.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.agenda_eventos;
  end if;
end $$;
