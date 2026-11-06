set local lock_timeout = '5s';

create table if not exists public.app_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('task_assigned', 'field_check', 'chat_message', 'system')),
  title text not null,
  body text not null,
  target text,
  target_id uuid,
  event_key text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, event_key)
);

create index if not exists app_notifications_user_created_idx
  on public.app_notifications (user_id, created_at desc);

alter table public.app_notifications enable row level security;

drop policy if exists "Users read their notifications" on public.app_notifications;
create policy "Users read their notifications"
  on public.app_notifications for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users update their notifications" on public.app_notifications;
create policy "Users update their notifications"
  on public.app_notifications for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on table public.app_notifications from public, anon;
grant select, update on table public.app_notifications to authenticated;
grant all on table public.app_notifications to service_role;

alter publication supabase_realtime add table public.app_notifications;

comment on table public.app_notifications is
  'Shared in-app notification history for mobile and web.';
