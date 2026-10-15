import { AppSelect } from '../ui/AppSelect';
import { useTranslation } from '../../context/LanguageContext';
import { useDialog } from '../ui/useDialog';
import React, { useState, useEffect } from 'react';
import { X, Building2, AlertCircle, Loader2 } from 'lucide-react';
import { createProject, updateProject } from '../../lib/projectsApi';
import type { Proyecto } from '../../types/projects';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingDesarrollos: string[];
  projectToEdit?: Proyecto | null;
  defaultDesarrollo?: string;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingDesarrollos,
  projectToEdit,
  defaultDesarrollo,
}) => {
  const { t } = useTranslation();
  const [desarrolloMode, setDesarrolloMode] = useState<'select' | 'new'>('select');
  const [desarrollo, setDesarrollo] = useState('');
  const [newDesarrollo, setNewDesarrollo] = useState('');
  const [villa, setVilla] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estatus, setEstatus] = useState<'activo' | 'pausado' | 'finalizado'>('activo');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectToEdit) {
      setDesarrollo(projectToEdit.desarrollo);
      setDesarrolloMode('select');
      setVilla(projectToEdit.villa);
      setDescripcion(projectToEdit.descripcion || '');
      setEstatus(projectToEdit.estatus);
    } else {
      if (defaultDesarrollo && defaultDesarrollo !== 'all') {
        setDesarrollo(defaultDesarrollo);
        setDesarrolloMode('select');
      } else if (existingDesarrollos.length > 0) {
        setDesarrollo(existingDesarrollos[0]);
        setDesarrolloMode('select');
      } else {
        setDesarrolloMode('new');
        setDesarrollo('');
      }
      setNewDesarrollo('');
      setVilla('');
      setDescripcion('');
      setEstatus('activo');
    }
    setError(null);
  }, [isOpen, projectToEdit, defaultDesarrollo, existingDesarrollos]);

  const dialogRef = useDialog(isOpen, () => { if (!loading) onClose(); });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalDesarrollo =
      desarrolloMode === 'new' ? newDesarrollo.trim() : desarrollo.trim();

    if (!finalDesarrollo) {
      setError(t("Por favor indica o selecciona un Desarrollo."));
      return;
    }

    if (!villa.trim()) {
      setError(t("El nombre o número de la Villa / Proyecto es obligatorio."));
      return;
    }

    setLoading(true);
    try {
      if (projectToEdit) {
        await updateProject(projectToEdit.id, {
          desarrollo: finalDesarrollo,
          villa: villa.trim(),
          descripcion: descripcion.trim() || null,
          estatus,
          latitud: projectToEdit.latitud ?? null,
          longitud: projectToEdit.longitud ?? null,
        });
      } else {
        await createProject({
          desarrollo: finalDesarrollo,
          villa: villa.trim(),
          descripcion: descripcion.trim() || undefined,
          estatus,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || t("Error al guardar la villa/proyecto"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={t("Villa y desarrollo")} tabIndex={-1}
        className="minimal-modal w-full max-w-lg operational-panel rounded-2xl bg-white shadow-theme-md border border-slate-100 overflow-hidden flex flex-col max-h-[calc(100dvh-32px)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-600">
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                {projectToEdit ? t("Editar Villa / Proyecto") : t("Nueva Villa (Proyecto)")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("Registra la villa bajo un desarrollo para asignar tareas y técnicos en campo")}</p>
            </div>
          </div>
          <button
            aria-label={t("Cerrar ventana")} onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
              <span>{t(error)}</span>
            </div>
          )}

          {/* Desarrollo Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t("Desarrollo")}<span className="text-red-500"></span>
              </label>
              {existingDesarrollos.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDesarrolloMode(desarrolloMode === 'select' ? 'new' : 'select')
                  }
                  className="rounded-lg bg-brand-500 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-brand-700 focus:ring-2 focus:ring-orange-500/20 transition-all cursor-pointer"
                >
                  {desarrolloMode === 'select'
                    ? t("+ Escribir nuevo desarrollo")
                    : t("← Seleccionar existente")}
                </button>
              )}
            </div>

            {desarrolloMode === 'select' && existingDesarrollos.length > 0 ? (
              <AppSelect aria-label={t('Desarrollo')}
                value={desarrollo}
                onChange={(e) => setDesarrollo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
                required
              >
                {existingDesarrollos.map((dev) => (
                  <option key={dev} value={dev}>
                    {dev}
                  </option>
                ))}
              </AppSelect>
            ) : (
              <input
                type="text"
                placeholder={t("Ej. Querencia, Chileno Bay, El Dorado...")} id="project-newDesarrollo" aria-label={t("Nuevo desarrollo")}
                value={newDesarrollo}
                onChange={(e) => setNewDesarrollo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
                required
              />
            )}
          </div>

          {/* Villa Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("Nombre o Número de Villa")}<span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder={t("Ej. Villa 14, Casa Las Brisas 5, PH1...")} id="project-villa" aria-label={t("Villa")}
              value={villa}
              onChange={(e) => setVilla(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
              required
            />
          </div>

          {/* Estatus */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("Estatus del Proyecto")}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['activo', 'pausado', 'finalizado'] as const).map((st) => (
                <button
                  key={t(st)}
                  type="button"
                  aria-pressed={estatus === st}
                  onClick={() => setEstatus(st)}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold capitalize transition-all border ${estatus === st
                    ? 'border-slate-600 bg-slate-50 text-slate-800'
                    : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                    }`}
                >
                  {t(st)}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              {t("Descripción / Alcance (Opcional)")}</label>
            <textarea
              rows={2}
              placeholder={t("Detalles sobre el proyecto, acceso, o notas para el equipo técnico...")} id="project-descripcion" aria-label={t("Descripción")}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Buttons */}
          </div>

          <div className="flex items-center justify-end gap-2.5 px-6 py-4 shrink-0 bg-white border-t border-slate-100">
            <button
              type="button"
              aria-label={t("Cerrar ventana")} onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {t("Cancelar")}</button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-brand-700 focus:ring-4 focus:ring-orange-500/20 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{projectToEdit ? t("Guardar Cambios") : t("Crear Villa")}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
