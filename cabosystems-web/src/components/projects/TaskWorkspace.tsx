import { AppSelect } from '../ui/AppSelect';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronRight, Columns3, Download, List, Loader2, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useSessionPreference } from '../../hooks/useSessionPreference';
import { isStringPreference } from '../../lib/sessionPreferences';
import { useTranslation } from '../../context/LanguageContext';
import { dateKey } from '../../lib/taskDates';
import { countTaskStatuses, filterWorkspaceTasks, sortWorkspaceTasks, taskVillaScope } from '../../lib/taskFilters';
import type { Proyecto, Tarea } from '../../types/projects';
import type { Profile } from '../../types/fleet';
import { CreateProjectModal } from './CreateProjectModal';
import { CreateTaskModal } from './CreateTaskModal';
import { ProjectCatalog } from './ProjectCatalog';
import { TaskAgenda } from './TaskAgenda';
import type { AgendaView } from './TaskAgenda';
import { TaskBoard } from './TaskBoard';
import { TaskCard } from './TaskCard';
import { TaskLocationNav } from './TaskLocationNav';
import { TaskTemplateDialog } from './TaskTemplateDialog';
import { TaskReportDialog } from './TaskReportDialog';
import { useAdminAuth } from '../../context/AdminAuthContext';
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
  const { t, locale } = useTranslation();
  const { isAdmin, user } = useAdminAuth();
  const [reportOpen, setReportOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [sortOrder, setSortOrder] = useSessionPreference<'asc' | 'desc'>('csy_task_sort', 'asc', (value): value is 'asc' | 'desc' => value === 'asc' || value === 'desc');
  const [savedDevelopment, setDevelopment] = useSessionPreference('csy_task_development', 'all', isStringPreference);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filterId = useId();
  const [projectId, setProjectId] = useSessionPreference('csy_task_project', 'all', isStringPreference);
  const [assignee, setAssignee] = useSessionPreference('csy_task_assignee', 'all', isStringPreference);
  const [status, setStatus] = useSessionPreference('csy_task_status', 'all', (value): value is string => statusOptions.some((option) => option.value === value));
  const [view, setView] = useState<'board' | 'list'>(() => { try { return localStorage.getItem('csy_task_view') === 'list' ? 'list' : 'board'; } catch { return 'board'; } });
  const [expanded, setExpanded] = useState(new Set<string>());
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Proyecto | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Tarea | null>(null);
  const [taskCreationDate, setTaskCreationDate] = useState<string | undefined>(undefined);
  const [agendaDate, setAgendaDate] = useSessionPreference('csy_agenda_date', dateKey(new Date()), (value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(new Date(`${value}T12:00:00`)) === value);
  const [agendaView, setAgendaView] = useSessionPreference<AgendaView>('csy_agenda_view', 'month', (value): value is AgendaView => typeof value === 'string' && ['month', 'week', 'day', 'unscheduled'].includes(value));
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const seenCreateVersion = useRef(createVersion);
  const development = projects.find((project) => project.id === projectId)?.desarrollo ?? (projects.some(project => project.desarrollo === savedDevelopment) ? savedDevelopment : 'all');
  const developments = useMemo(() => [...new Set(projects.map((project) => project.desarrollo))].sort((a, b) => a.localeCompare(b)), [projects]);
  const availableProjects = useMemo(() => projects.filter((project) => development === 'all' || project.desarrollo === development), [projects, development]);
  const projectLabels = useMemo(() => Object.fromEntries(projects.map((project) => [project.id, `${project.desarrollo} · ${project.villa}`])), [projects]);
  // A removed project no longer constrains the view after a realtime update.
  const effectiveProject = projects.some((project) => project.id === projectId) ? projectId : 'all';
  const globalSearch = mode === 'tasks' && Boolean(searchQuery.trim());
  const activeFilterCount = [mode === 'tasks' ? 'all' : development, mode === 'tasks' ? 'all' : effectiveProject, assignee, status].filter((value) => value !== 'all').length;
  const matchingTasks = useMemo(() => filterWorkspaceTasks(tasks, projects, { query: searchQuery, development: mode === 'tasks' ? 'all' : development, project: mode === 'tasks' ? 'all' : effectiveProject, assignee, status: 'all' }), [tasks, projects, searchQuery, development, effectiveProject, assignee, mode]);
  const selectedVilla = useMemo(() => mode === 'tasks' ? taskVillaScope(projects, matchingTasks, searchQuery, effectiveProject) : undefined, [mode, projects, matchingTasks, searchQuery, effectiveProject]);
  const scopedTasks = useMemo(() => mode === 'tasks' ? matchingTasks.filter(task => task.proyecto_id === selectedVilla?.id) : matchingTasks, [mode, matchingTasks, selectedVilla]);
  const visible = useMemo(() => {
    const filtered = status === 'all' ? scopedTasks : scopedTasks.filter(task => task.estatus === status);
    return mode === 'tasks' ? sortWorkspaceTasks(filtered, sortOrder, locale) : filtered;
  }, [scopedTasks, status, mode, sortOrder, locale]);
  const statusCounts = useMemo(() => countTaskStatuses(scopedTasks, mode === 'agenda' ? agendaView === 'unscheduled' ? 'unscheduled' : 'scheduled' : 'all'), [scopedTasks, mode, agendaView]);
  const modalProject = projects.find((project) => project.id === taskToEdit?.proyecto_id) || selectedVilla || projects.find((project) => project.id === effectiveProject) || availableProjects[0] || projects[0];

  useEffect(() => {
    if (seenCreateVersion.current === createVersion || loading) return;
    seenCreateVersion.current = createVersion;
    setTaskToEdit(null);
    setTaskCreationDate(undefined);
    if (projects.length) setTaskModalOpen(true);
    else { setProjectToEdit(null); setProjectModalOpen(true); }
  }, [createVersion, loading, projects.length]);

  const toggleExpand = (id: string) => setExpanded((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const editTask = (task: Tarea) => { setTaskToEdit(task); setTaskModalOpen(true); };
  const createTaskOnDay = (day: string) => {
    setTaskToEdit(null);
    setTaskCreationDate(day);
    if (projects.length) setTaskModalOpen(true);
    else { setProjectToEdit(null); setProjectModalOpen(true); }
  };
  const selectVilla = (id: string) => {
    setDevelopment(projects.find((project) => project.id === id)?.desarrollo ?? development);
    setProjectId(id);
  };
  const clearFilters = () => {
    setDevelopment(selectedVilla?.desarrollo ?? 'all');
    setProjectId(selectedVilla?.id ?? 'all');
    setAssignee('all');
    setStatus('all');
  };
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

  const assigneeSelect = <AppSelect aria-label={t('Responsable')} value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="all">{t('Cualquier responsable')}</option><option value="unassigned">{t('Sin asignar')}</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.nombre || person.full_name || person.email}</option>)}</AppSelect>;
  const assigneeControl = <label>{t('Responsable')}{assigneeSelect}</label>;
  const templateApplied = () => {
    setTemplateOpen(false);
    void onReload();
  };

  return <section className={`task-workspace operational-panel ${mode === 'tasks' ? 'task-workspace-split' : ''}`} aria-label={mode === 'agenda' ? t('sidebar.agenda') : t('sidebar.projects')}>
    {mode === 'tasks' && <TaskLocationNav projects={projects} development={selectedVilla?.desarrollo ?? 'all'} projectId={selectedVilla?.id ?? 'all'} revealProjectId={globalSearch ? selectedVilla?.id : undefined} loading={loading} onSelect={(name, villa) => { setDevelopment(name); setProjectId(villa); }} />}
    <div className="task-workspace-content">
    {mode === 'tasks' && (
      <div className="task-location-context">
        <span>{selectedVilla ? <>{selectedVilla.desarrollo}<ChevronRight size={14} aria-hidden="true" />{selectedVilla.villa}</> : t('Selecciona una villa')}</span>
        <div className="task-location-actions">
          <button type="button" className="workspace-button" onClick={() => setReportOpen(true)}>
            <Download size={15} aria-hidden="true" />
            {t('Informe de tareas')}
          </button>
          {isAdmin && selectedVilla && (
            <button type="button" className="workspace-button" disabled={loading} onClick={() => setTemplateOpen(true)}>
              {t('Aplicar plantilla')}
            </button>
          )}
        </div>
      </div>
    )}
    {mode === 'agenda' && <div className="workspace-filterbar"><div id={filterId} className={`workspace-filters ${mobileFiltersOpen ? 'is-open' : ''}`}>
      {mode === 'agenda' && <div className="workspace-filter-group workspace-location-filters">
        <label>{t('Desarrollo')}<AppSelect aria-label={t('Desarrollo')} value={development} onChange={(event) => { setDevelopment(event.target.value); setProjectId('all'); }}><option value="all">{t('Todos')}</option>{developments.map((item) => <option key={item} value={item}>{item}</option>)}</AppSelect></label>
        <label>{t('Villa')}<AppSelect aria-label={t('Villa')} value={effectiveProject} onChange={(event) => selectVilla(event.target.value)}><option value="all">{t('Todas')}</option>{availableProjects.map((project) => <option key={project.id} value={project.id}>{project.villa}</option>)}</AppSelect></label>
      </div>}
      <div className="workspace-filter-group workspace-work-filters">
      {mode === 'agenda' && assigneeControl}
      <label>{t('Estado')}<AppSelect aria-label={t('Estado')} value={status} onChange={(event) => setStatus(event.target.value)}>{statusOptions.map((option) => <option key={option.value} value={option.value}>{t(option.label)} ({statusCounts[option.value]})</option>)}</AppSelect></label>
      </div>
      {mode === 'agenda' && activeFilterCount > 0 && <button type="button" className="workspace-clear-filters" onClick={clearFilters}>{t('Limpiar filtros')}</button>}
    </div><div className="workspace-tools"><button type="button" className="workspace-button workspace-mobile-filter-toggle" aria-expanded={mobileFiltersOpen} aria-controls={filterId} onClick={() => setMobileFiltersOpen((previous) => !previous)}><SlidersHorizontal size={15} aria-hidden="true" />{t('Filtros')}{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button></div></div>}
    {(error || actionError) && <div role="alert" className="workspace-error">{t(error || actionError || '')}<button type="button" disabled={refreshing} onClick={() => void refresh()}>{t('Reintentar')}</button></div>}
    {mode === 'tasks' && <div className="workspace-toolbar task-workspace-toolbar">
      <div className="workspace-view-switch" role="group" aria-label={t('Vista de tareas')}><button type="button" aria-pressed={view === 'board'} onClick={() => changeView('board')}><Columns3 size={16} />{t('Tablero')}</button><button type="button" aria-pressed={view === 'list'} onClick={() => changeView('list')}><List size={16} />{t('Lista')}</button></div>
      <div className="workspace-toolbar-options">
        <span className="workspace-count" role="status">{visible.length} {t(visible.length === 1 ? 'tarea' : 'tareas')}</span>
        <div className="workspace-compact-filters">
          <label className="workspace-compact-assignee"><span className="sr-only">{t('Responsable')}</span>{assigneeSelect}</label>
          <label className="workspace-compact-status"><span className="sr-only">{t('Estado')}</span><AppSelect aria-label={t('Estado')} title={t('Estado')} value={status} onChange={event => setStatus(event.target.value)}>{statusOptions.map(option => <option key={option.value} value={option.value}>{t(option.label)} ({statusCounts[option.value]})</option>)}</AppSelect></label>
          <button type="button" role="switch" aria-checked={sortOrder === 'desc'} aria-label={t('Orden descendente')} title={t(sortOrder === 'asc' ? 'Ascendente' : 'Descendente')} className="workspace-sort-switch" onClick={() => setSortOrder(previous => previous === 'asc' ? 'desc' : 'asc')}>
            {sortOrder === 'asc' ? <ArrowUpNarrowWide size={16} aria-hidden="true"/> : <ArrowDownWideNarrow size={16} aria-hidden="true"/>}
          </button>
          {activeFilterCount > 0 && <button type="button" className="workspace-compact-reset" onClick={clearFilters} aria-label={t('Limpiar filtros')} title={t('Limpiar filtros')}><RotateCcw size={14} aria-hidden="true"/></button>}
        </div>
      </div>
    </div>}
    {loading ? <div className="workspace-empty" role="status"><Loader2 size={24} className="animate-spin" /><p>{t('Cargando tareas...')}</p></div>
      : mode === 'agenda' ? <TaskAgenda tasks={visible} projectLabels={projectLabels} expandedTaskIds={expanded} onToggleExpand={toggleExpand} onTaskUpdated={() => void onReload()} onEditTask={editTask} onCreateTask={createTaskOnDay} selectedDate={agendaDate} view={agendaView} onDateChange={setAgendaDate} onViewChange={setAgendaView} />
      : view === 'board' ? <TaskBoard tasks={visible} showSearch={false} expandedTaskIds={expanded} onToggleExpand={toggleExpand} onTaskUpdated={() => void onReload()} onEditTask={editTask} onMoveTask={onMoveTask} />
      : <div className="workspace-task-list">{visible.length ? visible.map((task) => <TaskCard key={task.id} task={task} isExpanded={expanded.has(task.id)} onToggleExpand={() => toggleExpand(task.id)} onTaskUpdated={() => void onReload()} onEditTask={editTask} />) : <p className="workspace-empty">{t('No hay tareas que coincidan con los filtros.')}</p>}</div>}
    </div>
    {reportOpen && <TaskReportDialog key={user?.id} projects={projects} staff={staff} initialProject={selectedVilla?.id} onClose={() => setReportOpen(false)} />}
    {templateOpen && selectedVilla && <TaskTemplateDialog key={selectedVilla.id} project={selectedVilla} onClose={() => setTemplateOpen(false)} onApplied={templateApplied} />}
    <ProjectCatalog open={catalogOpen} projects={projects} onClose={() => setCatalogOpen(false)} onSelect={(project) => { setDevelopment(project.desarrollo); setProjectId(project.id); }} onCreate={() => { setProjectToEdit(null); setProjectModalOpen(true); }} onEdit={(project) => { setProjectToEdit(project); setProjectModalOpen(true); }} onDelete={(project) => void deleteVilla(project)} deletingId={deletingId} error={actionError} />
    <CreateProjectModal isOpen={projectModalOpen} onClose={() => setProjectModalOpen(false)} onSuccess={() => { void onReload().then(() => { if (taskCreationDate) setTaskModalOpen(true); }); }} existingDesarrollos={developments} projectToEdit={projectToEdit} defaultDesarrollo={development} />
    {modalProject && <CreateTaskModal isOpen={taskModalOpen} onClose={() => { setTaskModalOpen(false); setTaskCreationDate(undefined); }} onSuccess={() => void onReload()} project={modalProject} projects={projects} defaultDate={taskCreationDate ?? (mode === 'agenda' && agendaView !== 'unscheduled' ? agendaDate : undefined)} taskToEdit={taskToEdit} staffList={staff} />}
  </section>;
}
