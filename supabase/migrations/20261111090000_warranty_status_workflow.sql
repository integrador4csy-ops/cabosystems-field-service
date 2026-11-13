-- Warranty cases follow one auditable sequence and end with a final decision.
-- NOT VALID preserves legacy rows while enforcing the two supported management
-- routes on every new or changed record.
alter table public.warranty_cases
  add constraint warranty_cases_management_area_check
  check (area in ('operations', 'supplier')) not valid;

alter table public.warranty_case_updates
  add constraint warranty_updates_management_area_check
  check (area in ('operations', 'supplier')) not valid;

create or replace function private.validate_warranty_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in ('resolved', 'rejected') then
    raise exception 'El caso de garantía ya está cerrado y no se puede modificar'
      using errcode = '22023';
  end if;

  if not (
    (old.status = 'registered' and new.status in ('registered', 'review'))
    or (old.status = 'review' and new.status in ('review', 'waiting'))
    or (old.status = 'waiting' and new.status in ('waiting', 'resolved', 'rejected'))
  ) then
    raise exception 'La transición de estado de garantía no es válida: % → %', old.status, new.status
      using errcode = '22023';
  end if;

  return new;
end;
$$;

create trigger warranty_case_validate_transition
before update on public.warranty_cases
for each row execute function private.validate_warranty_status_transition();

revoke all on function private.validate_warranty_status_transition() from public, anon, authenticated;

comment on function private.validate_warranty_status_transition() is
  'Enforces registered → managing → under review → approved/no warranty, with terminal closure.';
