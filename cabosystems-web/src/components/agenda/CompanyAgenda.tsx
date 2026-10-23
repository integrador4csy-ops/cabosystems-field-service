import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Repeat2, CalendarDays, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { useSidebar } from '../../context/SidebarContext';
import { useTranslation } from '../../context/LanguageContext';
import { useSessionPreference } from '../../hooks/useSessionPreference';
import { agendaDays, type CompanyAgendaView } from '../../lib/agendaDates';
import { getCompanyEvents, getGoogleCalendars } from '../../lib/agendaApi';
import { dateKey, parseDateKey, shiftDate, shiftMonth } from '../../lib/taskDates';
import { supabase } from '../../lib/supabase';
import type { AgendaGoogleCalendar, CompanyEvent } from '../../types/agenda';
import { AppSelect } from '../ui/AppSelect';
import { EventDialog } from './EventDialog';
import { AgendaMiniCalendar } from './AgendaMiniCalendar';
import { GoogleCalendarDialog } from './GoogleCalendarDialog';
import { calendarAppearance, eventSchedule } from '../../lib/agendaPresentation';
import { readSessionPreference } from '../../lib/sessionPreferences';
import { useSectionResources, canSpeculate, type SectionResources } from '../../context/SectionResources';
import '../projects/TaskWorkspace.css';
import './CompanyAgenda.css';

export async function prefetchAgenda(resources: SectionResources) {
  const anchor = readSessionPreference('csy_company_agenda_date', dateKey(new Date()), (value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDateKey(value)) === value);
  const days = agendaDays(anchor, 'month');
  return Promise.all([resources.getAgenda(getCompanyEvents).load(days[0], days[days.length - 1]), resources.queries.load('google-calendars', getGoogleCalendars)]);
}

