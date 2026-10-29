import type { Proyecto, Tarea } from '../types/projects';

export function sortWorkspaceTasks(tasks: Tarea[], direction: 'asc' | 'desc', locale: string) {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  return [...tasks].sort((a, b) => collator.compare(a.titulo, b.titulo) * (direction === 'desc' ? -1 : 1));
}

export interface TaskFilters {
  query: string;
  development: string;
  project: string;
  assignee: string;
  status: string;
  searchAllProjects?: boolean;
}

/** Global search discovers locations, but the workspace always shows one villa. */
export function taskVillaScope(projects: Proyecto[], matches: Tarea[], query: string, preferredId: string) {
  const preferred = projects.find(project => project.id === preferredId);
  if (!query.trim()) return preferred ?? projects[0];
  const location = taskSearchLocation(projects, matches, query);
  if (location.projectId !== 'all') return projects.find(project => project.id === location.projectId);
  const matchingIds = new Set(matches.map(task => task.proyecto_id));
  const candidates = projects.filter(project => matchingIds.has(project.id) && (location.development === 'all' || project.desarrollo === location.development));
  if (candidates.length) return candidates.find(project => project.id === preferredId) ?? candidates[0];
  return projects.find(project => project.desarrollo === location.development) ?? preferred ?? projects[0];
}

/** Reflect an unambiguous search location without changing the saved filters. */
export function taskSearchLocation(projects: Proyecto[], tasks: Tarea[], query: string) {
  const text = query.trim().toLocaleLowerCase();
  const all = { development: 'all', projectId: 'all' };
  if (!text) return all;
  const namedDevelopments = [...new Set(projects.filter(project => project.desarrollo.toLocaleLowerCase().includes(text)).map(project => project.desarrollo))];
  if (namedDevelopments.length === 1) return { development: namedDevelopments[0], projectId: 'all' };
  const namedVillas = projects.filter(project => project.villa.toLocaleLowerCase().includes(text));
  if (namedVillas.length === 1) return { development: namedVillas[0].desarrollo, projectId: namedVillas[0].id };
  if (namedDevelopments.length || namedVillas.length) return all;
  const matchingIds = new Set(tasks.map(task => task.proyecto_id));
  const matchingProjects = projects.filter(project => matchingIds.has(project.id));
  if (matchingProjects.length === 1) return { development: matchingProjects[0].desarrollo, projectId: matchingProjects[0].id };
  const matchingDevelopments = [...new Set(matchingProjects.map(project => project.desarrollo))];
  return matchingDevelopments.length === 1 ? { development: matchingDevelopments[0], projectId: 'all' } : all;
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
  const globalSearch = Boolean(query && filters.searchAllProjects);
  return tasks.filter((task) => {
    const project = projectMap.get(task.proyecto_id);
    if (!globalSearch && filters.development !== 'all' && project?.desarrollo !== filters.development) return false;
    if (!globalSearch && filters.project !== 'all' && task.proyecto_id !== filters.project) return false;
    if (filters.assignee === 'unassigned' && task.asignado_a) return false;
    if (filters.assignee !== 'all' && filters.assignee !== 'unassigned' && task.asignado_a !== filters.assignee) return false;
    if (filters.status !== 'all' && task.estatus !== filters.status) return false;
    return !query || [task.titulo, task.descripcion, task.profiles?.nombre, project?.villa, project?.desarrollo].filter(Boolean).join(' ').toLocaleLowerCase().includes(query);
  });
}
