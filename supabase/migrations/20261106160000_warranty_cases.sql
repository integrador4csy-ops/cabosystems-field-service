-- Compact warranty workflow. The responsible user opens and owns the case;
-- every meaningful change is copied to an immutable activity timeline.
create table public.warranty_cases (
  id uuid primary key default gen_random_uuid(),
  case_number bigint generated always as identity unique,
  project_id uuid references public.proyectos(id) on delete set null,
  location text not null check (length(btrim(location)) between 1 and 180),
  equipment text not null check (length(btrim(equipment)) between 1 and 180),
  serial_number text check (serial_number is null or length(btrim(serial_number)) <= 180),
  issue text not null check (length(btrim(issue)) between 3 and 2000),
  responsible_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'registered' check (status in ('registered','review','waiting','resolved','rejected')),
  area text not null default 'project' check (area in ('project','laboratory','operations','supplier','client')),
  warranty_until date,
  last_note text not null default '' check (length(last_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.warranty_case_updates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.warranty_cases(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  status text not null check (status in ('registered','review','waiting','resolved','rejected')),
  area text not null check (area in ('project','laboratory','operations','supplier','client')),
  note text not null default '' check (length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index warranty_cases_status_updated_idx on public.warranty_cases(status, updated_at desc);
create index warranty_cases_responsible_updated_idx on public.warranty_cases(responsible_id, updated_at desc);
create index warranty_cases_project_idx on public.warranty_cases(project_id) where project_id is not null;
create index warranty_case_updates_case_created_idx on public.warranty_case_updates(case_id, created_at desc);

create or replace function private.warranty_active_user()
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles p where p.id=(select auth.uid()) and p.activo=true
  );
$$;

create or replace function private.warranty_manager()
returns boolean language sql stable security definer set search_path='' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.profiles p
    where p.id=(select auth.uid()) and p.activo=true
      and p.rol in ('admin','supervisor_instalacion','aux_operaciones')
  );
$$;

revoke all on function private.warranty_active_user(), private.warranty_manager() from public, anon;
grant execute on function private.warranty_active_user(), private.warranty_manager() to authenticated;

create or replace function private.prepare_warranty_case()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.responsible_id is distinct from old.responsible_id
      or new.created_at is distinct from old.created_at
      or new.case_number is distinct from old.case_number then
      raise exception 'La identidad del caso de garantía no se puede modificar' using errcode='22023';
    end if;
    new.updated_at := now();
  end if;
  if new.status in ('resolved','rejected') then
    new.closed_at := case when tg_op='UPDATE' then coalesce(old.closed_at, now()) else now() end;
  else
    new.closed_at := null;
  end if;
  return new;
end;
$$;

create or replace function private.log_warranty_case_update()
returns trigger language plpgsql set search_path='' as $$
begin
  insert into public.warranty_case_updates(case_id, actor_id, status, area, note)
  values (new.id, (select auth.uid()), new.status, new.area, new.last_note);
  return new;
end;
$$;

create trigger warranty_case_prepare
before insert or update on public.warranty_cases
for each row execute function private.prepare_warranty_case();

create trigger warranty_case_log
after insert or update on public.warranty_cases
for each row execute function private.log_warranty_case_update();

revoke all on function private.prepare_warranty_case(), private.log_warranty_case_update() from public, anon, authenticated;

alter table public.warranty_cases enable row level security;
alter table public.warranty_case_updates enable row level security;
revoke all on public.warranty_cases, public.warranty_case_updates from anon, authenticated;
grant select, insert, update, delete on public.warranty_cases to authenticated;
grant select, insert on public.warranty_case_updates to authenticated;
grant usage, select on sequence public.warranty_cases_case_number_seq to authenticated;

create policy warranty_cases_read on public.warranty_cases
for select to authenticated using ((select private.warranty_active_user()));

create policy warranty_cases_create on public.warranty_cases
for insert to authenticated with check (
  (select private.warranty_active_user()) and responsible_id=(select auth.uid())
);

create policy warranty_cases_update on public.warranty_cases
for update to authenticated
using (responsible_id=(select auth.uid()) or (select private.warranty_manager()))
with check (responsible_id=(select auth.uid()) or (select private.warranty_manager()));

create policy warranty_cases_delete on public.warranty_cases
for delete to authenticated using ((select private.warranty_manager()));

create policy warranty_updates_read on public.warranty_case_updates
for select to authenticated using ((select private.warranty_active_user()));

create policy warranty_updates_create on public.warranty_case_updates
for insert to authenticated with check (
  actor_id=(select auth.uid())
  and exists (
    select 1 from public.warranty_cases c
    where c.id=case_id
      and (c.responsible_id=(select auth.uid()) or (select private.warranty_manager()))
  )
);

comment on table public.warranty_cases is 'Warranty cases owned by the user who opens the process.';
comment on table public.warranty_case_updates is 'Immutable warranty status and note history.';
