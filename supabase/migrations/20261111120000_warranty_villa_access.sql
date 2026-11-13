-- Warranty permissions follow the canonical villa access model. The person who
-- opened the case remains responsible, while every active user who can access
-- that villa can create, read and update its warranty follow-up.
drop policy if exists warranty_cases_read on public.warranty_cases;
create policy warranty_cases_read on public.warranty_cases
for select to authenticated using (
  (select private.warranty_active_user())
  and (
    responsible_id = (select auth.uid())
    or (select private.warranty_manager())
    or (project_id is not null and private.project_visible(project_id))
  )
);

drop policy if exists warranty_cases_create on public.warranty_cases;
create policy warranty_cases_create on public.warranty_cases
for insert to authenticated with check (
  (select private.warranty_active_user())
  and responsible_id = (select auth.uid())
  and project_id is not null
  and private.project_visible(project_id)
);

drop policy if exists warranty_cases_update on public.warranty_cases;
create policy warranty_cases_update on public.warranty_cases
for update to authenticated
using (
  (select private.warranty_active_user())
  and (
    responsible_id = (select auth.uid())
    or (select private.warranty_manager())
    or (project_id is not null and private.project_visible(project_id))
  )
)
with check (
  (select private.warranty_active_user())
  and (
    responsible_id = (select auth.uid())
    or (select private.warranty_manager())
    or (project_id is not null and private.project_visible(project_id))
  )
);

drop policy if exists warranty_updates_read on public.warranty_case_updates;
create policy warranty_updates_read on public.warranty_case_updates
for select to authenticated using (
  (select private.warranty_active_user())
  and exists (
    select 1 from public.warranty_cases c where c.id = case_id
  )
);

drop policy if exists warranty_updates_create on public.warranty_case_updates;
create policy warranty_updates_create on public.warranty_case_updates
for insert to authenticated with check (
  actor_id = (select auth.uid())
  and exists (
    select 1 from public.warranty_cases c
    where c.id = case_id
      and (
        c.responsible_id = (select auth.uid())
        or (select private.warranty_manager())
        or (c.project_id is not null and private.project_visible(c.project_id))
      )
  )
);

comment on policy warranty_cases_update on public.warranty_cases is
  'Responsible users, managers and active users with canonical villa access can update open warranty cases.';
