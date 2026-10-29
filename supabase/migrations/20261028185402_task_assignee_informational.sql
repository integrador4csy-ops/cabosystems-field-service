-- Task assignment tracks responsibility only; villa membership is managed explicitly.
drop trigger tareas_project_member on public.tareas;
drop function private.task_project_member();
