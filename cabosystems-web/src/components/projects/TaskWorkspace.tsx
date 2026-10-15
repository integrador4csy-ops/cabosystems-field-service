import { AppSelect } from '../ui/AppSelect';
import { useSidebar } from '../../context/SidebarContext';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Building2, Columns3, List, Loader2, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { dateKey } from '../../lib/taskDates';
import { filterWorkspaceTasks } from '../../lib/taskFilters';
import type { Proyecto, Tarea } from '../../types/projects';
import type { Profile } from '../../types/fleet';
import { CreateProjectModal } from './CreateProjectModal';
import { CreateTaskModal } from './CreateTaskModal';
import { ProjectCatalog } from './ProjectCatalog';
import { TaskAgenda } from './TaskAgenda';
import type { AgendaView } from './TaskAgenda';
import { TaskBoard } from './TaskBoard';
import { TaskCard } from './TaskCard';
import './TaskWorkspace.css';

const statusOptions = [
  { value: 'all', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'completada', label: 'Completadas' },
] as const;

interface TaskWorkspaceProps {
  mode: 'tasks' | 'agenda';
  projects: Proyecto[];
  tasks: Tarea[];
  staff: Profile[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  createVersion: number;
  onReload: () => Promise<void>;
  onMoveTask: (task: Tarea, status: Tarea['estatus']) => Promise<void>;
  onDeleteProject: (project: Proyecto) => Promise<void>;
}

export function TaskWorkspace({ mode, projects, tasks, staff, loading, error, searchQuery, createVersion, onReload, onMoveTask, onDeleteProject }: TaskWorkspaceProps) {
  const { t } = useTranslation();
  const { setActiveItem } = useSidebar();
  const [development, setDevelopment] = useState('all');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filterId = useId();
  const [projectId, setProjectId] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState<'board' | 'list'>(() => { try { return localStorage.getItem('csy_task_view') === 'list' ? 'list' : 'board'; } catch { return 'board'; } });
  const [expanded, setExpanded] = useState(new Set<string>());
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Proyecto | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Tarea | null>(null);
  const [agendaDate, setAgendaDate] = useState(dateKey(new Date()));
  const [agendaView, setAgendaView] = useState<AgendaView>('month');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seenCreateVersion = useRef(createVersion);
  const developments = useMemo(() => [...new Set(projects.map((project) => project.desarrollo))].sort((a, b) => a.localeCompare(b)), [projects]);
  const availableProjects = useMemo(() => projects.filter((project) => development === 'all' || project.desarrollo === development), [projects, development]);
  const projectLabels = useMemo(() => Object.fromEntries(projects.map((project) => [project.id, `${project.desarrollo} · ${project.villa}`])), [projects]);
  // A removed project no longer constrains the view after a realtime update.
  const effectiveProject = projects.some((project) => project.id === projectId) ? projectId : 'all';
  const showStatusFilters = mode === 'agenda' || view === 'list';
  const activeFilterCount = [development, effectiveProject, assignee].filter((value) => value !== 'all').length;
  const matchingTasks = useMemo(() => filterWorkspaceTasks(tasks, projects, { query: searchQuery, development, project: effectiveProject, assignee, status: 'all' }), [tasks, projects, searchQuery, development, effectiveProject, assignee]);
  const visible = useMemo(() => !showStatusFilters || status === 'all' ? matchingTasks : matchingTasks.filter((task) => task.estatus === status), [matchingTasks, showStatusFilters, status]);
  const statusCounts = useMemo(() => {
    const counts = { all: matchingTasks.length, pendiente: 0, en_proceso: 0, completada: 0 };
    for (const task of matchingTasks) counts[task.estatus]++;
    return counts;
  }, [matchingTasks]);
  const modalProject = projects.find((project) => project.id === taskToEdit?.proyecto_id) || projects.find((project) => project.id === effectiveProject) || availableProjects[0] || projects[0];

  useEffect(() => {
    if (seenCreateVersion.current === createVersion || loading) return;
    seenCreateVersion.current = createVersion;
    setTaskToEdit(null);
    if (projects.length) setTaskModalOpen(true);
    else { setProjectToEdit(null); setProjectModalOpen(true); }
  }, [createVersion, loading, projects.length]);

  const toggleExpand = (id: string) => setExpanded((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const editTask = (task: Tarea) => { setTaskToEdit(task); setTaskModalOpen(true); };
  const changeView = (next: 'board' | 'list') => { setView(next); try { localStorage.setItem('csy_task_view', next); } catch { /* Storage is optional. */ } };
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setActionError(null);
    try { await onReload(); } finally { setRefreshing(false); }
  };
  const deleteVilla = async (project: Proyecto) => {
    if (deletingId || !window.confirm(t('¿Eliminar la villa "{value0}" en "{value1}"? Se eliminarán también todas sus tareas y subtareas.', { value0: project.villa, value1: project.desarrollo }))) return;
    setDeletingId(project.id);
    setActionError(null);
    try { await onDeleteProject(project); } catch { setActionError('No se pudo eliminar la villa. Intenta de nuevo.'); } finally { setDeletingId(null); }
  };

  return <section className="task-workspace operational-panel" aria-label={mode === 'agenda' ? t('sidebar.agenda') : t('sidebar.projects')}>
    <div className="workspace-filterbar"><div id={filterId} className={`workspace-filters ${mobileFiltersOpen ? 'is-open' : ''}`}>
      <label>{t('Desarrollo')}<AppSelect aria-label={t('Desarrollo')} value={development} onChange={(event) => { setDevelopment(event.target.value); setProjectId('all'); }}><option value="all">{t('Todos los desarrollos')}</option>{developments.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></label>
      <label>{t('Villa')}<AppSelect aria-label={t('Villa')} value={effectiveProject} onChange={(event) => setProjectId(event.target.value)}><option value="all">{t('Todas las villas')}</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.villa}</option>)}</AppSelect></label>
      <label>{t('Responsable')}<AppSelect aria-label={t('Responsable')} value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="all">{t('Todos los responsables')}</option><option value="unassigned">{t('Sin asignar')}</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.nombre || person.full_name || person.email}</option>)}</AppSelect></label>
    </div><div className="workspace-tools"><button type="button" className="workspace-button workspace-mobile-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls={filterId} onClick={() => setMobileFiltersOpen((previous) => !previous)}><SlidersHorizontal size={15} aria-hidden="true" />{t('Filtros')}{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button><button type="button" className="workspace-button" onClick={() => setActiveItem('directorio-proyectos')}><Building2 size={15} aria-hidden="true" />{t('Villas')}</button><button type="button" className="workspace-icon" aria-label={t('Recargar datos')} disabled={loading || refreshing} onClick={() => void refresh()}><RefreshCw size={15} className={loading || refreshing ? 'animate-spin' : ''} /></button></div></div>
    {(error || actionError) && <div role="alert" className="workspace-error">{t(error || actionError || '')}<button type="button" disabled={refreshing} onClick={() => void refresh()}>{t('Reintentar')}</button></div>}
    {mode === 'tasks' && <div className="workspace-toolbar"><div className="workspace-view-switch" role="group" aria-label={t('Vista de tareas')}><button type="button" aria-pressed={view === 'board'} onClick={() => changeView('board')}><Columns3 size={16} />{t('Tablero')}</button><button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}><List size={16} />{t('Lista')}</button></div><span className="workspace-count">{visible.length} {t(visible.length === 1 ? 'tarea' : 'tareas')}</span></div>}
    {showStatusFilters && <div className="workspace-status-tabs" role="group" aria-label={t('Estado')}>
      {statusOptions.map((option) => <button key={option.value} type="button" aria-pressed={status === option.value} onClick={() => setStatus(option.value)}>{t(option.label)}<span>{statusCounts[option.value]}</span></button>)}
    </div>}
    {loading ? <div className="workspace-empty" role="status"><Loader2 size={24} className="animate-spin" /><p>{t('Cargando tareas...')}</p></div>
      : mode === 'agenda' ? <TaskAgenda tasks={visible} projectLabels={projectLabels} expandedTaskIds={expanded} onToggleExpand={toggleExpand} onTaskUpdated={() => void onReload()} onEditTask={editTask} selectedDate={agendaDate} view={agendaView} onDateChange={setAgendaDate} onViewChange={setAgendaView} />
      : view === 'board' ? <TaskBoard tasks={visible} projectLabels={projectLabels} showSearch={false} expandedTaskIds={expanded} onToggleExpand={toggleExpand} onTaskUpdated={() => void onReload()} onEditTask={editTask} onMoveTask={onMoveTask} />
      : <div className="workspace-task-list">{visible.length ? visible.map((task) => <TaskCard key={task.id} task={task} projectLabel={projectLabels[task.proyecto_id]} isExpanded={expanded.has(task.id)} onToggleExpand={() => toggleExpand(task.id)} onTaskUpdated={() => void onReload()} onEditTask={editTask} />) : <p className="workspace-empty">{t('No hay tareas que coincidan con los filtros.')}</p>}</div>}
    <ProjectCatalog open={catalogOpen} projects={projects} onClose={() => setCatalogOpen(false)} onSelect={(project) => { setDevelopment(project.desarrollo); setProjectId(project.id); }} onCreate={() => { setProjectToEdit(null); setProjectModalOpen(true); }} onEdit={(project) => { setProjectToEdit(project); setProjectModalOpen(true); }} onDelete={(project) => void deleteVilla(project)} deletingId={deletingId} error={actionError} />
    <CreateProjectModal isOpen={projectModalOpen} onClose={() => setProjectModalOpen(false)} onSuccess={() => void onReload()} existingDesarrollos={developments} projectToEdit={projectToEdit} defaultDesarrollo={development} />
    {modalProject && <CreateTaskModal isOpen={taskModalOpen} onClose={() => setTaskModalOpen(false)} onSuccess={() => void onReload()} project={modalProject} projects={projects} defaultDate={mode === 'agenda' && agendaView !== 'unscheduled' ? agendaDate : undefined} taskToEdit={taskToEdit} staffList={staff} />}
  </section>;
}
