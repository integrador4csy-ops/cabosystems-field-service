import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Repeat2 } from 'lucide-react';
import type { AgendaSearchClient } from '../../lib/agendaSearchClient';
import { sortAgendaSearch, type AgendaSearchResponse } from '../../lib/agendaSearch';
import { calendarAppearance, eventSchedule } from '../../lib/agendaPresentation';
import { parseDateKey } from '../../lib/taskDates';
import type { CompanyEvent } from '../../types/agenda';

export function AgendaSearchResults({ colors = {}, client, query, today, locale, hiddenCalendars, revision, onOpen, onDate, onClear }: {
  colors?: Record<string, string>; client: AgendaSearchClient;
  query: string; today: string; locale: string; hiddenCalendars: string[]; revision: number;
  onOpen: (event: CompanyEvent) => void; onDate: (day: string) => void; onClear: () => void;
}) {
  const en = locale.startsWith('en');
  const [snapshot, setSnapshot] = useState<{ query: string; data?: AgendaSearchResponse; failed?: boolean } | null>(null);
  const [retry, setRetry] = useState(0);
  const [limit, setLimit] = useState(50);
  useEffect(() => {
    const controller = new AbortController();
    void client.search(query, today, controller.signal, data => { if (!controller.signal.aborted) setSnapshot({ query, data }); })
      .then(data => { if (!controller.signal.aborted) setSnapshot({ query, data }); })
      .catch(() => { if (!controller.signal.aborted) setSnapshot(current => ({ query, data: current?.query === query ? current.data : undefined, failed: true })); });
    return () => controller.abort();
  }, [client, query, today, retry, revision]);
  const current = snapshot?.query === query ? snapshot : null;
  const results = useMemo(() => sortAgendaSearch((current?.data?.hits || []).filter(hit => !hiddenCalendars.includes(hit.event.google?.calendarId || 'local')), today, query), [current, hiddenCalendars, today, query]);
  const visible = useRef(results);
  useEffect(() => { visible.current = results; }, [results]);
  const pendingIds = results.slice(0, limit).filter(hit => hit.nextDatePending).map(hit => hit.event.id).join('|');
  useEffect(() => {
    if (!pendingIds) return;
    const controller = new AbortController();
    const ids = new Set(pendingIds.split('|'));
    void client.completeDates(visible.current.filter(hit => ids.has(hit.event.id)), today, controller.signal).then(dates => {
      if (controller.signal.aborted) return;
      const byId = new Map(dates.map(date => [date.id, date.nextDate]));
      setSnapshot(current => current?.query !== query || !current.data ? current : { ...current, data: { ...current.data, hits: current.data.hits.map(hit => ids.has(hit.event.id) ? { ...hit, nextDate: byId.get(hit.event.id) ?? null, nextDatePending: false, nextDateUnavailable: !byId.has(hit.event.id) } : hit) } });
    }).catch(() => {
      if (!controller.signal.aborted) setSnapshot(current => current?.query !== query || !current.data ? current : { ...current, data: { ...current.data, hits: current.data.hits.map(hit => ids.has(hit.event.id) ? { ...hit, nextDatePending: false, nextDateUnavailable: true } : hit) } });
    });
    return () => controller.abort();
  }, [client, pendingIds, query, today]);
  const formatDate = (day: string) => parseDateKey(day).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  return <section className="agenda-search-results" aria-label={en ? 'Global calendar search' : 'Búsqueda global de agenda'}>
    <header className="agenda-search-heading"><div><h2>{en ? 'Search all dates' : 'Buscar en todas las fechas'}</h2><p role="status" aria-live="polite">{!current ? (en ? 'Searching all calendars…' : 'Buscando en todos los calendarios…') : current.failed ? (en ? 'Search could not be completed.' : 'No se pudo completar la búsqueda.') : `${results.length} ${en ? (results.length === 1 ? 'result' : 'results') : (results.length === 1 ? 'coincidencia' : 'coincidencias')} · “${query}”${current.data?.pending ? (en ? ' · completing search…' : ' · completando búsqueda…') : ''}`}</p></div><button type="button" className="workspace-button" onClick={onClear}>{en ? 'Back to calendar' : 'Volver al calendario'}</button></header>
    {current?.failed ? <div role="alert" className="workspace-empty"><p>{en ? 'Check your connection and try again. The visible results are incomplete.' : 'Comprueba tu conexión e intenta de nuevo. Los resultados visibles están incompletos.'}</p><button type="button" className="workspace-button" onClick={() => setRetry(value => value + 1)}>{en ? 'Try again' : 'Reintentar'}</button></div> : null}
    {current?.data ? <>
      <p className="agenda-search-help">{en ? 'Searches titles, descriptions, locations and calendar names. Recurring series appear once with their next date.' : 'Busca en títulos, descripciones, ubicaciones y nombres de calendarios. Cada serie aparece una vez con su próxima fecha.'}</p>
      {current.data.unavailableCalendars > 0 ? <p className="agenda-search-help">{en ? 'Calendars sharing only availability cannot be searched by text.' : 'Los calendarios que solo comparten disponibilidad no permiten buscar por texto.'}</p> : null}
      {!results.length && !current.data.pending && !current.failed ? <p className="workspace-empty">{en ? 'No matches in the selected calendars, across all dates.' : 'No hay coincidencias en los calendarios seleccionados, en ninguna fecha.'}</p> : null}
      <ul className="agenda-search-list">{results.slice(0, limit).map(hit => {
        const event = hit.event; const day = hit.nextDate || event.occurrence_date || event.fecha;
        return <li key={event.id} className="agenda-search-row">
          <div className="agenda-search-date"><span>{hit.nextDatePending || hit.nextDateUnavailable ? (en ? 'Series start: ' : 'Inicio de serie: ') : ''}{formatDate(day)}</span>{hit.series ? <small><Repeat2 size={14} aria-hidden="true" />{hit.nextDatePending ? (en ? 'Finding next date…' : 'Consultando próxima fecha…') : hit.nextDateUnavailable ? (en ? 'Next date unavailable' : 'Próxima fecha no disponible') : hit.nextDate ? (en ? 'Next occurrence' : 'Próxima fecha') : (en ? 'Series · start date' : 'Serie · fecha inicial')}</small> : null}</div>
          <button type="button" className={`agenda-search-event ${event.google || colors['local'] ? 'has-calendar-color' : ''}`} style={calendarAppearance(event, colors[event.google?.calendarId || 'local'])} onClick={() => onOpen(event)}><strong>{event.titulo}</strong><span>{eventSchedule(event, locale)}</span>{event.ubicacion ? <span>{event.ubicacion}</span> : null}<span>{event.google?.calendarName || 'CaboSystems'}</span></button>
          <button type="button" className="workspace-button agenda-search-go" disabled={hit.nextDatePending} onClick={() => onDate(day)} aria-label={`${en ? 'Go to' : 'Ir al'} ${formatDate(day)}`}><CalendarDays size={16} aria-hidden="true" />{en ? 'View date' : 'Ver fecha'}</button>
        </li>;
      })}</ul>
      {results.length > limit ? <button type="button" className="workspace-button agenda-search-more" onClick={() => setLimit(value => value + 50)}>{en ? 'Show more results' : 'Mostrar más resultados'} ({results.length - limit})</button> : null}
    </> : null}
  </section>;
}
