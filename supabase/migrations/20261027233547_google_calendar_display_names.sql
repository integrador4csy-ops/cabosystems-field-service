-- Display configuration only. Calendar IDs, selections, OAuth tokens and RLS remain unchanged.
alter table public.google_calendar_connection
  add column if not exists calendar_aliases jsonb not null default '{}'::jsonb
  check (jsonb_typeof(calendar_aliases) = 'object');
