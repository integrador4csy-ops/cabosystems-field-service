-- Progress follows every explicitly granted villa access scope.
-- The assignee remains informational; content editing keeps its separate role check.
create or replace function private.task_progress_member(project_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select private.project_visible(project_id);
$$;
