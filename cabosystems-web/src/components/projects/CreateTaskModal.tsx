import { AppSelect } from '../ui/AppSelect';
import { getRoleLabel, getTaskStatusLabel } from '../../lib/uiTranslations';
import { useTranslation } from '../../context/LanguageContext';
import { useDialog } from '../ui/useDialog';
import React, { useState, useEffect } from 'react';
import {
  X,
  CheckSquare,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { createTask, updateTask, createSubtask } from '../../lib/projectsApi';
import type { Proyecto, Tarea } from '../../types/projects';
import type { Profile } from '../../types/fleet';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: Proyecto;
  projects?: Proyecto[];
  defaultDate?: string;
  taskToEdit?: Tarea | null;
  staffList: Profile[];
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  project,
  projects,
  defaultDate,
  taskToEdit,
  staffList,
}) => {
  const { t } = useTranslation();
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignadoA, setAsignadoA] = useState('');
  const [estatus, setEstatus] = useState<'pendiente' | 'en_proceso' | 'completada'>('pendiente');
  const [projectId, setProjectId] = useState(project.id);
  const [scheduledDate, setScheduledDate] = useState('');
  const selectedProject = projects?.find((item) => item.id === projectId) || project;
  const [initialSubtasks, setInitialSubtasks] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setProjectId(taskToEdit.proyecto_id);
      setScheduledDate(taskToEdit.fecha_programada || '');
      setTitulo(taskToEdit.titulo);
      setDescripcion(taskToEdit.descripcion || '');
      setAsignadoA(taskToEdit.asignado_a || '');
      setEstatus(taskToEdit.estatus);
      setInitialSubtasks([]);
    } else {
      setProjectId(project.id);
      setScheduledDate(defaultDate || '');
      setTitulo('');
      setDescripcion('');
      setAsignadoA('');
      setEstatus('pendiente');
      setInitialSubtasks(['']);
    }
    setError(null);
  }, [isOpen, taskToEdit, project.id, defaultDate]);

  const dialogRef = useDialog(isOpen, () => { if (!loading) onClose(); });

  if (!isOpen) return null;
  const handleAddSubtaskInput = () => {
    setInitialSubtasks([...initialSubtasks, '']);
  };

  const handleSubtaskChange = (index: number, val: string) => {
    const updated = [...initialSubtasks];
    updated[index] = val;
    setInitialSubtasks(updated);
  };

  const handleRemoveSubtask = (index: number) => {
    setInitialSubtasks(initialSubtasks.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!titulo.trim()) {
      setError(t("El título de la tarea es obligatorio."));
      return;
    }

    const assigneeId = asignadoA.trim() ? asignadoA.trim() : null;

    setLoading(true);
    try {
      if (taskToEdit) {
        await updateTask(taskToEdit.id, {
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          asignado_a: assigneeId,
          estatus,
          fecha_programada: scheduledDate || null,
        });
      } else {
        const createdTask = await createTask({
          proyecto_id: selectedProject.id,
          asignado_a: assigneeId,
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || undefined,
          estatus,
          fecha_programada: scheduledDate || null,
        });

        // Crear subtareas iniciales si se ingresaron
        const validSubtasks = initialSubtasks.map((s) => s.trim()).filter(Boolean);
        for (const sub of validSubtasks) {
          try {
            await createSubtask({
              tarea_id: createdTask.id,
              titulo: sub,
            });
          } catch (subErr) {
            console.warn('Error al crear subtarea inicial:', subErr);
          }
        }
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || t("Error al guardar la tarea"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("Tarea")} tabIndex={-1}
        className="minimal-modal w-full max-w-xl operational-panel rounded-2xl bg-white shadow-theme-md border border-slate-200 overflow-hidden flex flex-col max-h-[calc(100dvh-32px)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 text-slate-600 border border-slate-200">
              <CheckSquare size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                {taskToEdit ? t("Editar Tarea") : t("Nueva Tarea")}
              </h3>
              <p className="text-xs text-slate-500">
                {selectedProject.desarrollo} • <span className="font-semibold text-slate-700">{selectedProject.villa}</span>
              </p>
            </div>
          </div>
          <button
            aria-label={t("Cerrar ventana")} onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-600">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{t(error)}</span>
            </div>
          )}

          {/* Título de la tarea */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t("Título de la Tarea")}<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder={t("Ej. Cableado Cat6 y Conectividad en Sala Principal...")} id="task-titulo" aria-label={t("Título de la tarea")}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#f78c26] focus:outline-hidden focus:ring-3 focus:ring-orange-500/10 shadow-2xs transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!taskToEdit && projects && <label className="block text-xs font-semibold text-slate-700">
              {t('Villa')}
              <AppSelect aria-label={t('Villa')} value={projectId} onChange={(event) => setProjectId(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" required>
                {projects.map((item) => <option key={item.id} value={item.id}>{item.desarrollo} · {item.villa}</option>)}
              </AppSelect>
            </label>}
            <label className="block text-xs font-semibold text-slate-700">
              {t('Fecha programada')} <span className="font-normal text-slate-500">{t('(Opcional)')}</span>
              <input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm" />
            </label>
          </div>

          {/* Técnico Asignado (Selector con diseño personalizado) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="task-assignee">
              {t('Técnico Asignado')} <span className="text-[11px] font-normal text-slate-400">{t('(Opcional)')}</span>
            </label>
            <AppSelect id="task-assignee" aria-label={t('Técnico Asignado')} value={asignadoA} onChange={(event) => setAsignadoA(event.target.value)} className="h-11">
              <option value="">{t('No asignado')}</option>
              {staffList.map((person) => <option key={person.id} value={person.id}>{person.nombre || person.full_name || person.email || t('Técnico')} · {getRoleLabel(person.rol, t)}{person.email ? ` · ${person.email}` : ''}</option>)}
            </AppSelect>
          </div>
          {/* Estatus */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t("Estatus")}</label>
            <div className="grid grid-cols-3 gap-2.5">
              {(['pendiente', 'en_proceso', 'completada'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  aria-pressed={estatus === st}
                  onClick={() => setEstatus(st)}
                  className={`h-10 rounded-lg text-xs font-semibold capitalize transition-all border ${
                    estatus === st
                      ? 'border-slate-600 bg-slate-50 text-slate-800'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {getTaskStatusLabel(st, t)}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">
              {t("Descripción / Instrucciones (Opcional)")}</label>
            <textarea
              rows={2}
              placeholder={t("Detalles sobre lo que se debe instalar o verificar en campo...")} id="task-descripcion" aria-label={t("Descripción")}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#f78c26] focus:outline-hidden focus:ring-3 focus:ring-orange-500/10 shadow-2xs transition-all resize-none"
            />
          </div>

          {/* Subtareas iniciales (solo al crear) */}
          {!taskToEdit && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700">
                  {t("Subtareas / Pasos de control (Checklist)")}</label>
                <button
                  type="button"
                  onClick={handleAddSubtaskInput}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  {t("Añadir paso")}</button>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                {t("Puedes agregar pasos iniciales o crearlos directamente desde la tarjeta de la tarea.")}</p>
              <div className="space-y-2">
                {initialSubtasks.map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={t("Paso {value0} (ej. Ponchado de cable, prueba de señal)...", { value0: idx + 1 })}
                      value={sub}
                      onChange={(e) => handleSubtaskChange(idx, e.target.value)}
                      className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#f78c26] focus:outline-hidden focus:ring-2 focus:ring-orange-500/10 shadow-2xs"
                    />
                    {initialSubtasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtask(idx)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 shrink-0 bg-white border-t border-slate-100">
            <button
              type="button"
              aria-label={t("Cerrar ventana")} onClick={onClose}
              disabled={loading}
              className="h-11 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              {t("Cancelar")}</button>
            <button
              type="submit"
              disabled={loading || staffList.length === 0}
              className="h-11 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-6 text-sm font-semibold text-white shadow-2xs hover:bg-brand-700 focus:ring-3 focus:ring-orange-500/20 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              <span>{taskToEdit ? t("Guardar Cambios") : t("Crear Tarea")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
