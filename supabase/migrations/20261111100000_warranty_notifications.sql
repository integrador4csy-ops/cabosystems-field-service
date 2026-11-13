-- Warranty follow-up notifications use the shared in-app notification center.
alter table public.app_notifications
  drop constraint if exists app_notifications_kind_check;

alter table public.app_notifications
  add constraint app_notifications_kind_check
  check (kind in ('task_assigned', 'field_check', 'chat_message', 'warranty_update', 'system'));

comment on constraint app_notifications_kind_check on public.app_notifications is
  'Supported notification renderers across web and mobile clients.';
