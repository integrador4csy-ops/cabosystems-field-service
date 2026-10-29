create table public.agenda_calendar_colors (
  user_id uuid not null references public.profiles(id) on delete cascade,
  calendar_id text not null check (char_length(calendar_id) between 1 and 1024),
  color text not null check (color ~ '^#[0-9a-fA-F]{6}$'),
  primary key (user_id, calendar_id)
);
alter table public.agenda_calendar_colors enable row level security;
revoke all on public.agenda_calendar_colors from public, anon;
grant select, insert, update, delete on public.agenda_calendar_colors to authenticated;
create policy personal_calendar_colors on public.agenda_calendar_colors for all to authenticated
  using (user_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and activo = true))
  with check (user_id = (select auth.uid()) and exists (select 1 from public.profiles where id = (select auth.uid()) and activo = true));

