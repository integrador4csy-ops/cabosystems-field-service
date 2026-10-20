-- Server-only OAuth state and credentials. These tables are not client APIs.
create table public.google_calendar_connection (
  id boolean primary key default true check (id),
  revision uuid not null default gen_random_uuid(),
  refresh_token_ciphertext text,
  connected_by uuid references public.profiles(id) on delete set null,
  account_label text,
  selected_calendars jsonb not null default '[]'::jsonb
    check (jsonb_typeof(selected_calendars) = 'array' and jsonb_array_length(selected_calendars) <= 100),
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.google_calendar_connection (id) values (true);

create table public.google_calendar_oauth_states (
  state_hash text primary key check (state_hash ~ '^[a-f0-9]{64}$'),
  admin_id uuid not null references public.profiles(id) on delete cascade,
  base_revision uuid not null,
  verifier_ciphertext text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index google_calendar_oauth_states_expires_idx on public.google_calendar_oauth_states(expires_at);
create index google_calendar_oauth_states_admin_idx on public.google_calendar_oauth_states(admin_id);

alter table public.google_calendar_connection enable row level security;
alter table public.google_calendar_oauth_states enable row level security;
revoke all on public.google_calendar_connection, public.google_calendar_oauth_states from public, anon, authenticated;
grant select, insert, update, delete on public.google_calendar_connection, public.google_calendar_oauth_states to service_role;
-- No authenticated policies: only the Edge Functions' service client can access
-- these rows after checking the caller against an active canonical admin profile.
