-- Local search stays under existing RLS. Google documents/tokens are server-only.
create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

create function public.agenda_search_normalize(value text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select regexp_replace(normalize(lower(coalesce(value, '')), NFD), U&'[\0300-\036f]', '', 'g');
$$;
create function public.agenda_search_pattern(value text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select '%' || replace(replace(replace(value, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
$$;
revoke all on function public.agenda_search_normalize(text), public.agenda_search_pattern(text) from public, anon;
grant execute on function public.agenda_search_normalize(text), public.agenda_search_pattern(text) to authenticated, service_role;

alter table public.agenda_eventos add column search_text text not null default '';
create function public.agenda_search_local_document() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.search_text := public.agenda_search_normalize(concat_ws(' ', new.titulo, new.descripcion, new.ubicacion, 'CaboSystems'));
  return new;
end;
$$;
revoke all on function public.agenda_search_local_document() from public, anon, authenticated;
create trigger agenda_search_local_document before insert or update on public.agenda_eventos
for each row execute function public.agenda_search_local_document();
update public.agenda_eventos set search_text = public.agenda_search_normalize(concat_ws(' ', titulo, descripcion, ubicacion, 'CaboSystems'));
create index agenda_eventos_search_idx on public.agenda_eventos using gin(search_text extensions.gin_trgm_ops);

create function public.agenda_search_local(p_query text, p_offset integer default 0, p_limit integer default 500)
returns setof public.agenda_eventos language sql stable security invoker set search_path = '' as $$
  with terms as (
    select regexp_split_to_array(trim(public.agenda_search_normalize(p_query)), E'\\s+') as words
    where length(trim(p_query)) between 1 and 160 and p_offset >= 0 and p_limit between 1 and 500
  ), pattern as (
    select words, public.agenda_search_pattern((select term from unnest(words) term order by length(term) desc, term limit 1)) as longest from terms
  )
  select e.* from public.agenda_eventos e cross join pattern p
  where e.search_text like p.longest
    and not exists(select 1 from unnest(p.words) term where strpos(e.search_text, term) = 0)
  order by e.id limit least(greatest(p_limit, 1), 500) offset greatest(p_offset, 0);
$$;
revoke all on function public.agenda_search_local(text, integer, integer) from public, anon;
grant execute on function public.agenda_search_local(text, integer, integer) to authenticated;

create table public.agenda_google_search_state (
  revision uuid not null,
  calendar_id text not null,
  calendar_name text not null default '',
  access_role text not null default '',
  sync_token text,
  synced_at timestamptz,
  lease uuid,
  lease_until timestamptz,
  invalidate_count bigint not null default 0,
  lease_version bigint,
  primary key(revision, calendar_id)
);
create table public.agenda_google_search_documents (
  revision uuid not null,
  calendar_id text not null,
  event_id text not null,
  payload jsonb not null,
  search_text text not null,
  primary key(revision, calendar_id, event_id),
  foreign key(revision, calendar_id) references public.agenda_google_search_state(revision, calendar_id) on delete cascade
);
create index agenda_google_search_text_idx on public.agenda_google_search_documents using gin(search_text extensions.gin_trgm_ops);
alter table public.agenda_google_search_state enable row level security;
alter table public.agenda_google_search_documents enable row level security;
revoke all on public.agenda_google_search_state, public.agenda_google_search_documents from public, anon, authenticated;
grant select, insert, update, delete on public.agenda_google_search_state, public.agenda_google_search_documents to service_role;

create function public.agenda_search_claim(p_revision uuid, p_calendar text, p_role text, p_name text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.agenda_google_search_state; l uuid;
begin
  if not exists(select 1 from public.google_calendar_connection where revision=p_revision) then raise exception 'Calendar selection changed'; end if;
  insert into public.agenda_google_search_state(revision,calendar_id) values(p_revision,p_calendar) on conflict do nothing;
  select * into s from public.agenda_google_search_state where revision=p_revision and calendar_id=p_calendar for update;
  if s.lease_until > now() then
    return jsonb_build_object('lease',null,'ready',s.sync_token is not null and s.access_role=p_role and s.calendar_name=p_name,'token',null);
  end if;
  if s.sync_token is not null and s.access_role=p_role and s.calendar_name=p_name and s.synced_at > now()-interval '30 seconds' then
    return jsonb_build_object('lease',null,'ready',true,'token',null);
  end if;
  l := gen_random_uuid();
  update public.agenda_google_search_state set lease=l,lease_until=now()+interval '120 seconds',lease_version=invalidate_count where revision=p_revision and calendar_id=p_calendar;
  return jsonb_build_object('lease',l,'ready',false,'token',case when s.access_role=p_role then s.sync_token else null end);
end;
$$;

create function public.agenda_search_commit(p_revision uuid,p_calendar text,p_lease uuid,p_role text,p_name text,p_token text,p_full boolean,p_items jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
declare s public.agenda_google_search_state;
begin
  -- Serialize with connection replacement so old workers cannot recreate an old index.
  perform 1 from public.google_calendar_connection where revision=p_revision for share;
  if not found then raise exception 'Calendar selection changed'; end if;
  select * into s from public.agenda_google_search_state where revision=p_revision and calendar_id=p_calendar for update;
  if not found or s.lease is distinct from p_lease or s.lease_until <= now() then raise exception 'Search sync lease expired'; end if;
  if p_token is null or length(p_token)=0 or jsonb_typeof(p_items)<>'array' then raise exception 'Invalid sync response'; end if;
  if p_full then delete from public.agenda_google_search_documents where revision=p_revision and calendar_id=p_calendar; end if;
  delete from public.agenda_google_search_documents d using jsonb_array_elements(p_items) item
    where d.revision=p_revision and d.calendar_id=p_calendar and (d.event_id=item->>'id' or d.payload->>'recurringEventId'=item->>'id') and item->>'status'='cancelled';
  insert into public.agenda_google_search_documents(revision,calendar_id,event_id,payload,search_text)
    select p_revision,p_calendar,item->>'id',item,
      public.agenda_search_normalize(concat_ws(' ',item->>'summary',item->>'description',item->>'location',p_name))
    from jsonb_array_elements(p_items) item where item->>'status' is distinct from 'cancelled'
      and not exists(select 1 from jsonb_array_elements(p_items) parent where parent->>'status'='cancelled' and parent->>'id'=item->>'recurringEventId')
    on conflict(revision,calendar_id,event_id) do update set payload=excluded.payload,search_text=excluded.search_text;
  if s.calendar_name is distinct from p_name then
    update public.agenda_google_search_documents set search_text=public.agenda_search_normalize(concat_ws(' ',payload->>'summary',payload->>'description',payload->>'location',p_name)) where revision=p_revision and calendar_id=p_calendar;
  end if;
  update public.agenda_google_search_state set sync_token=p_token,synced_at=case when invalidate_count=lease_version then now() else null end,access_role=p_role,calendar_name=p_name,lease=null,lease_until=null where revision=p_revision and calendar_id=p_calendar;
end;
$$;
create function public.agenda_search_release(p_revision uuid,p_calendar text,p_lease uuid)
returns void language sql security invoker set search_path = '' as $$
  update public.agenda_google_search_state set lease=null,lease_until=null where revision=p_revision and calendar_id=p_calendar and lease=p_lease;
$$;
create function public.agenda_search_invalidate(p_revision uuid,p_calendar text)
returns void language sql security invoker set search_path = '' as $$
  update public.agenda_google_search_state set synced_at=null,invalidate_count=invalidate_count+1 where revision=p_revision and calendar_id=p_calendar;
$$;
create function public.agenda_search_google(p_revision uuid,p_calendars jsonb,p_query text,p_offset integer default 0,p_limit integer default 500)
returns table(calendar_id text,payload jsonb) language sql stable security invoker set search_path = '' as $$
  with terms as (
    select regexp_split_to_array(trim(public.agenda_search_normalize(p_query)), E'\\s+') words
    where length(trim(p_query)) between 1 and 160 and p_offset>=0 and p_limit between 1 and 500
  ), pattern as (
    select words,public.agenda_search_pattern((select term from unnest(words) term order by length(term) desc,term limit 1)) longest from terms
  )
  select d.calendar_id,d.payload from public.agenda_google_search_documents d
  join public.agenda_google_search_state s using(revision,calendar_id)
  cross join pattern p
  where d.revision=p_revision and s.sync_token is not null
    and exists(select 1 from public.google_calendar_connection c where c.revision=p_revision)
    and exists(select 1 from jsonb_array_elements(p_calendars) c where c->>'id'=d.calendar_id and c->>'accessRole'=s.access_role and c->>'name'=s.calendar_name)
    and d.search_text like p.longest
    and not exists(select 1 from unnest(p.words) term where strpos(d.search_text,term)=0)
  order by d.calendar_id,d.event_id limit least(greatest(p_limit,1),500) offset greatest(p_offset,0);
$$;

create function public.agenda_search_clear_old_connection() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.agenda_google_search_state where revision<>new.revision;
  return new;
end;
$$;
create trigger agenda_search_connection_changed after update of revision on public.google_calendar_connection
for each row when(old.revision is distinct from new.revision) execute function public.agenda_search_clear_old_connection();
revoke all on function public.agenda_search_clear_old_connection() from public,anon,authenticated;

revoke all on function public.agenda_search_claim(uuid,text,text,text),public.agenda_search_commit(uuid,text,uuid,text,text,text,boolean,jsonb),public.agenda_search_release(uuid,text,uuid),public.agenda_search_invalidate(uuid,text),public.agenda_search_google(uuid,jsonb,text,integer,integer) from public,anon,authenticated;
grant execute on function public.agenda_search_claim(uuid,text,text,text),public.agenda_search_commit(uuid,text,uuid,text,text,text,boolean,jsonb),public.agenda_search_release(uuid,text,uuid),public.agenda_search_invalidate(uuid,text),public.agenda_search_google(uuid,jsonb,text,integer,integer) to service_role;
