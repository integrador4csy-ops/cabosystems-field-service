-- Simplify warranty transitions to three operational statuses:
-- Abierto (registered / legacy review) -> En revisión (waiting) -> Cerrado (resolved / legacy rejected).
-- Open cases can also move directly to Cerrado while closed cases remain terminal.
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
    (old.status in ('registered', 'review') and new.status in ('registered', 'waiting', 'resolved', 'rejected'))
    or (old.status = 'waiting' and new.status in ('waiting', 'resolved', 'rejected'))
  ) then
    raise exception 'La transición de estado de garantía no es válida: % → %', old.status, new.status
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists warranty_case_validate_transition on public.warranty_cases;
create trigger warranty_case_validate_transition
before update on public.warranty_cases
for each row execute function private.validate_warranty_status_transition();

revoke all on function private.validate_warranty_status_transition() from public, anon, authenticated;

comment on function private.validate_warranty_status_transition() is
  'Enforces simplified warranty statuses: open (registered/review) → in review (waiting) → closed (resolved/rejected), with terminal closure.';
