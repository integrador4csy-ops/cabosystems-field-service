import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Camera, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, LogIn, LogOut, MapPin, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { getAdminCheckHistory, type AdminCheckHistoryItem } from '../../lib/checkHistory';
import { dateKey, shiftDate } from '../../lib/taskDates';
import { AppSelect } from '../ui/AppSelect';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CS';
}

export interface CheckHistoryViewProps {
  day?: string;
  onDayChange?: (day: string) => void;
  technicianId?: string;
  onTechnicianIdChange?: (id: string) => void;
  refreshTrigger?: number;
  onLoadingChange?: (loading: boolean) => void;
  onTechniciansChange?: (technicians: Array<{ id: string; name: string }>) => void;
  showInlineHeader?: boolean;
}

export function CheckHistoryView({
  day: propDay,
  onDayChange,
  technicianId: propTechnicianId,
  onTechnicianIdChange,
  refreshTrigger = 0,
  onLoadingChange,
  onTechniciansChange,
  showInlineHeader = false,
}: CheckHistoryViewProps = {}) {
  const { t, locale } = useTranslation();
  const today = dateKey(new Date());
  const [internalDay, setInternalDay] = useState(today);
  const [internalTechnicianId, setInternalTechnicianId] = useState('');
  const [rows, setRows] = useState<AdminCheckHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const day = propDay ?? internalDay;
  const setDay = onDayChange ?? setInternalDay;
  const technicianId = propTechnicianId ?? internalTechnicianId;
  const setTechnicianId = onTechnicianIdChange ?? setInternalTechnicianId;

  const load = useCallback(async () => {
    setLoading(true);
    onLoadingChange?.(true);
    setError('');
    try {
      const data = await getAdminCheckHistory(day, technicianId);
      setRows(data);
    } catch (reason) {
      console.error('Could not load check history:', reason);
      setError(t('No se pudo cargar el historial de checks.'));
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  }, [day, technicianId, t, onLoadingChange]);

  useEffect(() => {
    void load();
  }, [load, refreshTrigger]);

  const technicians = useMemo(() => {
    const byId = new Map<string, string>();
    for (const row of rows) byId.set(row.technician_id, row.technician_name);
    return [...byId].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, locale));
  }, [rows, locale]);

  useEffect(() => {
    onTechniciansChange?.(technicians);
  }, [technicians, onTechniciansChange]);

  const grouped = useMemo(() => {
    const groups = new Map<string, AdminCheckHistoryItem[]>();
    for (const row of rows) groups.set(row.technician_id, [...(groups.get(row.technician_id) || []), row]);
    return [...groups.entries()];
  }, [rows]);

  const formattedDay = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${day}T12:00:00`));

  const toggleTechnician = (id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allCollapsed = useMemo(() => {
    return grouped.length > 0 && grouped.every(([id]) => Boolean(collapsedMap[id]));
  }, [grouped, collapsedMap]);

  const toggleAll = () => {
    if (allCollapsed) {
      setCollapsedMap({});
    } else {
      const all: Record<string, boolean> = {};
      for (const [id] of grouped) all[id] = true;
      setCollapsedMap(all);
    }
  };

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-white" aria-label={t('Historial de checks')}>
      {showInlineHeader && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 lg:px-5">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{t('Historial de checks')}</h2>
            <p className="mt-0.5 text-xs capitalize text-slate-500">{formattedDay}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AppSelect aria-label={t('Filtrar por técnico')} value={technicianId} onChange={(event) => setTechnicianId(event.target.value)} className="min-w-44">
              <option value="">{t('Todos los técnicos')}</option>
              {technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.name}</option>)}
            </AppSelect>
            <div className="flex h-10 items-center rounded-lg border border-slate-200 bg-white">
              <button type="button" onClick={() => setDay(shiftDate(day, -1))} className="flex h-full w-9 items-center justify-center text-slate-600 hover:bg-slate-50" aria-label={t('Día anterior')}><ChevronLeft size={17} /></button>
              <button type="button" onClick={() => setDay(today)} className="flex h-full items-center gap-2 border-x border-slate-200 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"><CalendarDays size={16} />{day === today ? t('Hoy') : day}</button>
              <button type="button" disabled={day >= today} onClick={() => setDay(shiftDate(day, 1))} className="flex h-full w-9 items-center justify-center text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300" aria-label={t('Día siguiente')}><ChevronRight size={17} /></button>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50" aria-label={t('Actualizar checks')}><RefreshCw size={17} className={loading ? 'animate-spin' : ''} /></button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-4 lg:p-5">
        {loading && <div className="flex h-full items-center justify-center text-sm text-slate-500">{t('Cargando checks...')}</div>}
        {!loading && error && <div className="flex h-full flex-col items-center justify-center gap-3 text-center"><ClipboardCheck size={32} className="text-slate-400" /><p className="text-sm text-slate-600">{error}</p><button type="button" onClick={() => void load()} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">{t('Reintentar')}</button></div>}
        {!loading && !error && rows.length === 0 && <div className="flex h-full flex-col items-center justify-center gap-2 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600"><ClipboardCheck size={24} /></div><p className="font-semibold text-slate-700">{t('No hay checks registrados')}</p><p className="text-sm text-slate-500">{t('Los check-in y check-out del equipo aparecerán aquí.')}</p></div>}
        {!loading && !error && rows.length > 0 && <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div className="flex items-center justify-between px-1 text-xs text-slate-500">
            <span>{grouped.length} {grouped.length === 1 ? t('técnico') : t('técnicos')} · {rows.length} {rows.length === 1 ? t('registro') : t('registros')}</span>
            {grouped.length > 1 && (
              <button
                type="button"
                onClick={toggleAll}
                className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
              >
                {allCollapsed ? t('Desplegar todos') : t('Colapsar todos')}
              </button>
            )}
          </div>
          {grouped.map(([id, entries]) => {
            const person = entries[0];
            const isExpanded = !collapsedMap[id];
            return <article key={id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-shadow hover:shadow-sm">
              <button
                type="button"
                onClick={() => toggleTechnician(id)}
                aria-expanded={isExpanded}
                aria-controls={`tech-checks-${id}`}
                className="flex w-full items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50/80 cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {person.technician_avatar_url ? (
                    <img src={person.technician_avatar_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                      {initials(person.technician_name)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-800">{person.technician_name}</h3>
                    <p className="text-xs text-slate-500">{entries.length} {entries.length === 1 ? t('registro') : t('registros')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-medium text-slate-400 sm:inline-block hidden">
                    {isExpanded ? t('Ocultar') : t('Ver registros')}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
                    <ChevronDown
                      size={18}
                      className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div id={`tech-checks-${id}`} className="divide-y divide-slate-100 bg-white">
                  {entries.map((entry) => {
                    const isIn = entry.check_type === 'check_in';
                    const place = [entry.development, entry.villa].filter(Boolean).join(' · ');
                    const time = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(new Date(entry.checked_at));
                    return <div key={entry.id} className="grid gap-3 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-center hover:bg-slate-50/50 transition-colors">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-full ${isIn ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'}`}>{isIn ? <LogIn size={18} /> : <LogOut size={18} />}</div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${isIn ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-50 text-brand-700'}`}>{isIn ? 'Check-in' : 'Check-out'}</span><time className="text-sm font-semibold text-slate-700">{time}</time></div>
                        {place && <p className="mt-1 flex items-center gap-1 truncate text-sm text-slate-600"><MapPin size={14} className="shrink-0 text-slate-400" />{place}</p>}
                        {entry.comments && <p className="mt-1 text-sm text-slate-500">{entry.comments}</p>}
                      </div>
                      {entry.photo_url && <a href={entry.photo_url} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 justify-self-start rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-700 sm:justify-self-end"><Camera size={15} />{t('Ver evidencia')}</a>}
                    </div>;
                  })}
                </div>
              )}
            </article>;
          })}
        </div>}
      </div>
    </section>
  );
}
