import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Trash2,
  Edit2,
  MapPin,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  Loader2,
  CheckSquare,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  getProjects,
  getTasksByProject,
  deleteProject,
  getAssignableStaff,
} from '../../lib/projectsApi';
import type { Proyecto, Tarea } from '../../types/projects';
import type { Profile } from '../../types/fleet';
import { CreateProjectModal } from './CreateProjectModal';
import { CreateTaskModal } from './CreateTaskModal';
import { TaskCard } from './TaskCard';

export const ProjectsManagementView: React.FC = () => {
  const [projects, setProjects] = useState<Proyecto[]>([]);
  const [staffList, setStaffList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDesarrollo, setSelectedDesarrollo] = useState<string>('all');
  const [selectedProject, setSelectedProject] = useState<Proyecto | null>(null);

  // Tasks of selected project
  const [tasks, setTasks] = useState<Tarea[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | 'pendiente' | 'en_proceso' | 'completada'>('all');

  // Modals state
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<Proyecto | null>(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Tarea | null>(null);

  // Load projects & staff
  const loadData = async () => {
    try {
      setLoading(true);
      const [projs, staff] = await Promise.all([
        getProjects(),
        getAssignableStaff(),
      ]);
      setProjects(projs);
      setStaffList(staff);

      // If a project is currently selected, refresh it
      if (selectedProject) {
        const found = projs.find((p) => p.id === selectedProject.id);
        if (found) setSelectedProject(found);
      }
    } catch (err) {
      console.error('Error loading projects/staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Subscribe to realtime changes on proyectos, tareas, subtareas
    const channel = supabase
      .channel('projects_management_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'proyectos' },
        () => {
          loadData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tareas' },
        () => {
          if (selectedProject) {
            loadTasksForProject(selectedProject.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subtareas' },
        () => {
          if (selectedProject) {
            loadTasksForProject(selectedProject.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Load tasks when selected project changes
  const loadTasksForProject = async (projectId: string) => {
    try {
      setTasksLoading(true);
      const t = await getTasksByProject(projectId);
      setTasks(t);
    } catch (err) {
      console.error('Error loading tasks for project:', err);
    } finally {
      setTasksLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProject) {
      loadTasksForProject(selectedProject.id);
    } else {
      setTasks([]);
    }
  }, [selectedProject?.id]);

  // Unique Desarrollos list
  const existingDesarrollos = useMemo(() => {
    const set = new Set<string>();
    projects.forEach((p) => {
      if (p.desarrollo) set.add(p.desarrollo.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    let result = projects;
    if (selectedDesarrollo !== 'all') {
      result = result.filter((p) => p.desarrollo === selectedDesarrollo);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.villa.toLowerCase().includes(q) ||
          p.desarrollo.toLowerCase().includes(q) ||
          (p.descripcion && p.descripcion.toLowerCase().includes(q))
      );
    }
    return result;
  }, [projects, selectedDesarrollo, searchQuery]);

  // Filtered tasks of selected project
  const filteredTasks = useMemo(() => {
    if (taskStatusFilter === 'all') return tasks;
    return tasks.filter((t) => t.estatus === taskStatusFilter);
  }, [tasks, taskStatusFilter]);

  const handleDeleteProject = async (proj: Proyecto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `¿Eliminar la villa "${proj.villa}" en "${proj.desarrollo}"? Se eliminarán también todas sus tareas y subtareas.`
      )
    ) {
      return;
    }
    try {
      await deleteProject(proj.id);
      if (selectedProject?.id === proj.id) {
        setSelectedProject(null);
      }
      loadData();
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleEditProject = (proj: Proyecto, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjectToEdit(proj);
    setIsProjectModalOpen(true);
  };

  const handleOpenCreateProject = () => {
    setProjectToEdit(null);
    setIsProjectModalOpen(true);
  };

  const handleOpenCreateTask = () => {
    setTaskToEdit(null);
    setIsTaskModalOpen(true);
  };

  const handleEditTask = (t: Tarea) => {
    setTaskToEdit(t);
    setIsTaskModalOpen(true);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50">
      {/* Top Banner / Breadcrumb */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3.5 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100/80 text-[#f78c26] shadow-2xs">
            <Building2 size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">
                Gestión de Obras: Desarrollos y Villas
              </h2>
              <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-[#f78c26] border border-orange-200/80">
                {projects.length} {projects.length === 1 ? 'villa' : 'villas'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Crea desarrollos, administra villas (proyectos) y supervisa tareas y subtareas por técnico
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadData()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            title="Recargar datos"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => handleOpenCreateProject()}
            className="flex items-center gap-1.5 rounded-xl bg-[#f78c26] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#e07d20] focus:ring-4 focus:ring-orange-500/20 transition-all"
          >
            <Plus size={16} />
            <span>+ Nueva Villa / Proyecto</span>
          </button>
        </div>
      </div>

      {/* Main Content: Split layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden p-4 gap-4">
        {/* Left Panel: Desarrollos selector & Villas list */}
        <div
          className={`flex flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden transition-all duration-300 ${
            selectedProject ? 'w-full lg:w-5/12 xl:w-4/12' : 'w-full'
          }`}
        >
          {/* Search & Filter Header */}
          <div className="border-b border-slate-100 p-3.5 space-y-3 bg-slate-50/50">
            {/* Search Input */}
            <div className="relative flex items-center">
              <Search
                size={14}
                className="absolute left-3 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por villa, desarrollo o notas..."
                className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs font-medium text-slate-800 placeholder-slate-400 focus:border-[#f78c26] focus:ring-2 focus:ring-orange-500/10 focus:outline-none transition-all shadow-2xs"
              />
            </div>

            {/* Desarrollos Tags (Horizontal Scroll) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedDesarrollo('all')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all shrink-0 ${
                  selectedDesarrollo === 'all'
                    ? 'bg-slate-800 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                Todos ({projects.length})
              </button>
              {existingDesarrollos.map((dev) => {
                const count = projects.filter((p) => p.desarrollo === dev).length;
                return (
                  <button
                    key={dev}
                    onClick={() => setSelectedDesarrollo(dev)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all shrink-0 ${
                      selectedDesarrollo === dev
                        ? 'bg-[#f78c26] text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {dev} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Villas */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 size={24} className="animate-spin text-[#f78c26]" />
                <span className="text-xs font-medium">Cargando desarrollos y villas...</span>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-center p-6 text-slate-400">
                <Building2 size={32} className="text-slate-300" />
                <p className="text-xs font-semibold text-slate-600">
                  No se encontraron villas o desarrollos
                </p>
                <p className="text-[11px] text-slate-400">
                  Haz clic en "+ Nueva Villa / Proyecto" para comenzar a estructurar las obras.
                </p>
                <button
                  onClick={() => handleOpenCreateProject()}
                  className="mt-2 rounded-xl bg-orange-50 px-3 py-1.5 text-xs font-bold text-[#f78c26] border border-orange-200 hover:bg-orange-100 transition-colors"
                >
                  + Crear primera villa
                </button>
              </div>
            ) : (
              filteredProjects.map((proj) => {
                const isSelected = selectedProject?.id === proj.id;
                return (
                  <div
                    key={proj.id}
                    onClick={() => setSelectedProject(proj)}
                    className={`group relative flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'border-[#f78c26] bg-orange-50/40 shadow-xs ring-2 ring-orange-500/10'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black transition-colors ${
                          isSelected
                            ? 'bg-[#f78c26] text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 group-hover:bg-orange-100 group-hover:text-[#f78c26]'
                        }`}
                      >
                        {proj.villa.substring(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 truncate">
                            {proj.villa}
                          </span>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                            {proj.desarrollo}
                          </span>
                          {/* Status pill */}
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold capitalize ${
                              proj.estatus === 'activo'
                                ? 'bg-emerald-50 text-emerald-700'
                                : proj.estatus === 'pausado'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {proj.estatus}
                          </span>
                        </div>

                        {proj.descripcion && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {proj.descripcion}
                          </p>
                        )}

                        {proj.latitud && proj.longitud && (
                          <div className="flex items-center gap-1 text-[10px] font-mono text-slate-400 mt-1">
                            <MapPin size={10} className="text-[#f78c26]" />
                            <span>
                              {proj.latitud.toFixed(4)}, {proj.longitud.toFixed(4)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Actions on hover */}
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <button
                        onClick={(e) => handleEditProject(proj, e)}
                        className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-all"
                        title="Editar Villa"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={(e) => handleDeleteProject(proj, e)}
                        className="opacity-0 group-hover:opacity-100 flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all"
                        title="Eliminar Villa"
                      >
                        <Trash2 size={13} />
                      </button>
                      <ChevronRight
                        size={16}
                        className={`transition-transform ${
                          isSelected
                            ? 'text-[#f78c26] translate-x-0.5'
                            : 'text-slate-300 group-hover:text-slate-500'
                        }`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Tasks & Subtasks of Selected Villa */}
        {selectedProject ? (
          <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            {/* Header of selected Villa */}
            <div className="flex items-center justify-between border-b border-slate-100 p-4 bg-slate-50/60">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedProject(null)}
                  className="lg:hidden flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                >
                  <ArrowLeft size={16} />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      {selectedProject.desarrollo}
                    </span>
                    <span className="text-slate-300">•</span>
                    <h3 className="text-base font-extrabold text-slate-800">
                      {selectedProject.villa}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    {tasks.length} {tasks.length === 1 ? 'tarea registrada' : 'tareas registradas'}
                    {selectedProject.descripcion ? ` — ${selectedProject.descripcion}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleOpenCreateTask}
                  className="flex items-center gap-1.5 rounded-xl bg-[#f78c26] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#e07d20] focus:ring-4 focus:ring-orange-500/20 transition-all"
                >
                  <Plus size={15} />
                  <span>+ Nueva Tarea</span>
                </button>
              </div>
            </div>

            {/* Task Filters */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 bg-white">
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { key: 'all', label: 'Todas' },
                    { key: 'pendiente', label: 'Pendientes' },
                    { key: 'en_proceso', label: 'En Proceso' },
                    { key: 'completada', label: 'Completadas' },
                  ] as const
                ).map((tab) => {
                  const count =
                    tab.key === 'all'
                      ? tasks.length
                      : tasks.filter((t) => t.estatus === tab.key).length;
                  const isActive = taskStatusFilter === tab.key;

                  return (
                    <button
                      key={tab.key}
                      onClick={() => setTaskStatusFilter(tab.key)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-slate-800 text-white shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {tab.label} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tasks list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {tasksLoading ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 size={24} className="animate-spin text-[#f78c26]" />
                  <span className="text-xs font-medium">Cargando tareas de la villa...</span>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="flex h-56 flex-col items-center justify-center gap-2 text-center p-6 text-slate-400">
                  <CheckSquare size={36} className="text-slate-300" />
                  <p className="text-xs font-bold text-slate-700">
                    No hay tareas {taskStatusFilter !== 'all' ? `en estado "${taskStatusFilter}"` : 'asignadas a esta villa'}
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Crea tareas específicas para los técnicos con checklists de verificación en campo.
                  </p>
                  <button
                    onClick={handleOpenCreateTask}
                    className="mt-2 rounded-xl bg-[#f78c26] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#e07d20] transition-colors"
                  >
                    + Crear primera tarea
                  </button>
                </div>
              ) : (
                filteredTasks.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onTaskUpdated={() => loadTasksForProject(selectedProject.id)}
                    onEditTask={handleEditTask}
                  />
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-slate-400">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <Building2 size={32} />
            </div>
            <h4 className="text-sm font-bold text-slate-700 mb-1">
              Selecciona una Villa para gestionar sus Tareas
            </h4>
            <p className="text-xs text-slate-400 max-w-md mb-4">
              Podrás asignar técnicos de campo, definir checklists con subtareas interactivas y monitorear el avance en tiempo real.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      <CreateProjectModal
        isOpen={isProjectModalOpen}
        onClose={() => setIsProjectModalOpen(false)}
        onSuccess={loadData}
        existingDesarrollos={existingDesarrollos}
        projectToEdit={projectToEdit}
        defaultDesarrollo={selectedDesarrollo}
      />

      {selectedProject && (
        <CreateTaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          onSuccess={() => loadTasksForProject(selectedProject.id)}
          project={selectedProject}
          taskToEdit={taskToEdit}
          staffList={staffList}
        />
      )}
    </div>
  );
};
