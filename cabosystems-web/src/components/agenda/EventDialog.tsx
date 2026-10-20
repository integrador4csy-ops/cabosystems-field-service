import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { deleteCompanyEvent, getGoogleCalendars, saveCompanyEvent } from '../../lib/agendaApi';
import { NO_RECURRENCE, validRecurrence } from '../../lib/agendaRecurrence';
import type { AgendaGoogleCalendar, CompanyEvent, EventInput } from '../../types/agenda';
import { AppSelect } from '../ui/AppSelect';
import { useDialog } from '../ui/useDialog';
import { RecurrenceFields } from './RecurrenceFields';

export function EventDialog({ event, day, canManage: allowed, onClose, onSaved }: {
  event: CompanyEvent | null; day: string; canManage: boolean; onClose: () => void; onSaved: () => void;
}) {
  const { t, locale } = useTranslation();
  const canManage = allowed && event?.google?.editable !== false;
  const en = locale.startsWith('en');
  const c = { startTime: en ? 'Start time' : 'Hora de inicio', invalidTime: en ? 'Enter a valid start and end time. Local events must end after they start on the same day.' : 'Indica inicio y fin válidos. Los eventos locales deben terminar después del inicio en el mismo día.', calendar: en ? 'Calendar' : 'Calendario', local: en ? 'CaboSystems only' : 'Solo CaboSystems', endDate: en ? 'Last day' : 'Último día', endTime: en ? 'End time' : 'Hora de fin', zone: en ? 'Google times use Los Cabos time.' : 'Las horas de Google se muestran en horario de Los Cabos.', occurrence: en ? 'Changes and deletion apply only to this occurrence. Manage the full series in Google Calendar.' : 'Los cambios y la eliminación afectan solo esta ocurrencia. La serie completa se administra en Google Calendar.', calendarError: en ? 'Could not load Google calendars. You can still save locally.' : 'No se pudieron consultar los calendarios de Google. Puedes guardar solo en CaboSystems.' };
  const [calendars, setCalendars] = useState<AgendaGoogleCalendar[]>([]);
  const [calendarError, setCalendarError] = useState(false);
  const [allDay, setAllDay] = useState(!event?.hora);
  const [input, setInput] = useState<EventInput>(() => ({ titulo: event?.titulo || '', descripcion: event?.descripcion || '', tipo: event?.tipo || 'evento', fecha: event?.fecha || day, hora: event?.hora?.slice(0, 5) || '', ubicacion: event?.ubicacion || '', repeticion: event?.repeticion || 'ninguna', intervalo: event?.intervalo || 1, dias_semana: event?.dias_semana || [], repetir_hasta: event?.repetir_hasta || null, calendar_id: event?.google?.calendarId || '', google_etag: event?.google?.etag, request_id: crypto.randomUUID().replace(/-/g, ''), fecha_fin: event?.google?.endDate || '', hora_fin: (event?.google?.endTime || event?.hora_fin)?.slice(0, 5) || '' }));
  useEffect(() => {
    if (event || !canManage) return;
    let active = true;
    void getGoogleCalendars().then((items) => { if (active) setCalendars(items); }).catch(() => { if (active) setCalendarError(true); });
    return () => { active = false; };
  }, [event, canManage]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useDialog(true, () => { if (!busy) onClose(); });
  const change = (patch: Partial<EventInput>) => { setInput((value) => ({ ...value, ...patch })); setError(''); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage || busy || confirmDelete) return;
    if (!input.titulo.trim()) { setError(t('El título es obligatorio.')); return; }
    if (!allDay && (!input.hora || !input.hora_fin || !input.calendar_id && input.hora_fin <= input.hora)) { setError(c.invalidTime); return; }
    if (!validRecurrence(input)) { setError(t('Revisa la repetición: elige días, un intervalo válido y una fecha final igual o posterior al inicio.')); return; }
    setBusy(true); setError('');
    try {
      await saveCompanyEvent(event?.id, { ...input, titulo: input.titulo.trim(), descripcion: input.descripcion?.trim() || null, ubicacion: input.ubicacion?.trim() || null, hora: input.hora || null, hora_fin: input.hora ? input.hora_fin || null : null });
      onSaved();
    } catch (reason) { setError(input.calendar_id && reason instanceof Error && reason.message ? reason.message : t('No se pudo guardar el evento. Intenta de nuevo.')); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!event || !canManage || busy) return;
    setBusy(true); setError('');
    try { await deleteCompanyEvent(event.id, event.google?.etag); onSaved(); }
    catch (reason) { setError(event.google && reason instanceof Error && reason.message ? reason.message : t('No se pudo eliminar el evento. Intenta de nuevo.')); }
    finally { setBusy(false); }
  };
  return <div className="company-dialog-backdrop">
    <div ref={ref} className="company-dialog minimal-modal" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" tabIndex={-1}>
      <header><h2 id="event-dialog-title">{!canManage ? t('Detalle del evento') : event ? t('Editar evento') : t('Nuevo evento')}</h2><button type="button" className="workspace-icon" disabled={busy} onClick={onClose} aria-label={t('Cerrar')}><X size={18} /></button></header>
      <form onSubmit={submit}>
        <fieldset disabled={!canManage || busy}>
          {event ? <p className="company-field-help">{c.calendar}: {event.google?.calendarName || c.local}</p> : <label>{c.calendar}<AppSelect aria-label={c.calendar} disabled={!canManage || busy} value={input.calendar_id || ''} onChange={(e) => change({ calendar_id: e.target.value })}><option value="">{c.local}</option>{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}</AppSelect></label>}
          {calendarError && <p role="status" className="company-field-help">{c.calendarError}</p>}
          <label>{t('Título')}<input required maxLength={160} value={input.titulo} onChange={(e) => change({ titulo: e.target.value })} /></label>
          <label>{t('Tipo')}<AppSelect aria-label={t('Tipo')} disabled={!canManage || busy} value={input.tipo} onChange={(e) => change({ tipo: e.target.value as EventInput['tipo'], ...(e.target.value === 'evento' ? NO_RECURRENCE : {}) })}><option value="evento">{t('Evento')}</option><option value="recordatorio">{t('Recordatorio')}</option></AppSelect></label>
          <label>{t('Fecha')}<input required type="date" min="1900-01-01" max="9999-12-31" value={input.fecha} onChange={(e) => change({ fecha: e.target.value })} /></label>
          <label className="company-all-day"><input type="checkbox" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); change(e.target.checked ? { hora: '', hora_fin: '' } : { hora: '09:00', hora_fin: '10:00' }); }} />{t('Todo el día')}</label>
          {!allDay && <div className="company-form-row"><label>{c.startTime}<input required type="time" value={input.hora || ''} onChange={(e) => change({ hora: e.target.value })} /></label><label>{c.endTime}<input required type="time" value={input.hora_fin || ''} onChange={(e) => change({ hora_fin: e.target.value })} /></label></div>}
          {input.calendar_id && <><label>{c.endDate}<input type="date" min={input.fecha} max="9999-12-30" value={input.fecha_fin || ''} onChange={(e) => change({ fecha_fin: e.target.value })} /></label><p className="company-field-help">{c.zone}</p></>}
          {event?.google?.recurring && <p className="company-field-help">{c.occurrence}</p>}
          {input.tipo === 'recordatorio' && !event?.google && <RecurrenceFields input={input} disabled={!canManage || busy} onChange={change} />}
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
