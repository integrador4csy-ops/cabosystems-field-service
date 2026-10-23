import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { deleteProject, getAssignableStaff, getProjects, getTasksByProject, updateTask } from '../../lib/projectsApi';
import { useSidebar } from '../../context/SidebarContext';
import type { Proyecto, Tarea } from '../../types/projects';
import type { Profile } from '../../types/fleet';
import { TaskWorkspace } from './TaskWorkspace';
import { useSectionResources, type SectionResources } from '../../context/SectionResources';

async function taskSnapshot() {
  const [projects, tasks, staff] = await Promise.all([getProjects(), getTasksByProject(), getAssignableStaff()]);
  return { projects, tasks, staff };
}
export const prefetchTasks = (resources: SectionResources) => resources.queries.load('tasks', taskSnapshot);

export function ProjectsManagementView({ mode = 'tasks' }: { mode?: 'tasks' | 'agenda' }) {
  const { taskSearchQuery, taskCreateVersion } = useSidebar();
  const resources = useSectionResources();
  const cached = resources.queries.read<Awaited<ReturnType<typeof taskSnapshot>>>('tasks');
  const [projects, setProjects] = useState<Proyecto[]>(cached?.projects || []);
  const [tasks, setTasks] = useState<Tarea[]>(cached?.tasks || []);
  const [staff, setStaff] = useState<Profile[]>(cached?.staff || []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const hasLoaded = useRef(Boolean(cached));

  const loadData = useCallback(async (showLoading = false) => {
    if (!showLoading) { resources.queries.invalidate('directory:true'); resources.queries.invalidate('directory:false'); }
    const version = ++requestVersion.current;
    if (showLoading && !hasLoaded.current) setLoading(true);
    try {
      const { projects: nextProjects, tasks: nextTasks, staff: nextStaff } = await resources.queries.load('tasks', taskSnapshot, !showLoading);
      if (version !== requestVersion.current) return;
      setProjects(nextProjects);
      setTasks(nextTasks);
      setStaff(nextStaff);
      hasLoaded.current = true;
      setError(null);
    } catch {
      if (version === requestVersion.current) setError('No se pudieron cargar las tareas. Intenta de nuevo.');
    } finally {
      if (version === requestVersion.current) { setLoading(false); resources.markReady(); }
    }
  }, [resources]);

  useEffect(() => {
    void loadData(true);
    const focus = () => { if (document.visibilityState === 'visible') void loadData(true); };
    window.addEventListener('focus', focus);
    const channel = supabase.channel('task_workspace_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtareas' }, () => void loadData())
      .subscribe();
    return () => { requestVersion.current += 1; window.removeEventListener('focus', focus); void supabase.removeChannel(channel); };
  }, [loadData]);

  const moveTask = async (task: Tarea, status: Tarea['estatus']) => {
    const updated = await updateTask(task.id, { estatus: status });
    resources.queries.invalidate('tasks');
    setTasks((previous) => previous.map((item) => item.id === task.id ? { ...item, ...updated, subtareas: item.subtareas } : item));
  };

  const removeProject = async (project: Proyecto) => {
    await deleteProject(project.id);
    await loadData();
  };

  return <TaskWorkspace mode={mode} projects={projects} tasks={tasks} staff={staff} loading={loading} error={error} searchQuery={taskSearchQuery} createVersion={taskCreateVersion} onReload={loadData} onMoveTask={moveTask} onDeleteProject={removeProject} />;
}
