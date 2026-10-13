import React, { useState, useEffect } from 'react';
import { X, Building2, MapPin, AlertCircle, Loader2 } from 'lucide-react';
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
  const [desarrolloMode, setDesarrolloMode] = useState<'select' | 'new'>('select');
  const [desarrollo, setDesarrollo] = useState('');
  const [newDesarrollo, setNewDesarrollo] = useState('');
  const [villa, setVilla] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [estatus, setEstatus] = useState<'activo' | 'pausado' | 'finalizado'>('activo');
  const [latitud, setLatitud] = useState<string>('');
  const [longitud, setLongitud] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (projectToEdit) {
      setDesarrollo(projectToEdit.desarrollo);
      setDesarrolloMode('select');
      setVilla(projectToEdit.villa);
      setDescripcion(projectToEdit.descripcion || '');
      setEstatus(projectToEdit.estatus);
      setLatitud(projectToEdit.latitud !== null && projectToEdit.latitud !== undefined ? String(projectToEdit.latitud) : '');
      setLongitud(projectToEdit.longitud !== null && projectToEdit.longitud !== undefined ? String(projectToEdit.longitud) : '');
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
      setLatitud('');
      setLongitud('');
    }
    setError(null);
  }, [isOpen, projectToEdit, defaultDesarrollo, existingDesarrollos]);

  if (!isOpen) return null;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada por el navegador');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitud(pos.coords.latitude.toFixed(6));
        setLongitud(pos.coords.longitude.toFixed(6));
        setError(null);
      },
      (err) => {
        setError('No se pudo obtener la ubicación actual: ' + err.message);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalDesarrollo =
      desarrolloMode === 'new' ? newDesarrollo.trim() : desarrollo.trim();

    if (!finalDesarrollo) {
      setError('Por favor indica o selecciona un Desarrollo.');
      return;
    }

    if (!villa.trim()) {
      setError('El nombre o número de la Villa / Proyecto es obligatorio.');
      return;
    }

    const latNum = latitud.trim() ? parseFloat(latitud) : null;
    const lngNum = longitud.trim() ? parseFloat(longitud) : null;

    if (latitud.trim() && isNaN(latNum as number)) {
      setError('La latitud ingresada no es válida.');
      return;
    }
    if (longitud.trim() && isNaN(lngNum as number)) {
      setError('La longitud ingresada no es válida.');
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
          latitud: latNum,
          longitud: lngNum,
        });
      } else {
        await createProject({
          desarrollo: finalDesarrollo,
          villa: villa.trim(),
          descripcion: descripcion.trim() || undefined,
          estatus,
          latitud: latNum,
          longitud: lngNum,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar la villa/proyecto');
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
              <Building2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                {projectToEdit ? 'Editar Villa / Proyecto' : 'Nueva Villa (Proyecto)'}
              </h3>
              <p className="text-xs text-slate-500">
                Registra la villa bajo un desarrollo para asignar tareas y técnicos en campo
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

          {/* Desarrollo Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Desarrollo / Comunidad <span className="text-red-500">*</span>
              </label>
              {existingDesarrollos.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setDesarrolloMode(desarrolloMode === 'select' ? 'new' : 'select')
                  }
                  className="text-[11px] font-semibold text-[#f78c26] hover:underline"
                >
                  {desarrolloMode === 'select'
                    ? '+ Escribir nuevo desarrollo'
                    : '← Seleccionar existente'}
                </button>
              )}
            </div>

            {desarrolloMode === 'select' && existingDesarrollos.length > 0 ? (
              <select
                value={desarrollo}
                onChange={(e) => setDesarrollo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
                required
              >
                {existingDesarrollos.map((dev) => (
                  <option key={dev} value={dev}>
                    {dev}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Ej. Querencia, Palmilla, Chileno Bay, El Dorado..."
                value={newDesarrollo}
                onChange={(e) => setNewDesarrollo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
                required
              />
            )}
          </div>

          {/* Villa Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nombre o Número de Villa / Unidad <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Ej. Villa 14, Casa Las Brisas 5, Penthouse 302..."
              value={villa}
              onChange={(e) => setVilla(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2.5 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all"
              required
            />
          </div>

          {/* Estatus */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Estatus del Proyecto
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['activo', 'pausado', 'finalizado'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEstatus(st)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold capitalize transition-all border ${
                    estatus === st
                      ? st === 'activo'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                        : st === 'pausado'
                          ? 'border-amber-500 bg-amber-50 text-amber-700'
                          : 'border-slate-500 bg-slate-100 text-slate-700'
                      : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Descripción / Alcance (Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Detalles sobre el proyecto, acceso, o notas para el equipo técnico..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* GPS Coordinates (Optional) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                <MapPin size={14} className="text-[#f78c26]" />
                <span>Geolocalización de la Villa (Opcional)</span>
              </div>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                className="text-[11px] font-semibold text-[#f78c26] hover:underline"
              >
                📍 Mi ubicación actual
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Permite que el radar reconozca automáticamente cuando un técnico visita esta villa por 5+ min.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <input
                  type="text"
                  placeholder="Latitud (ej. 23.0145)"
                  value={latitud}
                  onChange={(e) => setLatitud(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:border-[#f78c26] focus:outline-none"
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Longitud (ej. -109.6841)"
                  value={longitud}
                  onChange={(e) => setLongitud(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-800 placeholder-slate-400 focus:border-[#f78c26] focus:outline-none"
                />
              </div>
            </div>
          </div>

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
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-[#f78c26] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#e07d20] focus:ring-4 focus:ring-orange-500/20 transition-all disabled:opacity-50"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              <span>{projectToEdit ? 'Guardar Cambios' : 'Crear Villa'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
