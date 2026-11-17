import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, Check, UserPlus, Users, X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { deleteCompanyEvent, getAgendaCollaborators, getGoogleCalendars, saveCompanyEvent, type AgendaCollaborator } from '../../lib/agendaApi';
import { resolveCalendarDisplayName } from '../../lib/agendaPresentation';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { validRecurrence } from '../../lib/agendaRecurrence';
import { agendaRequestId } from '../../lib/agendaRequestId';
import type { AgendaGoogleCalendar, CompanyEvent, EventAttendee, EventInput } from '../../types/agenda';
import { AppSelect } from '../ui/AppSelect';
import { useDialog } from '../ui/useDialog';
import { RecurrenceFields } from './RecurrenceFields';
import { AgendaDateTimeField } from './AgendaDateTimeField';

export function EventDialog({ event, day, canManage: allowed, canManageCompany: allowedCompany, availableCalendars, onClose, onSaved }: {
  event: CompanyEvent | null; day: string; canManage?: boolean; canManageCompany?: boolean; availableCalendars?: AgendaGoogleCalendar[]; onClose: () => void; onSaved: () => void;
}) {
  const { t, locale } = useTranslation();
  const { user, adminProfile } = useAdminAuth();
  const userEmail = user?.email || adminProfile?.email;
  const userFullName = adminProfile?.nombre || (user?.user_metadata?.nombre as string);
  const canManageCompany = allowedCompany !== undefined ? allowedCompany : (allowed ?? Boolean(user && adminProfile?.activo && ['admin', 'supervisor_instalacion'].includes(adminProfile.rol || '')));
  const isGoogle = Boolean(event?.google);
  const canManage = event ? (isGoogle ? event.google?.editable !== false : canManageCompany) : true;
  const en = locale.startsWith('en');
  const c = {
    startTime: en ? 'Start time' : 'Hora de inicio',
    invalidTime: en ? 'Enter a valid start and end time. Local events must end after they start on the same day.' : 'Indica inicio y fin válidos. Los eventos locales deben terminar después del inicio en el mismo día.',
    calendar: en ? 'Calendar' : 'Calendario',
    local: en ? 'CaboSystems only' : 'Solo CaboSystems',
    endDate: en ? 'Last day' : 'Último día',
    endTime: en ? 'End time' : 'Hora de fin',
    zone: en ? 'Google times use Los Cabos time.' : 'Las horas de Google se muestran en horario de Los Cabos.',
    occurrence: en ? 'Changes and deletion apply only to this occurrence. Manage the full series in Google Calendar.' : 'Los cambios y la eliminación afectan solo esta ocurrencia. La serie completa se administra en Google Calendar.',
    calendarError: en ? 'Could not load Google calendars. You can still save locally.' : 'No se pudieron consultar los calendarios de Google. Puedes guardar solo en CaboSystems.',
    localRestricted: en ? 'Only administrators can create company calendar events.' : 'Solo administradores pueden crear eventos en el calendario general de la empresa.',
    attendees: en ? 'Guests' : 'Invitados',
    addGuest: en ? 'Add guests (type name or email)...' : 'Agregar personas o correos...',
    invite: en ? 'Invite' : 'Invitar a',
    noGuests: en ? 'No guests' : 'Sin invitados',
    guestsHelp: en ? 'Guests will receive Google Calendar invitations automatically.' : 'Los invitados recibirán su invitación de Google Calendar por correo.',
  };
  const [calendars, setCalendars] = useState<AgendaGoogleCalendar[]>(() => (availableCalendars || []).filter(cal => cal.editable !== false));
  const [calendarError, setCalendarError] = useState(false);
  const [allDay, setAllDay] = useState(event ? !event.hora : false);
  const [collaborators, setCollaborators] = useState<AgendaCollaborator[]>([]);
  const [guestQuery, setGuestQuery] = useState('');
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const guestInputRef = useRef<HTMLInputElement>(null);
  const initialCalendarId = event?.google?.calendarId || (!canManageCompany ? ((availableCalendars || []).find(cal => cal.editable !== false)?.id || '') : '');
  const [input, setInput] = useState<EventInput>(() => ({
    titulo: event?.google?.availabilityOnly ? (en ? 'Busy' : 'Ocupado') : event?.titulo || '',
    descripcion: event?.descripcion || '',
    tipo: 'evento',
    fecha: event?.fecha || day,
    hora: event ? event.hora?.slice(0, 5) || '' : '09:00',
    ubicacion: event?.ubicacion || '',
    repeticion: event?.repeticion || 'ninguna',
    intervalo: event?.intervalo || 1,
    dias_semana: event?.dias_semana || [],
    repetir_hasta: event?.repetir_hasta || null,
    calendar_id: initialCalendarId,
    google_etag: event?.google?.etag,
    request_id: agendaRequestId(),
    fecha_fin: event?.google?.endDate || '',
    hora_fin: event ? (event.google?.endTime || event.hora_fin)?.slice(0, 5) || '' : '10:00',
    attendees: event?.attendees || event?.google?.attendees || [],
  }));
  useEffect(() => {
    let active = true;
    void getAgendaCollaborators().then(list => { if (active) setCollaborators(list); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (event) return;
    let active = true;
    void getGoogleCalendars().then((items) => {
      if (active) {
        const writable = items.filter(calendar => calendar.editable !== false);
        setCalendars(writable);
        if (!canManageCompany && writable.length > 0) {
          setInput(curr => curr.calendar_id ? curr : { ...curr, calendar_id: writable[0].id });
        }
      }
    }).catch(() => { if (active) setCalendarError(true); });
    return () => { active = false; };
  }, [event, canManageCompany]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useDialog(true, () => { if (!busy) onClose(); });
  const change = (patch: Partial<EventInput>) => { setInput((value) => ({ ...value, ...patch })); setError(''); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canManage || busy || confirmDelete) return;
    if (!input.calendar_id && !canManageCompany) { setError(c.localRestricted); return; }
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
    if (!event.google && !canManageCompany) { setError(c.localRestricted); return; }
    setBusy(true); setError('');
    try { await deleteCompanyEvent(event.id, event.google?.etag); onSaved(); }
    catch (reason) { setError(event.google && reason instanceof Error && reason.message ? reason.message : t('No se pudo eliminar el evento. Intenta de nuevo.')); }
    finally { setBusy(false); }
  };
  const addGuest = (attendee: EventAttendee) => {
    const email = attendee.email.trim().toLowerCase();
    if (!email || (input.attendees || []).some(a => a.email.toLowerCase() === email)) return;
    change({ attendees: [...(input.attendees || []), { ...attendee, email }] });
    setGuestQuery('');
    setGuestDropdownOpen(false);
  };
  const removeGuest = (email: string) => {
    change({ attendees: (input.attendees || []).filter(a => a.email.toLowerCase() !== email.toLowerCase()) });
  };
  const matchingGuests = useMemo(() => {
    const q = guestQuery.trim().toLowerCase();
    if (!q) return [];
    return collaborators.filter(c => {
      const already = (input.attendees || []).some(a => a.email.toLowerCase() === c.email.toLowerCase());
      if (already) return false;
      return (c.nombre && c.nombre.toLowerCase().includes(q)) || c.email.toLowerCase().includes(q);
    }).slice(0, 5);
  }, [collaborators, guestQuery, input.attendees]);
  const customEmailMatch = useMemo(() => {
    const q = guestQuery.trim().toLowerCase();
    if (!q || !q.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return null;
    const already = (input.attendees || []).some(a => a.email.toLowerCase() === q);
    if (already) return null;
    return q;
  }, [guestQuery, input.attendees]);
  return <div className="company-dialog-backdrop">
    <div ref={ref} className="company-dialog company-event-dialog minimal-modal" role="dialog" aria-modal="true" aria-labelledby="event-dialog-title" tabIndex={-1}>
      <header><div className="company-event-heading"><CalendarDays size={18} aria-hidden="true" /><h2 id="event-dialog-title">{!canManage ? t('Detalle del evento') : event ? t('Editar evento') : t('Nuevo evento')}</h2></div><button type="button" className="workspace-icon" disabled={busy} onClick={onClose} aria-label={t('Cerrar')}><X size={16} /></button></header>
      <form onSubmit={submit}>
        <div className="company-event-fields">
        <fieldset disabled={!canManage || busy}>
          <label className="company-title-field">{t('Título')}<input required maxLength={160} value={input.titulo} onChange={(e) => change({ titulo: e.target.value })} /></label>
          {event ? <p className="company-field-help">{c.calendar}: {event.google ? resolveCalendarDisplayName({ id: event.google.calendarId || '', name: event.google.calendarName }, userEmail, userFullName) : c.local}</p> : <label>{c.calendar}<AppSelect aria-label={c.calendar} disabled={!canManage || busy} value={input.calendar_id || ''} onChange={(e) => change({ calendar_id: e.target.value })}>{canManageCompany && <option value="">{c.local}</option>}{calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{resolveCalendarDisplayName(calendar, userEmail, userFullName)}</option>)}</AppSelect></label>}
          {event?.google?.availabilityOnly && <p className="company-field-help">{en ? 'Availability only. Google shares busy times without event details.' : 'Solo disponibilidad. Google comparte los horarios ocupados sin los detalles de los eventos.'}</p>}
          {calendarError && <p role="status" className="company-field-help">{c.calendarError}</p>}
          <div className="company-schedule-fields">
          <div className="company-date-all-day">
          <label>{t('Fecha')}<AgendaDateTimeField type="date" required min="1900-01-01" max="9999-12-31" value={input.fecha} label={t('Fecha')} locale={locale} disabled={!canManage || busy} onChange={fecha => change({ fecha })} /></label>
          <label className="company-all-day"><span className="company-checkbox-control"><input type="checkbox" checked={allDay} onChange={(e) => { setAllDay(e.target.checked); change(e.target.checked ? { hora: '', hora_fin: '' } : { hora: '09:00', hora_fin: '10:00' }); }} /><Check size={13} strokeWidth={3} aria-hidden="true" /></span>{t('Todo el día')}</label>
          </div>
          {!allDay && <div className="company-form-row"><label>{c.startTime}<AgendaDateTimeField type="time" required value={input.hora || ''} label={c.startTime} locale={locale} disabled={!canManage || busy} onChange={hora => change({ hora })} /></label><label>{c.endTime}<AgendaDateTimeField type="time" required value={input.hora_fin || ''} label={c.endTime} locale={locale} disabled={!canManage || busy} onChange={hora_fin => change({ hora_fin })} /></label></div>}
          {input.calendar_id && <><label>{c.endDate}<AgendaDateTimeField type="date" min={input.fecha} max="9999-12-30" value={input.fecha_fin || ''} label={c.endDate} locale={locale} disabled={!canManage || busy} onChange={fecha_fin => change({ fecha_fin })} /></label><p className="company-field-help">{c.zone}</p></>}
          </div>
          {event?.google?.recurring && <p className="company-field-help">{c.occurrence}</p>}
          {!event?.google && <RecurrenceFields input={input} disabled={!canManage || busy} onChange={change} />}
          {event && event.repeticion !== 'ninguna' && <p className="company-field-help">{canManage ? t('Los cambios se aplican a toda la serie de eventos.') : t('Este evento pertenece a una serie.')}</p>}
          <div className="company-attendees-field">
            <label id="event-attendees-label">{c.attendees}</label>
            {canManage && (
              <div className="company-attendees-input-wrap">
                <Users className="company-attendees-icon" size={15} aria-hidden="true" />
                <input
                  ref={guestInputRef}
                  type="text"
                  className="company-attendees-input"
                  placeholder={c.addGuest}
                  aria-labelledby="event-attendees-label"
                  value={guestQuery}
                  onChange={(e) => { setGuestQuery(e.target.value); setGuestDropdownOpen(true); }}
                  onFocus={() => { if (guestQuery.trim()) setGuestDropdownOpen(true); }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (matchingGuests.length > 0) {
                        addGuest({ email: matchingGuests[0].email, displayName: matchingGuests[0].nombre, avatar_url: matchingGuests[0].avatar_url || undefined });
                      } else if (customEmailMatch) {
                        addGuest({ email: customEmailMatch });
                      }
                    } else if (e.key === 'Escape') {
                      setGuestDropdownOpen(false);
                    }
                  }}
                />
                {guestDropdownOpen && (matchingGuests.length > 0 || customEmailMatch) && (
                  <div className="company-attendees-dropdown" role="listbox">
                    {matchingGuests.map(collab => (
                      <button
                        type="button"
                        key={collab.id}
                        className="company-attendee-option"
                        onClick={() => addGuest({ email: collab.email, displayName: collab.nombre, avatar_url: collab.avatar_url || undefined })}
                      >
                        {collab.avatar_url ? (
                          <img className="company-attendee-avatar" src={collab.avatar_url} alt="" />
                        ) : (
                          <span className="company-attendee-avatar">{(collab.nombre || collab.email).slice(0, 2).toUpperCase()}</span>
                        )}
                        <span className="company-attendee-info">
                          <span className="company-attendee-name">{collab.nombre}</span>
                          <span className="company-attendee-email">{collab.email}</span>
                        </span>
                      </button>
                    ))}
                    {customEmailMatch && !matchingGuests.some(m => m.email.toLowerCase() === customEmailMatch) && (
                      <button
                        type="button"
                        className="company-attendee-option"
                        onClick={() => addGuest({ email: customEmailMatch })}
                      >
                        <span className="company-attendee-avatar"><UserPlus size={13} /></span>
                        <span className="company-attendee-info">
                          <span className="company-attendee-name">{c.invite} {customEmailMatch}</span>
                        </span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {input.attendees && input.attendees.length > 0 ? (
              <div className="company-attendees-chips">
                {input.attendees.map((attendee) => {
                  const matchedCollab = collaborators.find(col => col.email.toLowerCase() === attendee.email.toLowerCase());
                  const name = attendee.displayName || matchedCollab?.nombre || attendee.email;
                  const avatar = attendee.avatar_url || matchedCollab?.avatar_url;
                  return (
                    <span key={attendee.email} className="company-attendee-chip">
                      {avatar ? (
                        <img className="company-attendee-chip-avatar" src={avatar} alt="" />
                      ) : (
                        <span className="company-attendee-chip-avatar">{name.slice(0, 2).toUpperCase()}</span>
                      )}
                      <span className="company-attendee-chip-name" title={attendee.email}>{name}</span>
                      {attendee.responseStatus && attendee.responseStatus !== 'needsAction' && (
                        <span className={`company-attendee-status is-${attendee.responseStatus}`}>
                          {attendee.responseStatus === 'accepted' ? (en ? 'Accepted' : 'Aceptó') : attendee.responseStatus === 'declined' ? (en ? 'Declined' : 'Rechazó') : (en ? 'Tentative' : 'Quizás')}
                        </span>
                      )}
                      {canManage && (
                        <button
                          type="button"
                          className="company-attendee-chip-remove"
                          onClick={() => removeGuest(attendee.email)}
                          aria-label={`${t('Eliminar')} ${name}`}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : !canManage ? (
              <p className="company-field-help">{c.noGuests}</p>
            ) : null}
            {input.calendar_id && input.attendees && input.attendees.length > 0 ? <p className="company-field-help">{c.guestsHelp}</p> : null}
          </div>
          <label>{t('Ubicación (opcional)')}<input maxLength={240} value={input.ubicacion || ''} onChange={(e) => change({ ubicacion: e.target.value })} /></label>
          <label>{t('Descripción')}<textarea rows={2} maxLength={5000} value={input.descripcion || ''} onChange={(e) => change({ descripcion: e.target.value })} /></label>
        </fieldset>
        </div>
        {error && <p role="alert" className="company-error">{error}</p>}
        {confirmDelete && <div className="company-delete-confirm"><p>{event && event.repeticion !== 'ninguna' ? t('¿Eliminar toda la serie de eventos? Esta acción no se puede deshacer.') : t('¿Eliminar este evento? Esta acción no se puede deshacer.')}</p><button type="button" disabled={busy} className="workspace-button" onClick={() => setConfirmDelete(false)}>{t('Cancelar')}</button><button type="button" disabled={busy} className="workspace-button company-danger" onClick={() => void remove()}>{busy ? t('Eliminando...') : t('Confirmar eliminación')}</button></div>}
        <footer>{canManage && event && !confirmDelete && <button type="button" disabled={busy} className="workspace-button company-danger" onClick={() => setConfirmDelete(true)}>{t('Eliminar')}</button>}<span /><button type="button" disabled={busy} className="workspace-button" onClick={onClose}>{t('Cerrar')}</button>{canManage && !confirmDelete && <button type="submit" disabled={busy} className="workspace-primary">{busy ? t('Guardando...') : t('Guardar')}</button>}</footer>
      </form>
    </div>
  </div>;
}
