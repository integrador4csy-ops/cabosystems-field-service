-- Replies can only reference a message in the same conversation.
alter table public.chat_mensajes
  add column reply_to_id uuid,
  add constraint chat_mensajes_id_grupo_unique unique (id, grupo_id),
  add constraint chat_mensajes_reply_not_self check (reply_to_id is distinct from id),
  add constraint chat_mensajes_reply_to_id_fkey
    foreign key (reply_to_id, grupo_id) references public.chat_mensajes(id, grupo_id)
    on delete set null (reply_to_id);
create index chat_mensajes_reply_to_idx on public.chat_mensajes(reply_to_id) where reply_to_id is not null;

create table public.chat_pins (
  mensaje_id uuid primary key,
  grupo_id uuid not null references public.chat_grupos(id) on delete cascade,
  pinned_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint chat_pins_message_group_fkey foreign key (mensaje_id, grupo_id)
    references public.chat_mensajes(id, grupo_id) on delete cascade
);
create index chat_pins_group_idx on public.chat_pins(grupo_id, created_at desc);
create index chat_pins_profile_idx on public.chat_pins(pinned_by);
alter table public.chat_pins enable row level security;
revoke all on public.chat_pins from anon;
grant select, insert, delete on public.chat_pins to authenticated;
create policy chat_pins_read on public.chat_pins for select to authenticated
  using (public.check_is_group_member(grupo_id, (select auth.uid())));
create policy chat_pins_create on public.chat_pins for insert to authenticated
  with check (pinned_by = (select auth.uid()) and public.check_is_group_member(grupo_id, (select auth.uid())));
create policy chat_pins_remove on public.chat_pins for delete to authenticated
  using (public.check_is_group_member(grupo_id, (select auth.uid())) and
    (pinned_by = (select auth.uid()) or public.check_is_group_admin(grupo_id, (select auth.uid()))));
alter publication supabase_realtime add table public.chat_pins;
notify pgrst, 'reload schema';