export function CompanyAgenda() {
  const { t, locale } = useTranslation();
  const { user, adminProfile } = useAdminAuth();
  const { agendaSearchQuery, agendaCreateVersion } = useSidebar();
  const canManage = Boolean(user && adminProfile?.activo && ['admin', 'supervisor_instalacion'].includes(adminProfile.rol || ''));
  const canConnectGoogle = Boolean(user && adminProfile?.activo && adminProfile.rol === 'admin');
  const [googleOpen, setGoogleOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [anchor, setAnchor] = useSessionPreference('csy_company_agenda_date', dateKey(new Date()), (value): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(parseDateKey(value)) === value);
  const [view, setView] = useSessionPreference<CompanyAgendaView>('csy_company_agenda_view', 'month', (value): value is CompanyAgendaView => value === 'month' || value === 'week' || value === 'day');
  const resources = useSectionResources();
  const cache = useMemo(() => resources.getAgenda(getCompanyEvents), [resources]);
  const [snapshot, setSnapshot] = useState<{ from: string; to: string; events: CompanyEvent[] } | null>(null);
  const [calendars, setCalendars] = useState<AgendaGoogleCalendar[]>(() => resources.queries.read<AgendaGoogleCalendar[]>('google-calendars') || []);
  const [hiddenCalendars, setHiddenCalendars] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<{ event: CompanyEvent | null; day: string } | null>(null);
  const version = useRef(0);
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const calendarsReady = useRef(false);
  const createVersion = useRef(agendaCreateVersion);
  const days = useMemo(() => agendaDays(anchor, view), [anchor, view]);
  const from = days[0]; const to = days[days.length - 1];
  const month = useMemo(() => agendaDays(anchor, 'month'), [anchor]);
  const monthFrom = month[0]; const monthTo = month[month.length - 1];
  const cached = cache.read(from, to);
  const visibleEvents = cached?.events ?? (snapshot && snapshot.from <= from && snapshot.to >= to ? snapshot.events.filter(event => (event.occurrence_date || event.fecha) >= from && (event.occurrence_date || event.fecha) <= to) : null);
  const events = visibleEvents || [];
  const loading = visibleEvents === null && !error;
  const load = useCallback(async (invalidate = false) => {
    const request = ++version.current;
    clearTimeout(prefetchTimer.current);
    if (invalidate) cache.clear();
    cache.setVisibleRange(monthFrom, monthTo);
    try {
      const fresh = cache.read(monthFrom, monthTo)?.fresh;
      const [data, available] = await Promise.all([cache.load(monthFrom, monthTo), fresh && calendarsReady.current ? Promise.resolve(null) : resources.queries.load('google-calendars', getGoogleCalendars, invalidate)]);
      if (request !== version.current) return;
      setSnapshot({ from: monthFrom, to: monthTo, events: data });
      if (available) { setCalendars(available); calendarsReady.current = true; }
      setError('');
      prefetchTimer.current = setTimeout(() => {
        void (async () => {
          // One adjacent-month request at a time, after the visible period is ready.
          for (const direction of [1, -1]) {
            if (request !== version.current || !canSpeculate() || resources.queries.busy) return;
            const adjacent = agendaDays(shiftMonth(anchor, direction), 'month');
            try { await cache.load(adjacent[0], adjacent[adjacent.length - 1]); }
            catch { /* A speculative failure must not replace the visible calendar. */ }
          }
        })();
      }, 300);
    } catch (reason) {
      if (request === version.current) setError(reason instanceof Error && reason.message ? reason.message : 'No se pudo cargar la agenda. Intenta de nuevo.');
    }
    finally { if (request === version.current) resources.markReady(); }
  }, [cache, monthFrom, monthTo, anchor, resources]);
  useEffect(() => {
    // Fast navigation changes the grid immediately, but only the final range is queried.
    const navigationTimer = setTimeout(() => void load(), 250);
    const channel = supabase.channel('company_agenda').on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_eventos' }, () => void load(true)).subscribe();
    const refresh = () => { if (document.visibilityState === 'visible') void load(true); };
    window.addEventListener('focus', refresh);
    return () => { version.current += 1; clearTimeout(navigationTimer); clearTimeout(prefetchTimer.current); window.removeEventListener('focus', refresh); void supabase.removeChannel(channel); };
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
      if (search && ![event.titulo, event.descripcion, event.ubicacion, event.google?.calendarName].filter(Boolean).join(' ').toLocaleLowerCase(locale).includes(search)) continue;
      const day = event.occurrence_date || event.fecha;
      const group = result.get(day) || [];
      group.push(event); result.set(day, group);
    }
    return result;
  }, [events, agendaSearchQuery, locale, hiddenCalendars]);
  const calendarFilters = [{ id: 'local', name: 'CaboSystems', backgroundColor: '#343e48' }, ...calendars];
  const toggleCalendar = (id: string) => setHiddenCalendars(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const move = (direction: number) => setAnchor(view === 'month' ? shiftMonth(anchor, direction) : shiftDate(anchor, direction * (view === 'week' ? 7 : 1)));
  const today = dateKey(new Date());
  const heading = view === 'day' ? parseDateKey(anchor).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : view === 'week' ? `${parseDateKey(from).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} – ${parseDateKey(to).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}` : parseDateKey(anchor).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
  const renderEvent = (event: CompanyEvent) => <button type="button" key={event.id} className={`company-event ${event.google ? 'has-calendar-color' : ''}`} style={calendarAppearance(event)} onClick={() => setDialog({ event, day: event.occurrence_date || event.fecha })}>
    {event.repeticion !== 'ninguna' || event.google?.recurring ? <Repeat2 size={14} role="img" aria-label={t('Se repite')} /> : <CalendarDays size={14} aria-hidden="true" />}
    <span><span className="company-event-title">{event.google?.availabilityOnly ? (locale.startsWith('en') ? 'Busy' : 'Ocupado') : event.titulo}</span><span className="company-event-meta">{eventSchedule(event, locale)}</span>{view !== 'month' && event.ubicacion && <span className="company-event-meta">{event.ubicacion}</span>}</span>
  </button>;

  return <section className="task-workspace operational-panel company-agenda" aria-label={t('Agenda de la empresa')}>
    <button type="button" className="company-agenda-sidebar-toggle" aria-expanded={sidebarOpen} aria-controls="company-agenda-sidebar" onClick={() => setSidebarOpen(value => !value)}><CalendarDays size={16} />{locale.startsWith('en') ? 'Date and calendars' : 'Fecha y calendarios'}<span>{sidebarOpen ? '−' : '+'}</span></button>
    <div className="company-agenda-body">
    <aside id="company-agenda-sidebar" className={`company-agenda-sidebar ${sidebarOpen ? 'is-open' : ''}`} aria-label={locale.startsWith('en') ? 'Calendar navigation' : 'Navegación de calendario'}>
      <AgendaMiniCalendar selected={anchor} locale={locale} onSelect={day => { setAnchor(day); setSidebarOpen(false); }} />
    <fieldset className="company-calendar-filters"><legend>{locale.startsWith('en') ? 'My calendars' : 'Mis calendarios'}</legend>{calendarFilters.map(calendar => <label key={calendar.id}><input type="checkbox" checked={!hiddenCalendars.includes(calendar.id)} onChange={() => toggleCalendar(calendar.id)} style={{ accentColor: calendar.backgroundColor && /^#[a-f0-9]{6}$/i.test(calendar.backgroundColor) ? calendar.backgroundColor : '#343e48' }} /><span>{calendar.name}</span></label>)}</fieldset>
    </aside>
    <div className="company-agenda-main">
    <div className="agenda-toolbar">
      <div className="agenda-period-heading"><button className="workspace-button" onClick={() => setAnchor(today)}>{t('Hoy')}</button><div className="agenda-period-arrows"><button className="workspace-icon agenda-period-arrow" aria-label={t('Periodo anterior')} onClick={() => move(-1)}><ChevronLeft size={20} /></button><button className="workspace-icon agenda-period-arrow" aria-label={t('Periodo siguiente')} onClick={() => move(1)}><ChevronRight size={20} /></button></div><h2 className="agenda-month-title" aria-live="polite">{heading}</h2></div>
      <div className="agenda-date-controls">{canConnectGoogle && <button type="button" className="workspace-button" onClick={() => setGoogleOpen(true)}>Google Calendar</button>}<AppSelect aria-label={t('Vista de agenda')} value={view} onChange={(e) => setView(e.target.value as CompanyAgendaView)}><option value="month">{t('Mes')}</option><option value="week">{t('Semana')}</option><option value="day">{t('Día')}</option></AppSelect><input type="date" min="1900-01-01" max="9999-12-31" aria-label={t('Ir a fecha')} value={anchor} onChange={(e) => { if (e.target.validity.valid && e.target.value) setAnchor(e.target.value); }} /></div>
    </div>

    {error ? <div role="alert" className="workspace-empty"><p>{t(error)}</p>{canConnectGoogle && error.includes('Vuelve a autorizar') && <button type="button" className="workspace-primary" onClick={() => setGoogleOpen(true)}>Google Calendar</button>}<button className="workspace-button" onClick={() => void load(true)}>{t('Reintentar')}</button></div> : null}
    {loading && <p className="company-sync-status" role="status" aria-live="polite">{locale.startsWith('en') ? 'Loading events…' : 'Cargando eventos…'}</p>}
    <div className="company-calendar-scroll" tabIndex={0} role="region" aria-label={t('Calendario de eventos')}>
      {!loading && !error && byDay.size === 0 && <p className="company-empty" role="status">{t('No hay eventos en este periodo.')}</p>}
      {view === 'month' ? <table className="company-calendar"><thead><tr>{days.slice(0, 7).map((day) => <th key={day} scope="col">{parseDateKey(day).toLocaleDateString(locale, { weekday: 'short' })}</th>)}</tr></thead><tbody>{Array.from({ length: days.length / 7 }, (_, index) => <tr key={index}>{days.slice(index * 7, index * 7 + 7).map((day) => {
        const items = byDay.get(day) || [];
        return <td key={day} className={`${day.slice(0, 7) !== anchor.slice(0, 7) ? 'is-outside-month' : ''} ${day === today ? 'is-today' : ''}`}><div className="company-day-heading"><button type="button" className="agenda-month-date" aria-label={parseDateKey(day).toLocaleDateString(locale, { dateStyle: 'full' })} aria-current={day === today ? 'date' : undefined} onClick={() => { setAnchor(day); setView('day'); }}>{parseDateKey(day).getDate()}</button>{canManage && <button type="button" className="workspace-icon company-add" aria-label={t('Crear evento para el {date}', { date: parseDateKey(day).toLocaleDateString(locale) })} onClick={() => setDialog({ event: null, day })}><Plus size={14} /></button>}</div>{items.slice(0, 3).map(renderEvent)}{items.length > 3 && <button className="company-more" onClick={() => { setAnchor(day); setView('day'); }}>{t('Ver {count} más', { count: items.length - 3 })}</button>}</td>;
      })}</tr>)}</tbody></table> : <div className={`company-columns ${view === 'day' ? 'is-day' : ''}`}>{days.map((day) => <section key={day} className={day === today ? 'is-today' : ''}><header className="company-day-heading"><h3>{parseDateKey(day).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}</h3>{canManage && <button className="workspace-icon company-add" aria-label={t('Crear evento para el {date}', { date: parseDateKey(day).toLocaleDateString(locale) })} onClick={() => setDialog({ event: null, day })}><Plus size={16} /></button>}</header>{(byDay.get(day) || []).map(renderEvent)}{!loading && !error && !byDay.has(day) && <p className="company-empty">{t('Sin eventos')}</p>}</section>)}</div>}
    </div>
    </div>
    </div>
    {dialog && <EventDialog key={dialog.event?.id || dialog.day} {...dialog} canManage={canManage} onClose={() => setDialog(null)} onSaved={() => { setDialog(null); void load(true); }} />}
    {googleOpen && canConnectGoogle && <GoogleCalendarDialog key={user!.id} onClose={() => { setGoogleOpen(false); void load(true); }} />}
  </section>;
}
