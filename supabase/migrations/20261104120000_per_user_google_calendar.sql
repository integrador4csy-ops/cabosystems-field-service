-- Each active profile owns an isolated Google Calendar connection.
-- OAuth credentials remain server-only; clients continue through Edge Functions.
delete from public.google_calendar_oauth_states;

alter table public.google_calendar_oauth_states
  rename column admin_id to user_id;

alter table public.google_calendar_connection
  add column user_id uuid references public.profiles(id) on delete cascade;

update public.google_calendar_connection
set user_id = connected_by
where connected_by is not null;

-- A legacy unowned placeholder has no credentials that can safely be assigned.
delete from public.google_calendar_connection where user_id is null;

alter table public.google_calendar_connection
  drop constraint google_calendar_connection_pkey,
  drop constraint google_calendar_connection_id_check,
  alter column user_id set not null,
  add primary key (user_id),
  drop column id;

-- Updating one user's selection must invalidate only that user's old index.
create or replace function public.agenda_search_clear_old_connection() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.agenda_google_search_state where revision = old.revision;
  return new;
end;
$$;

-- Defense in depth: these tables remain inaccessible to browser/mobile roles.
revoke all on public.google_calendar_connection, public.google_calendar_oauth_states
  from public, anon, authenticated;
grant select, insert, update, delete on public.google_calendar_connection, public.google_calendar_oauth_states
  to service_role;
