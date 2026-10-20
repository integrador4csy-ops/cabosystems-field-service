import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useTranslation } from '../../context/LanguageContext';
import { useSessionPreference } from '../../hooks/useSessionPreference';
import { agendaDays, type CompanyAgendaView } from '../../lib/agendaDates';
import { getCompanyEvents, getGoogleCalendars } from '../../lib/agendaApi';
import { dateKey, parseDateKey, shiftDate, shiftMonth } from '../../lib/taskDates';
import { supabase } from '../../lib/supabase';
import type { AgendaKind, AgendaGoogleCalendar, CompanyEvent } from '../../types/agenda';
import { AppSelect } from '../ui/AppSelect';
import { EventDialog } from './EventDialog';
import { GoogleCalendarDialog } from './GoogleCalendarDialog';
import { calendarAppearance, eventSchedule } from '../../lib/agendaPresentation';
import '../projects/TaskWorkspace.css';
import './CompanyAgenda.css';

export function CompanyAgenda() {
  const { t, locale } = useTranslation();
  const { user, adminProfile } = useAdminAuth();
  const { agendaSearchQuery, agendaCreateVersion } = useSidebar();
  const canManage = Boolean(user && adminProfile?.activo && ['admin', 'supervisor_instalacion'].includes(adminProfile.rol || ''));
  const canConnectGoogle = Boolean(user && adminProfile?.activo && adminProfile.rol === 'admin');
  const [googleOpen, setGoogleOpen] = useState(false);
  const [anchor, setAnchor] = useSessionPreference('csy_company_agenda_date', dateKey(new Date()), (value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDateKey(value)) === value);
  const [view, setView] = useSessionPreference<CompanyAgendaView>('csy_company_agenda_view', 'month', (value): value is CompanyAgendaView => value === 'month' || value === 'week' || value === 'day');
  const [kind, setKind] = useState<AgendaKind | ''>('');
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [calendars, setCalendars] = useState<AgendaGoogleCalendar[]>([]);
  const [hiddenCalendars, setHiddenCalendars] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dialog, setDialog] = useState<{ event: CompanyEvent | null; day: string } | null>(null);
  const version = useRef(0);
  const createVersion = useRef(agendaCreateVersion);
  useEffect(() => { setHiddenCalendars([]); setCalendars([]); }, [user?.id]);
  const days = useMemo(() => agendaDays(anchor, view), [anchor, view]);
  const from = days[0]; const to = days[days.length - 1];
  const load = useCallback(async () => {
    const request = ++version.current;
    setLoading(true);
    try {
      const [data, available] = await Promise.all([getCompanyEvents(from, to), getGoogleCalendars()]);
      if (request === version.current) { setEvents(data); setCalendars(available); setError(false); }
    } catch { if (request === version.current) { setEvents([]); setError(true); } }
    finally { if (request === version.current) setLoading(false); }
  }, [from, to, user?.id]);
  useEffect(() => {
    void load();
    const channel = supabase.channel('company_agenda').on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_eventos' }, () => void load()).subscribe();
    const refresh = () => { if (document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', refresh);
    return () => { version.current += 1; window.removeEventListener('focus', refresh); void supabase.removeChannel(channel); };
  }, [load]);
  useEffect(() => {
    if (createVersion.current !== agendaCreateVersion) {
      createVersion.current = agendaCreateVersion;
      if (canManage) setDialog({ event: null, day: anchor });
    }
  }, [agendaCreateVersion, anchor, canManage]);
  const byDay = useMemo(() => {
    const result = new Map<string, CompanyEvent[]>();
    const search = agendaSearchQuery.trim().toLocaleLowerCase(locale);
    for (const event of events) {
      if (hiddenCalendars.includes(event.google?.calendarId || 'local')) continue;
      if (kind && event.tipo !== kind) continue;
      if (search && ![event.titulo, event.descripcion, event.ubicacion, event.google?.calendarName].filter(Boolean).join(' ').toLocaleLowerCase(locale).includes(search)) continue;
      const day = event.occurrence_date || event.fecha;
      const group = result.get(day) || [];
      group.push(event); result.set(day, group);
    }
    return result;
  }, [events, kind, agendaSearchQuery, locale, hiddenCalendars]);
  const calendarFilters = [{ id: 'local', name: 'CaboSystems', backgroundColor: '#343e48' }, ...calendars];
  const toggleCalendar = (id: string) => setHiddenCalendars(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const move = (direction: number) => setAnchor(view === 'month' ? shiftMonth(anchor, direction) : shiftDate(anchor, direction * (view === 'week' ? 7 : 1)));
  const today = dateKey(new Date());
  const heading = view === 'day' ? parseDateKey(anchor).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : view === 'week' ? `${parseDateKey(from).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${parseDateKey(to).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}` : parseDateKey(anchor).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const renderEvent = (event: CompanyEvent) => <button type="button" key={event.id} className={`company-event ${event.google ? 'has-calendar-color' : ''}`} style={calendarAppearance(event)} onClick={() => setDialog({ event, day: event.occurrence_date || event.fecha })}>
    {event.tipo === 'recordatorio' ? <Bell size={14} aria-hidden="true" /> : <CalendarDays size={14} aria-hidden="true" />}
    <span><span className="company-event-title">{event.titulo}</span><span className="company-event-meta">{eventSchedule(event, locale)}{view !== 'month' && <> · {event.tipo === 'recordatorio' ? t('Recordatorio') : t('Evento')}</>}{(event.repeticion !== 'ninguna' || event.google?.recurring) && <> · {t('Se repite')}</>}</span>{event.google && <span className="company-event-meta">Google · {event.google.calendarName}</span>}{view !== 'month' && event.ubicacion && <span className="company-event-meta">{event.ubicacion}</span>}</span>
  </button>;

  return <section className="task-workspace operational-panel company-agenda" aria-label={t('Agenda de la empresa')}>
    <div className="agenda-toolbar">
      <div className="agenda-period-heading"><button className="workspace-button" onClick={() => setAnchor(today)}>{t('Hoy')}</button><div className="agenda-period-arrows"><button className="workspace-icon agenda-period-arrow" aria-label={t('Periodo anterior')} onClick={() => move(-1)}><ChevronLeft size={20} /></button><button className="workspace-icon agenda-period-arrow" aria-label={t('Periodo siguiente')} onClick={() => move(1)}><ChevronRight size={20} /></button></div><h2 className="agenda-month-title" aria-live="polite">{heading}</h2></div>
      <div className="agenda-date-controls"><AppSelect aria-label={t('Tipo de registro')} value={kind} onChange={(e) => setKind(e.target.value as AgendaKind | '')}><option value="">{t('Eventos y recordatorios')}</option><option value="evento">{t('Eventos')}</option><option value="recordatorio">{t('Recordatorios')}</option></AppSelect><AppSelect aria-label={t('Vista de agenda')} value={view} onChange={(e) => setView(e.target.value as CompanyAgendaView)}><option value="month">{t('Mes')}</option><option value="week">{t('Semana')}</option><option value="day">{t('Día')}</option></AppSelect><input type="date" min="1900-01-01" max="9999-12-31" aria-label={t('Ir a fecha')} value={anchor} onChange={(e) => { if (e.target.validity.valid && e.target.value) setAnchor(e.target.value); }} /></div>
    </div>
    <div className="google-calendar-toolbar">{canConnectGoogle && <button type="button" className="workspace-button" onClick={() => setGoogleOpen(true)}>Google Calendar</button>}<button type="button" className="workspace-button" disabled={loading} onClick={() => void load()}><RefreshCw size={15} aria-hidden="true" />{locale.startsWith('en') ? 'Refresh' : 'Actualizar'}</button></div>
    <fieldset className="company-calendar-filters"><legend>{locale.startsWith('en') ? 'My calendars' : 'Mis calendarios'}</legend>{calendarFilters.map(calendar => <label key={calendar.id}><input type="checkbox" checked={!hiddenCalendars.includes(calendar.id)} onChange={() => toggleCalendar(calendar.id)} style={{ accentColor: calendar.backgroundColor && /^#[a-f0-9]{6}$/i.test(calendar.backgroundColor) ? calendar.backgroundColor : '#343e48' }} /><span>{calendar.name}</span></label>)}</fieldset>
    {error ? <div role="alert" className="workspace-empty"><p>{t('No se pudo cargar la agenda. Intenta de nuevo.')}</p><button className="workspace-button" onClick={() => void load()}>{t('Reintentar')}</button></div> : loading ? <p role="status" className="workspace-empty">{t('Cargando agenda...')}</p> : <div className="company-calendar-scroll" tabIndex={0} role="region" aria-label={t('Calendario de eventos')}>
      {byDay.size === 0 && <p className="company-empty" role="status">{t('No hay eventos ni recordatorios en este periodo.')}</p>}
      {view === 'month' ? <table className="company-calendar"><thead><tr>{days.slice(0, 7).map((day) => <th key={day} scope="col">{parseDateKey(day).toLocaleDateString(locale, { weekday: 'short' })}</th>)}</tr></thead><tbody>{Array.from({ length: days.length / 7 }, (_, index) => <tr key={index}>{days.slice(index * 7, index * 7 + 7).map((day) => {
        const items = byDay.get(day) || [];
        return <td key={day} className={`${day.slice(0, 7) !== anchor.slice(0, 7) ? 'is-outside-month' : ''} ${day === today ? 'is-today' : ''}`}><div className="company-day-heading"><button type="button" className="agenda-month-date" aria-label={parseDateKey(day).toLocaleDateString(locale, { dateStyle: 'full' })} aria-current={day === today ? 'date' : undefined} onClick={() => { setAnchor(day); setView('day'); }}>{parseDateKey(day).getDate()}</button>{canManage && <button type="button" className="workspace-icon company-add" aria-label={t('Crear evento para el {date}', { date: parseDateKey(day).toLocaleDateString(locale) })} onClick={() => setDialog({ event: null, day })}><Plus size={14} /></button>}</div>{items.slice(0, 3).map(renderEvent)}{items.length > 3 && <button className="company-more" onClick={() => { setAnchor(day); setView('day'); }}>{t('Ver {count} más', { count: items.length - 3 })}</button>}</td>;
      })}</tr>)}</tbody></table> : <div className={`company-columns ${view === 'day' ? 'is-day' : ''}`}>{days.map((day) => <section key={day} className={day === today ? 'is-today' : ''}><header className="company-day-heading"><h3>{parseDateKey(day).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}</h3>{canManage && <button className="workspace-icon company-add" aria-label={t('Crear evento para el {date}', { date: parseDateKey(day).toLocaleDateString(locale) })} onClick={() => setDialog({ event: null, day })}><Plus size={16} /></button>}</header>{(byDay.get(day) || []).map(renderEvent)}{!byDay.has(day) && <p className="company-empty">{t('Sin eventos')}</p>}</section>)}</div>}
    </div>}
    {dialog && <EventDialog key={dialog.event?.id || dialog.day} {...dialog} canManage={canManage} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(); }} />}
    {googleOpen && canConnectGoogle && <GoogleCalendarDialog key={user!.id} onClose={() => { setGoogleOpen(false); void load(); }} />}
  </section>;
}
