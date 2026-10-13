import React, { useState } from 'react';
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Edit2,
  User,
  CheckCircle2,
  Clock,
  Loader2,
} from 'lucide-react';
import type { Tarea, Subtarea } from '../../types/projects';
import {
  createSubtask,
  toggleSubtask,
  deleteSubtask,
  updateTask,
  deleteTask,
} from '../../lib/projectsApi';

interface TaskCardProps {
  task: Tarea;
  onTaskUpdated: () => void;
  onEditTask: (task: Tarea) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onTaskUpdated,
  onEditTask,
}) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [subtasks, setSubtasks] = useState<Subtarea[]>(task.subtareas || []);

  const completedSubtasks = subtasks.filter((s) => s.completada).length;
  const totalSubtasks = subtasks.length;
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
    if (!window.confirm(`¿Estás seguro de eliminar la tarea "${task.titulo}"?`)) {
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

  const assignedProfile = task.profiles;

  const statusConfig = {
    pendiente: {
      label: 'Pendiente',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: <Clock size={12} className="text-slate-500" />,
    },
    en_proceso: {
      label: 'En Proceso',
      badgeClass: 'bg-orange-50 text-[#f78c26] border-orange-200',
      icon: <Loader2 size={12} className="animate-spin text-[#f78c26]" />,
    },
    completada: {
      label: 'Completada',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: <CheckCircle2 size={12} className="text-emerald-600" />,
    },
  }[task.estatus] || {
    label: task.estatus,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: null,
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-4.5 shadow-2xs transition-all duration-200 hover:shadow-md ${
        task.estatus === 'completada'
          ? 'border-emerald-200/80 bg-emerald-50/20'
          : 'border-slate-200'
      }`}
    >
      {/* Header: Title, Status & Actions */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {/* Status Dropdown */}
            <div className="relative inline-block">
              <select
                value={task.estatus}
                onChange={(e) =>
                  handleStatusChange(
                    e.target.value as 'pendiente' | 'en_proceso' | 'completada'
                  )
                }
                disabled={updatingStatus}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-bold cursor-pointer transition-all focus:outline-none ${statusConfig.badgeClass}`}
              >
                <option value="pendiente">Pendiente</option>
                <option value="en_proceso">En Proceso</option>
                <option value="completada">Completada</option>
              </select>
            </div>

            {totalSubtasks > 0 && (
              <span className="text-[11px] font-semibold text-slate-400">
                {completedSubtasks}/{totalSubtasks} subtareas ({progressPercent}%)
              </span>
            )}
          </div>

          <h4
            className={`text-sm font-bold text-slate-800 break-words ${
              task.estatus === 'completada' ? 'line-through text-slate-500' : ''
            }`}
          >
            {task.titulo}
          </h4>

          {task.descripcion && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2">
              {task.descripcion}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onEditTask(task)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Editar Tarea"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={handleDeleteTask}
            disabled={isDeleting}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
            title="Eliminar Tarea"
          >
            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
          </button>
        </div>
      </div>

      {/* Progress Bar (if has subtasks) */}
      {totalSubtasks > 0 && (
        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-3.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              progressPercent === 100 ? 'bg-emerald-500' : 'bg-[#f78c26]'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Subtasks (Checklist) Section */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Subtareas / Pasos
          </span>
          <span className="text-[10px] text-slate-400 font-medium">
            {completedSubtasks} de {totalSubtasks} listos
          </span>
        </div>

        {/* Subtask list */}
        <div className="space-y-1.5 mb-2.5">
          {subtasks.map((sub) => (
            <div
              key={sub.id}
              className="group flex items-center justify-between gap-2 rounded-lg bg-white p-2 border border-slate-200/70 shadow-2xs transition-all hover:border-slate-300"
            >
              <button
                type="button"
                onClick={() => handleToggleSubtask(sub)}
                className="flex items-center gap-2 text-left flex-1 min-w-0"
              >
                {sub.completada ? (
                  <CheckSquare size={15} className="text-emerald-500 shrink-0" />
                ) : (
                  <Square size={15} className="text-slate-400 group-hover:text-slate-600 shrink-0" />
                )}
                <span
                  className={`text-xs ${
                    sub.completada
                      ? 'text-slate-400 line-through'
                      : 'text-slate-700 font-medium'
                  } truncate`}
                >
                  {sub.titulo}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleDeleteSubtask(sub.id)}
                className="opacity-0 group-hover:opacity-100 flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                title="Eliminar subtarea"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {subtasks.length === 0 && (
            <p className="text-xs text-slate-400 italic py-1">
              Sin subtareas. Añade un paso para llevar el checklist.
            </p>
          )}
        </div>

        {/* Inline Add Subtask Input */}
        <form onSubmit={handleAddSubtask} className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="+ Agregar subtarea (presiona Enter)..."
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            disabled={addingSubtask}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#f78c26] focus:outline-none transition-all"
          />
          <button
            type="submit"
            disabled={!newSubtaskTitle.trim() || addingSubtask}
            className="flex h-7 items-center gap-1 rounded-lg bg-slate-800 px-2.5 text-[11px] font-bold text-white hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            {addingSubtask ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Plus size={12} />
            )}
            <span>Añadir</span>
          </button>
        </form>
      </div>

      {/* Footer: Assigned Technician */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          {assignedProfile?.avatar_url ? (
            <img
              src={assignedProfile.avatar_url}
              alt={assignedProfile.nombre}
              className="h-6 w-6 rounded-full object-cover border border-slate-200"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-[#f78c26] text-[10px] font-bold">
              {assignedProfile?.nombre?.[0]?.toUpperCase() || <User size={12} />}
            </div>
          )}
          <div className="min-w-0">
            <span className="text-xs font-bold text-slate-700 block truncate">
              {assignedProfile?.nombre || 'Técnico no asignado'}
            </span>
            <span className="text-[10px] text-slate-400 block truncate">
              {assignedProfile?.rol?.replace(/_/g, ' ') || 'técnico'}
            </span>
          </div>
        </div>

        {task.created_at && (
          <span className="text-[10px] text-slate-400 shrink-0">
            {new Date(task.created_at).toLocaleDateString('es-MX', {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        )}
      </div>
    </div>
  );
};
