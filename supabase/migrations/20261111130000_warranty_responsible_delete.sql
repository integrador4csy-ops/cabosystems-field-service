-- The user who opened a warranty case may remove it. Managers retain their
-- existing delete permission. Villa access alone does not grant deletion.
drop policy if exists warranty_cases_delete on public.warranty_cases;
create policy warranty_cases_delete on public.warranty_cases
for delete to authenticated using (
  (select private.warranty_active_user())
  and (
    responsible_id = (select auth.uid())
    or (select private.warranty_manager())
  )
);

comment on policy warranty_cases_delete on public.warranty_cases is
  'Only the responsible user who opened the case or a warranty manager may delete it.';
