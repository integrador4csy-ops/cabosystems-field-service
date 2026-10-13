import React, { useState, useEffect } from 'react';
import { X, CheckSquare, AlertCircle, Loader2 } from 'lucide-react';
import { createTask, updateTask, createSubtask } from '../../lib/projectsApi';
import type { Proyecto, Tarea } from '../../types/projects';
import type { Profile } from '../../types/fleet';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  project: Proyecto;
  taskToEdit?: Tarea | null;
  staffList: Profile[];
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  project,
  taskToEdit,
  staffList,
}) => {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [asignadoA, setAsignadoA] = useState('');
  const [estatus, setEstatus] = useState<'pendiente' | 'en_proceso' | 'completada'>('pendiente');
  const [initialSubtasks, setInitialSubtasks] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (taskToEdit) {
      setTitulo(taskToEdit.titulo);
      setDescripcion(taskToEdit.descripcion || '');
      setAsignadoA(taskToEdit.asignado_a);
      setEstatus(taskToEdit.estatus);
      setInitialSubtasks([]);
    } else {
      setTitulo('');
      setDescripcion('');
      setAsignadoA(staffList.length > 0 ? staffList[0].id : '');
      setEstatus('pendiente');
      setInitialSubtasks(['']);
    }
    setError(null);
  }, [isOpen, taskToEdit, staffList]);

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
      setError('El título de la tarea es obligatorio.');
      return;
    }

    if (!asignadoA) {
      setError('Debes asignar la tarea a un colaborador técnico.');
      return;
    }

    setLoading(true);
    try {
      if (taskToEdit) {
        await updateTask(taskToEdit.id, {
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || null,
          asignado_a: asignadoA,
          estatus,
        });
      } else {
        const createdTask = await createTask({
          proyecto_id: project.id,
          asignado_a: asignadoA,
          titulo: titulo.trim(),
          descripcion: descripcion.trim() || undefined,
          estatus,
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
      setError(err?.message || 'Error al guardar la tarea');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100/80 text-[#f78c26]">
              <CheckSquare size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {taskToEdit ? 'Editar Tarea' : 'Nueva Tarea'}
              </h3>
              <p className="text-xs text-slate-500">
                {project.desarrollo} • <span className="font-semibold text-slate-700">{project.villa}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Título de la tarea */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Título de la Tarea <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Cableado Cat6 y Conectividad en Sala Principal..."
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
              required
            />
          </div>

          {/* Asignado a */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Técnico Asignado <span className="text-red-500">*</span>
            </label>
            {staffList.length === 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                No hay colaboradores registrados. Puedes invitar técnicos desde el menú lateral.
              </div>
            ) : (
              <div className="relative">
                <select
                  value={asignadoA}
                  onChange={(e) => setAsignadoA(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
                  required
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.nombre || st.full_name || 'Técnico'} ({st.rol?.replace(/_/g, ' ') || 'técnico'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Estatus */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Estatus
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['pendiente', 'en_proceso', 'completada'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEstatus(st)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all border ${
                    estatus === st
                      ? st === 'completada'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : st === 'en_proceso'
                          ? 'border-orange-500 bg-orange-50 text-[#f78c26]'
                          : 'border-slate-500 bg-slate-100 text-slate-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {st.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Descripción / Instrucciones (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre lo que se debe instalar o verificar..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Subtareas iniciales (solo al crear) */}
          {!taskToEdit && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700">
                  Subtareas / Pasos de control (Checklist)
                </label>
                <button
                  type="button"
                  onClick={handleAddSubtaskInput}
                  className="text-[11px] font-semibold text-[#f78c26] hover:underline"
                >
                  + Añadir paso
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mb-2.5">
                Puedes agregar pasos iniciales o crearlos directamente desde la tarjeta de la tarea.
              </p>
              <div className="space-y-2">
                {initialSubtasks.map((sub, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Paso ${idx + 1} (ej. Ponchado de cable, prueba de señal)...`}
                      value={sub}
                      onChange={(e) => handleSubtaskChange(idx, e.target.value)}
                      className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-[#f78c26] focus:outline-none"
                    />
                    {initialSubtasks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSubtask(idx)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || staffList.length === 0}
              className="flex items-center gap-1.5 rounded-xl bg-[#f78c26] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#e07d20] focus:ring-4 focus:ring-orange-500/20 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{taskToEdit ? 'Guardar Cambios' : 'Crear Tarea'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
