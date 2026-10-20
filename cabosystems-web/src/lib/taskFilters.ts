import type { Proyecto, Tarea } from '../types/projects';

export interface TaskFilters {
  query: string;
  development: string;
  project: string;
  assignee: string;
  status: string;
}

export function countTaskStatuses(tasks: Tarea[], schedule: 'all' | 'scheduled' | 'unscheduled' = 'all') {
  const counts = { all: 0, pendiente: 0, en_proceso: 0, completada: 0 };
  for (const task of tasks) {
    if (schedule === 'scheduled' && !task.fecha_programada) continue;
    if (schedule === 'unscheduled' && task.fecha_programada) continue;
    counts.all++;
    counts[task.estatus]++;
  }
  return counts;
}

export function filterWorkspaceTasks(tasks: Tarea[], projects: Proyecto[], filters: TaskFilters): Tarea[] {
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const query = filters.query.trim().toLocaleLowerCase();
  return tasks.filter((task) => {
    const project = projectMap.get(task.proyecto_id);
    if (filters.development !== 'all' && project?.desarrollo !== filters.development) return false;
    if (filters.project !== 'all' && task.proyecto_id !== filters.project) return false;
    if (filters.assignee === 'unassigned' && task.asignado_a) return false;
    if (filters.assignee !== 'all' && filters.assignee !== 'unassigned' && task.asignado_a !== filters.assignee) return false;
    if (filters.status !== 'all' && task.estatus !== filters.status) return false;
    return !query || [task.titulo, task.descripcion, task.profiles?.nombre, project?.villa, project?.desarrollo].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
  });
}
