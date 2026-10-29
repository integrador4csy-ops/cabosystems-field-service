import { AppSelect } from '../ui/AppSelect';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useTranslation } from '../../context/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  ChevronDown,
  X,
  ArrowRightLeft,
  UserRound,
} from 'lucide-react';
import type { Tarea, Subtarea } from '../../types/projects';
import { TaskActionsMenu } from './TaskActionsMenu';
import { isOverdue, parseDateKey } from '../../lib/taskDates';
import {
  createSubtask,
  toggleSubtask,
  deleteSubtask,
  updateTask,
  deleteTask,
} from '../../lib/projectsApi';

interface TaskCardProps {
  task: Tarea;
  variant?: 'list' | 'board';
  projectLabel?: string;
  showScheduledDate?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onTaskUpdated: () => void;
  onEditTask: (task: Tarea) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  variant = 'list',
  projectLabel,
  showScheduledDate = true,
  isExpanded: controlledExpanded,
  onToggleExpand,
  onTaskUpdated,
  onEditTask,
}) => {
  const { t, locale } = useTranslation();
  const { user, isAdmin } = useAdminAuth();
  const canProgress = isAdmin || task.asignado_a === user?.id;
  const scheduledLabel = showScheduledDate && task.fecha_programada ? parseDateKey(task.fecha_programada).toLocaleDateString(locale, { day: 'numeric', month: 'short' }) : '';
  const contextLabel = [projectLabel, scheduledLabel].filter(Boolean).join(' · ');
  const [failedAvatar, setFailedAvatar] = useState('');
  const assigneeName = task.profiles?.nombre || t(task.asignado_a ? 'Responsable' : 'Sin asignar');
  const initials = task.profiles?.nombre?.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [internalExpanded, setInternalExpanded] = useState(false);
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded;

  const toggleExpand = () => {
    if (onToggleExpand) {
      onToggleExpand();
    } else {
      setInternalExpanded((prev) => !prev);
    }
  };

  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtarea[]>(task.subtareas || []);

  useEffect(() => {
    setSubtasks(task.subtareas || []);
  }, [task.subtareas]);

  const completedSubtasks = subtasks.filter((s) => s.completada).length;
  const totalSubtasks = subtasks.length;
  const hasSubtasks = totalSubtasks > 0;
  const hasExpandableContent = hasSubtasks || Boolean(task.descripcion);
  const progressPercent =
    totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const handleToggleSubtask = async (sub: Subtarea) => {
    const nextState = !sub.completada;
    // Optimistic UI update
    setSubtasks((prev) =>
      prev.map((s) => (s.id === sub.id ? { ...s, completada: nextState } : s))
    );

    try {
      await toggleSubtask(sub.id, nextState);
      onTaskUpdated();
    } catch (err) {
      console.error('Error toggling subtask:', err);
      // Revert on error
      setSubtasks((prev) =>
        prev.map((s) => (s.id === sub.id ? { ...s, completada: sub.completada } : s))
      );
    }
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim() || addingSubtask) return;

    setAddingSubtask(true);
    try {
      const created = await createSubtask({
        tarea_id: task.id,
        titulo: newSubtaskTitle.trim(),
      });
      setSubtasks((prev) => [...prev, created]);
      setNewSubtaskTitle('');
      onTaskUpdated();
    } catch (err) {
      console.error('Error creating subtask:', err);
    } finally {
      setAddingSubtask(false);
    }
  };

  const handleDeleteSubtask = async (subId: string) => {
    setSubtasks((prev) => prev.filter((s) => s.id !== subId));
    try {
      await deleteSubtask(subId);
      onTaskUpdated();
    } catch (err) {
      console.error('Error deleting subtask:', err);
    }
  };

  const handleStatusChange = async (
    newStatus: 'pendiente' | 'en_proceso' | 'completada'
  ) => {
    if (newStatus === task.estatus || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await updateTask(task.id, { estatus: newStatus });
      onTaskUpdated();
    } catch (err) {
      console.error('Error changing task status:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm(t("¿Estás seguro de eliminar la tarea \"{value0}\"?", { value0: task.titulo }))) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteTask(task.id);
      onTaskUpdated();
    } catch (err) {
      console.error('Error deleting task:', err);
      setIsDeleting(false);
    }
  };

  // TailAdmin Pill Badge Configuration (Light theme harmonious with CaboSystems)
  const statusConfig = {
    pendiente: {
      label: t("Pendiente"),
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      dotClass: 'bg-slate-400',
      icon: <Clock size={11} className="text-slate-500" />,
    },
    en_proceso: {
      label: t("En Proceso"),
      badgeClass: 'bg-orange-50 text-brand-500 border-orange-200/90 font-semibold',
      dotClass: 'bg-brand-500',
      icon: <Loader2 size={11} className="animate-spin text-brand-500" />,
    },
    completada: {
      label: t("Completada"),
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/90 font-semibold',
      dotClass: 'bg-emerald-500',
      icon: <CheckCircle2 size={11} className="text-emerald-600" />,
    },
  }[task.estatus] || {
    label: task.estatus,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
    icon: null,
  };

  return (
    <div
      className={`${variant === 'board' ? 'task-card-board' : ''} ${hasSubtasks ? 'has-subtasks' : 'no-subtasks'} rounded-2xl border bg-white transition-all duration-200 shadow-2xs hover:shadow-xs hover:border-slate-300 ${
        task.estatus === 'completada'
          ? 'border-emerald-200 bg-emerald-50/15'
          : 'border-slate-200'
      }`}
    >
      {/* Compact Main Row (Click to toggle accordion) */}
      <div
        role={hasExpandableContent ? "button" : undefined}
        tabIndex={hasExpandableContent ? 0 : undefined}
        aria-expanded={hasExpandableContent ? isExpanded : undefined}
        aria-label={hasExpandableContent ? t("Ver pasos de {value0}", { value0: task.titulo }) : undefined}
        onKeyDown={hasExpandableContent ? (event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); toggleExpand(); } } : undefined}
        onClick={hasExpandableContent ? toggleExpand : undefined}
        className={`task-card-header select-none ${hasExpandableContent ? 'cursor-pointer' : ''} ${variant === 'board' ? 'task-card-header-board' : 'flex items-center justify-between gap-2 p-3 sm:p-3.5 flex-wrap sm:flex-nowrap'}`}
      >
        {variant === 'board' ? (
          <>
            <div className="task-card-board-top flex items-start gap-2 min-w-0 w-full">
              {hasSubtasks && (
                <ChevronDown
                  size={15}
                  className={`text-slate-400 transition-transform duration-200 shrink-0 mt-0.5 ${
                    isExpanded ? 'rotate-180 text-brand-500' : ''
                  }`}
                />
              )}
              <h4
                title={task.titulo}
                className={`min-w-0 flex-1 text-sm font-semibold text-slate-800 leading-snug line-clamp-2 ${
                  task.estatus === 'completada' ? 'line-through text-slate-400' : ''
                }`}
              >
                {task.titulo}
              </h4>
            </div>

            <div className="task-card-board-footer flex items-center justify-between gap-2.5 w-full pt-1.5 min-w-0">
              <div className="task-card-board-footer-left min-w-0 flex-1 truncate">
                {contextLabel && (
                  <span className={`task-card-context text-[11.5px] ${isOverdue(task) ? 'task-overdue font-medium text-red-600' : 'text-slate-500'}`} title={contextLabel}>
                    {contextLabel}{isOverdue(task) && <span> · {t('Vencida')}</span>}
                  </span>
                )}
              </div>
              <div className="task-card-board-footer-right flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                {totalSubtasks > 0 && (
                  <span
                    aria-label={`${t('Subtareas')} ${completedSubtasks}/${totalSubtasks}`}
                    className="task-subtasks-count text-[11px] font-medium text-slate-600 px-2 py-0.5 rounded-md bg-slate-100"
                  >
                    {completedSubtasks}/{totalSubtasks}
                  </span>
                )}
                <span
                  className="task-assignee-avatar inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[10px] font-medium text-slate-700"
                  role="img"
                  aria-label={assigneeName}
                  title={assigneeName}
                >
                  {task.profiles?.avatar_url && task.profiles.avatar_url !== failedAvatar ? (
                    <img src={task.profiles.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={() => setFailedAvatar(task.profiles?.avatar_url || '')} />
                  ) : (
                    initials || <UserRound size={13} aria-hidden="true" />
                  )}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => {
                      if (!isExpanded) toggleExpand();
                      setIsAddingSubtask(true);
                    }}
                    className="task-board-action-btn flex h-7 w-7 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    title={t("Añadir subtarea")}
                  >
                    <Plus size={14} />
                  </button>
                )}
                {isAdmin && (
                  <TaskActionsMenu
                    title={task.titulo}
                    deleting={isDeleting}
                    onEdit={() => onEditTask(task)}
                    onDelete={handleDeleteTask}
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="task-card-main flex items-center gap-2.5 min-w-0 flex-1 basis-full sm:basis-auto">
              {/* Chevron Indicator */}
              {hasSubtasks && (
                <ChevronDown
                  size={16}
                  className={`text-slate-400 transition-transform duration-200 shrink-0 ${
                    isExpanded ? 'rotate-180 text-brand-500' : ''
                  }`}
                />
              )}

              {/* Status Pill Badge with Dropdown */}
              <div
                className="relative inline-flex items-center shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <AppSelect
                  value={task.estatus}
                  onChange={(event) => handleStatusChange(event.target.value as Tarea['estatus'])}
                  disabled={updatingStatus || !canProgress}
                  aria-label={t("Cambiar estatus de la tarea")}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs ${statusConfig.badgeClass}`}
                  triggerContent={<>
                  <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dotClass}`} />
                  <span>{statusConfig.label}</span>
                  <ChevronDown size={11} className="opacity-60 -mr-0.5" />
                  </>}
                >
                  <option value="pendiente">{t("Pendiente")}</option>
                  <option value="en_proceso">{t("En Proceso")}</option>
                  <option value="completada">{t("Completada")}</option>
                </AppSelect>
              </div>

              {/* Main Task Title */}
              <h4
                title={task.titulo}
                className={`min-w-0 flex-1 text-sm font-semibold text-slate-800 line-clamp-2 sm:line-clamp-none sm:truncate ${
                  task.estatus === 'completada' ? 'line-through text-slate-400' : ''
                }`}
              >
                {task.titulo}
              </h4>

              {/* Minimal Steps Counter: 0/1 */}
              <span className="task-card-progress-assignee inline-flex items-center gap-2 shrink-0">
              {totalSubtasks > 0 && (
                <span aria-label={`${t('Subtareas')} ${completedSubtasks}/${totalSubtasks}`} className="task-subtasks-count text-[11px] font-medium text-slate-400 shrink-0 px-2 py-0.5 rounded-full bg-slate-100">
                  {completedSubtasks}/{totalSubtasks}
                </span>
              )}
              <span className="task-assignee-avatar inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-[11px] font-medium text-slate-700" role="img" aria-label={assigneeName} title={assigneeName}>
                {task.profiles?.avatar_url && task.profiles.avatar_url !== failedAvatar ? <img src={task.profiles.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={() => setFailedAvatar(task.profiles?.avatar_url || '')} /> : initials || <UserRound size={15} aria-hidden="true" />}
              </span>
              </span>
            </div>

            {/* Action Icon Buttons: +, Edit, Delete */}
            <div
              className="task-card-actions flex w-full sm:w-auto justify-end items-center gap-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              {isAdmin && <button
                onClick={() => {
                  if (!isExpanded) toggleExpand();
                  setIsAddingSubtask(true);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title={t("Añadir subtarea")}
              >
                <Plus size={15} />
              </button>}
              {isAdmin ? <>
              <button
                onClick={() => onEditTask(task)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                title={t("Editar tarea")}
              >
                <Edit2 size={14} />
              </button>
              <button
                onClick={handleDeleteTask}
                disabled={isDeleting}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                title={t("Eliminar tarea")}
              >
                {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              </button>
              </> : null}
            </div>
          </>
        )}
      </div>

      {variant === 'list' && contextLabel && <p className="px-4 pb-3 text-xs text-slate-500">{contextLabel}{isOverdue(task) && <span className="task-overdue"> · {t('Vencida')}</span>}</p>}

      {/* Expanded Details (Description, Progress, Checklist) */}
      {isExpanded && (hasSubtasks || Boolean(task.descripcion) || (isAdmin && isAddingSubtask)) && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 space-y-3">
          {/* Optional Task Description */}
          {task.descripcion && (
            <p className="text-sm text-slate-600 leading-relaxed pt-1">
              {task.descripcion}
            </p>
          )}

          {/* Progress Bar */}
          {totalSubtasks > 0 && (
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  progressPercent === 100 ? 'bg-emerald-500' : 'bg-brand-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}

          {/* Subtasks / Checklist Items */}
          {subtasks.length > 0 && (
            <div className="space-y-1.5">
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  onClick={(e) => e.stopPropagation()}
                  className="group flex items-start justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/40 p-2.5 transition-all hover:bg-white hover:border-slate-300"
                >
                  <label className="flex items-start gap-2 flex-1 min-w-0 cursor-pointer select-none">
                    <div className="relative mt-0.5 flex items-center justify-center w-4.5 h-4.5 shrink-0">
                      <input
                        type="checkbox"
                        className="w-4.5 h-4.5 appearance-none cursor-pointer border border-slate-300 rounded-md checked:bg-brand-500 checked:border-transparent transition-all focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                        checked={sub.completada}
                        disabled={!canProgress}
                        onChange={() => handleToggleSubtask(sub)}
                      />
                      {sub.completada && (
                        <svg
                          className="pointer-events-none absolute inset-0 m-auto"
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 14 14"
                          fill="none"
                        >
                          <path
                            d="M11.6666 3.5L5.24992 9.91667L2.33325 7"
                            stroke="white"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>

                    <span
                      className={`text-xs ${
                        sub.completada
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700 font-medium'
                      } min-w-0 whitespace-normal wrap-anywhere leading-5`}
                    >
                      {sub.titulo}
                    </span>
                  </label>

                  {isAdmin && <button
                    type="button"
                    onClick={() => handleDeleteSubtask(sub.id)}
                    className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                    title={t("Eliminar subtarea")}
                  >
                    <Trash2 size={13} />
                  </button>}
                </div>
              ))}
            </div>
          )}

          {/* Subtask form opened from the header action. */}
          {isAdmin && isAddingSubtask ? (
            <form onSubmit={handleAddSubtask} className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                placeholder={t("Nueva subtarea...")}
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                disabled={addingSubtask}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsAddingSubtask(false);
                    setNewSubtaskTitle('');
                    if (!hasSubtasks && !task.descripcion && isExpanded) toggleExpand();
                  }
                }}
                className="h-8.5 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#f78c26] focus:outline-hidden focus:ring-2 focus:ring-orange-500/10 shadow-2xs transition-all"
              />
              <button
                type="submit"
                disabled={!newSubtaskTitle.trim() || addingSubtask}
                className="flex h-8.5 w-8.5 items-center justify-center rounded-lg bg-brand-500 text-white shadow-2xs hover:bg-brand-700 focus:ring-2 focus:ring-orange-500/20 transition-all disabled:opacity-40 shrink-0"
                title={t("Guardar")}
              >
                {addingSubtask ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Plus size={15} />
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingSubtask(false);
                  setNewSubtaskTitle('');
                  if (!hasSubtasks && !task.descripcion && isExpanded) toggleExpand();
                }}
                className="flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors shrink-0"
                title={t("Cancelar")}
              >
                <X size={15} />
              </button>
            </form>
          ) : null}
        </div>
      )}
    </div>
  );
};
