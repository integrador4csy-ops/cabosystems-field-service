import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { deleteCompanyEvent, saveCompanyEvent } from '../../lib/agendaApi';
import { NO_RECURRENCE, validRecurrence } from '../../lib/agendaRecurrence';
import type { CompanyEvent, EventInput } from '../../types/agenda';
import { AppSelect } from '../ui/AppSelect';
import { useDialog } from '../ui/useDialog';
import { RecurrenceFields } from './RecurrenceFields';

export function EventDialog({ event, day, canManage, onClose, onSaved }: {
  event: CompanyEvent | null; day: string; canManage: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTranslation();
  const [input, setInput] = useState<EventInput>({ titulo: event?.titulo || '', descripcion: event?.descripcion || '', tipo: event?.tipo || 'evento', fecha: event?.fecha || day, hora: event?.hora?.slice(0, 5) || '', ubicacion: event?.ubicacion || '', repeticion: event?.repeticion || 'ninguna', intervalo: event?.intervalo || 1, dias_semana: event?.dias_semana || [], repetir_hasta: event?.repetir_hasta || null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useDialog(true, () => { if (!busy) onClose(); });
  const change = (patch: Partial<EventInput>) => { setInput((value) => ({ ...value, ...patch })); setError(''); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage || busy || confirmDelete) return;
    if (!input.titulo.trim()) { setError(t('El título es obligatorio.')); return; }
    if (!validRecurrence(input)) { setError(t('Revisa la repetición: elige días, un intervalo válido y una fecha final igual o posterior al inicio.')); return; }
    setBusy(true); setError('');
    try {
      await saveCompanyEvent(event?.id, { ...input, titulo: input.titulo.trim(), descripcion: input.descripcion?.trim() || null, ubicacion: input.ubicacion?.trim() || null, hora: input.hora || null });
      onSaved();
    } catch { setError(t('No se pudo guardar el evento. Intenta de nuevo.')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!event || !canManage || busy) return;
    setBusy(true); setError('');
    try { await deleteCompanyEvent(event.id); onSaved(); }
    catch { setError(t('No se pudo eliminar el evento. Intenta de nuevo.')); }
    finally { setBusy(false); }
  };
  return <div className="company-dialog-backdrop">
    <div ref={ref} className="company-dialog minimal-modal" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" tabIndex={-1}>
      <header><h2 id="event-dialog-title">{!canManage ? t('Detalle del evento') : event ? t('Editar evento') : t('Nuevo evento')}</h2><button type="button" className="workspace-icon" disabled={busy} onClick={onClose} aria-label={t('Cerrar')}><X size={18} /></button></header>
      <form onSubmit={submit}>
        <fieldset disabled={!canManage || busy}>
          <label>{t('Título')}<input required maxLength={160} value={input.titulo} onChange={(e) => change({ titulo: e.target.value })} /></label>
          <label>{t('Tipo')}<AppSelect aria-label={t('Tipo')} disabled={!canManage || busy} value={input.tipo} onChange={(e) => change({ tipo: e.target.value as EventInput['tipo'], ...(e.target.value === 'evento' ? NO_RECURRENCE : {}) })}><option value="evento">{t('Evento')}</option><option value="recordatorio">{t('Recordatorio')}</option></AppSelect></label>
          <div className="company-form-row"><label>{t('Fecha')}<input required type="date" min="1900-01-01" max="9999-12-31" value={input.fecha} onChange={(e) => change({ fecha: e.target.value })} /></label><label>{t('Hora (opcional)')}<input type="time" value={input.hora || ''} onChange={(e) => change({ hora: e.target.value })} /></label></div>
          {input.tipo === 'recordatorio' && <RecurrenceFields input={input} disabled={!canManage || busy} onChange={change} />}
          {event && event.repeticion !== 'ninguna' && <p className="company-field-help">{canManage ? t('Los cambios se aplican a toda la serie de recordatorios.') : t('Este recordatorio pertenece a una serie.')}</p>}
          <label>{t('Ubicación (opcional)')}<input maxLength={240} value={input.ubicacion || ''} onChange={(e) => change({ ubicacion: e.target.value })} /></label>
          <label>{t('Descripción')}<textarea rows={4} maxLength={5000} value={input.descripcion || ''} onChange={(e) => change({ descripcion: e.target.value })} /></label>
        </fieldset>
        {error && <p role="alert" className="company-error">{error}</p>}
        {confirmDelete && <div className="company-delete-confirm"><p>{event && event.repeticion !== 'ninguna' ? t('¿Eliminar toda la serie de recordatorios? Esta acción no se puede deshacer.') : t('¿Eliminar este evento? Esta acción no se puede deshacer.')}</p><button type="button" disabled={busy} className="workspace-button" onClick={() => setConfirmDelete(false)}>{t('Cancelar')}</button><button type="button" disabled={busy} className="workspace-button company-danger" onClick={() => void remove()}>{busy ? t('Eliminando...') : t('Confirmar eliminación')}</button></div>}
        <footer>{canManage && event && !confirmDelete && <button type="button" disabled={busy} className="workspace-button company-danger" onClick={() => setConfirmDelete(true)}>{t('Eliminar')}</button>}<span /><button type="button" disabled={busy} className="workspace-button" onClick={onClose}>{t('Cerrar')}</button>{canManage && !confirmDelete && <button type="submit" disabled={busy} className="workspace-primary">{busy ? t('Guardando...') : t('Guardar')}</button>}</footer>
      </form>
    </div>
  </div>;
}
