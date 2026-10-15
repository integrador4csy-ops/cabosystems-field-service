import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { deleteProject, getAssignableStaff, getProjects, getTasksByProject, updateTask } from '../../lib/projectsApi';
import { useSidebar } from '../../context/SidebarContext';
import type { Proyecto, Tarea } from '../../types/projects';
import type { Profile } from '../../types/fleet';
import { TaskWorkspace } from './TaskWorkspace';

export function ProjectsManagementView({ mode = 'tasks' }: { mode?: 'tasks' | 'agenda' }) {
  const { taskSearchQuery, taskCreateVersion } = useSidebar();
  const [projects, setProjects] = useState<Proyecto[]>([]);
  const [tasks, setTasks] = useState<Tarea[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const loadData = useCallback(async (showLoading = false) => {
    const version = ++requestVersion.current;
    if (showLoading) setLoading(true);
    try {
      const [nextProjects, nextTasks, nextStaff] = await Promise.all([getProjects(), getTasksByProject(), getAssignableStaff()]);
      if (version !== requestVersion.current) return;
      setProjects(nextProjects);
      setTasks(nextTasks);
      setStaff(nextStaff);
      setError(null);
    } catch {
      if (version === requestVersion.current) setError('No se pudieron cargar las tareas. Intenta de nuevo.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true);
    const channel = supabase.channel('task_workspace_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyectos' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tareas' }, () => void loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subtareas' }, () => void loadData())
      .subscribe();
    return () => { requestVersion.current += 1; void supabase.removeChannel(channel); };
  }, [loadData]);

  const moveTask = async (task: Tarea, status: Tarea['estatus']) => {
    const updated = await updateTask(task.id, { estatus: status });
    setTasks((previous) => previous.map((item) => item.id === task.id ? { ...item, ...updated, subtareas: item.subtareas } : item));
  };

  const removeProject = async (project: Proyecto) => {
    await deleteProject(project.id);
    await loadData();
  };

  return <TaskWorkspace mode={mode} projects={projects} tasks={tasks} staff={staff} loading={loading} error={error} searchQuery={taskSearchQuery} createVersion={taskCreateVersion} onReload={loadData} onMoveTask={moveTask} onDeleteProject={removeProject} />;
}
