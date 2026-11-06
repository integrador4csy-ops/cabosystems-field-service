-- Covers the activity actor foreign key reported by the database advisor.
create index warranty_case_updates_actor_idx on public.warranty_case_updates(actor_id);
