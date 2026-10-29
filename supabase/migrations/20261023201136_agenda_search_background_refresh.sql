-- Refresh under a background lease before the 30-second read authorization expires.
create or replace function public.agenda_search_claim(p_revision uuid, p_calendar text, p_role text, p_name text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.agenda_google_search_state; l uuid;
begin
  if not exists(select 1 from public.google_calendar_connection where revision=p_revision) then raise exception 'Calendar selection changed'; end if;
  insert into public.agenda_google_search_state(revision,calendar_id) values(p_revision,p_calendar) on conflict do nothing;
  select * into s from public.agenda_google_search_state where revision=p_revision and calendar_id=p_calendar for update;
  if s.lease_until > now() then
    return jsonb_build_object('lease',null,'ready',s.sync_token is not null and s.access_role=p_role and s.calendar_name=p_name,'token',null);
  end if;
  if s.sync_token is not null and s.access_role=p_role and s.calendar_name=p_name and s.synced_at > now()-interval '20 seconds' then
    return jsonb_build_object('lease',null,'ready',true,'token',null);
  end if;
  l := gen_random_uuid();
  update public.agenda_google_search_state set lease=l,lease_until=now()+interval '120 seconds',lease_version=invalidate_count where revision=p_revision and calendar_id=p_calendar;
  return jsonb_build_object('lease',l,'ready',false,'token',case when s.access_role=p_role then s.sync_token else null end);
end;
$$;

