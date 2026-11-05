import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import type { LiveWorker } from '../../types/fleet';
import {
  analyzeLocationHistory,
  type DailyHistoryAnalysis,
  type HistoryTimelineEvent,
  type HistoryStop,
  formatDurationMs,
} from '../../lib/locationHistoryAnalytics';
import { resolveLocationPlace, loadKnownVillas, type KnownVilla } from '../../lib/locationPlacesService';
import { AppSelect } from '../ui/AppSelect';
import { LocationTimeline } from './LocationTimeline';
import { LocationHistoryMap } from './LocationHistoryMap';
import {
  AlertTriangle,
  CalendarDays,
  Clock3,
  ListTree,
  Map,
  Navigation,
  Route,
} from 'lucide-react';
import './LocationHistory.css';

interface LocationHistoryViewProps {
  workers: LiveWorker[];
  selectedWorkerId: string | null;
  onSelectWorker?: (workerId: string) => void;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const emptyAnalysis: DailyHistoryAnalysis = {
  totalDistanceMeters: 0,
  totalMovingTimeMs: 0,
  totalStopTimeMs: 0,
  totalStops: 0,
  prolongedStops: 0,
  firstTimestamp: null,
  lastTimestamp: null,
  events: [],
  fullPath: [],
};

export const LocationHistoryView: React.FC<LocationHistoryViewProps> = ({
  workers,
  selectedWorkerId: externalWorkerId,
  onSelectWorker,
}) => {
  const { t, locale } = useLanguage();
  const [currentWorkerId, setCurrentWorkerId] = useState(externalWorkerId || workers[0]?.profile.id || '');
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()));
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [analysis, setAnalysis] = useState<DailyHistoryAnalysis | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HistoryTimelineEvent | null>(null);
  const [knownVillas, setKnownVillas] = useState<KnownVilla[]>([]);
  const [mobilePanel, setMobilePanel] = useState<'timeline' | 'map'>('timeline');

  const today = localDateKey(new Date());
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = localDateKey(yesterdayDate);

  useEffect(() => {
    if (externalWorkerId && externalWorkerId !== currentWorkerId) setCurrentWorkerId(externalWorkerId);
  }, [externalWorkerId, currentWorkerId]);

  useEffect(() => {
    if (!currentWorkerId && workers[0]?.profile.id) setCurrentWorkerId(workers[0].profile.id);
  }, [currentWorkerId, workers]);

  useEffect(() => {
    void loadKnownVillas().then(setKnownVillas);
  }, []);

  const activeWorker = useMemo(
    () => workers.find((worker) => worker.profile.id === currentWorkerId),
    [workers, currentWorkerId]
  );

  const activeWorkerName = activeWorker?.profile.nombre || activeWorker?.profile.full_name || t('Técnico');
  const selectedDayLabel = useMemo(() => {
    const date = new Date(`${selectedDate}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? selectedDate
      : date.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  }, [locale, selectedDate]);

  const fetchDayHistory = useCallback(async () => {
    if (!currentWorkerId) {
      setAnalysis(emptyAnalysis);
      return;
    }

    setIsLoading(true);
    setFetchError('');
    setSelectedEvent(null);

    try {
      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(`${selectedDate}T23:59:59.999`);
      const { data, error } = await supabase
        .from('historial_ubicaciones')
        .select('*')
        .eq('usuario_id', currentWorkerId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!data?.length) {
        setAnalysis(emptyAnalysis);
        return;
      }

      const result = analyzeLocationHistory(data);
      setAnalysis(result);

      if (result.events.some((event) => event.type === 'stop')) {
        setIsLoadingPlaces(true);
        const updatedEvents = [...result.events];
        for (let index = 0; index < updatedEvents.length; index += 1) {
          const event = updatedEvents[index];
          if (event.type !== 'stop') continue;
          const stop = event as HistoryStop;
          try {
            const place = await resolveLocationPlace(stop.lat, stop.lng, knownVillas);
            updatedEvents[index] = {
              ...stop,
              placeName: place.displayName,
              placeCategory: place.category,
              address: place.rawAddress,
            };
          } catch (placeError) {
            console.warn('Place resolution failed for stop:', placeError);
          }
        }
        setAnalysis((previous) => previous ? { ...previous, events: updatedEvents } : null);
      }
    } catch (error) {
      console.warn('Error fetching location history:', error);
      setAnalysis(null);
      setFetchError(t('No se pudo cargar el historial de rutas. Revisa tu conexión e intenta de nuevo.'));
    } finally {
      setIsLoading(false);
      setIsLoadingPlaces(false);
    }
  }, [currentWorkerId, knownVillas, selectedDate, t]);

  useEffect(() => {
    void fetchDayHistory();
  }, [fetchDayHistory]);

  const metrics = [
    { label: t('Distancia recorrida'), value: `${((analysis?.totalDistanceMeters || 0) / 1000).toFixed(1)} km`, icon: Route },
    { label: t('Tiempo en movimiento'), value: analysis?.totalMovingTimeMs ? formatDurationMs(analysis.totalMovingTimeMs) : '0 min', icon: Navigation },
    { label: t('Paradas registradas'), value: String(analysis?.totalStops || 0), icon: Clock3 },
    { label: t('Paradas prolongadas'), value: String(analysis?.prolongedStops || 0), icon: AlertTriangle, warning: Boolean(analysis?.prolongedStops) },
  ];

  return (
    <section className="location-history operational-panel" aria-label={t('Historial de ubicaciones y rutas')}>
      <header className="location-history-header">
        <div className="location-history-heading">
          <div>
            <h1>{t('Historial de rutas')}</h1>
            <p>{activeWorkerName} <span aria-hidden="true">·</span> <span className="location-history-date-label">{selectedDayLabel}</span></p>
          </div>
        </div>

        <div className="location-history-filters" aria-label={t('Filtros del historial')}>
          <label className="location-history-worker-filter">
            <span>{t('Técnico')}</span>
            <AppSelect
              aria-label={t('Seleccionar técnico')}
              value={currentWorkerId}
              disabled={workers.length === 0}
              onChange={(event) => {
                setCurrentWorkerId(event.target.value);
                onSelectWorker?.(event.target.value);
              }}
            >
              {workers.map((worker) => (
                <option key={worker.profile.id} value={worker.profile.id}>
                  {worker.profile.nombre || worker.profile.full_name || t('Técnico')}
                </option>
              ))}
            </AppSelect>
          </label>

          <div className="location-history-date-presets" aria-label={t('Fechas rápidas')}>
            <button type="button" aria-pressed={selectedDate === today} onClick={() => setSelectedDate(today)}>{t('Hoy')}</button>
            <button type="button" aria-pressed={selectedDate === yesterday} onClick={() => setSelectedDate(yesterday)}>{t('Ayer')}</button>
          </div>

          <label className="location-history-date-input">
            <CalendarDays size={16} aria-hidden="true" />
            <span className="sr-only">{t('Seleccionar fecha')}</span>
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>

        </div>
      </header>

      <div className="location-history-metrics" aria-label={t('Resumen de la jornada')}>
        {metrics.map(({ label, value, icon: Icon, warning }) => (
          <div key={label} className={`location-history-metric ${warning ? 'is-warning' : ''}`}>
            <Icon size={17} aria-hidden="true" />
            <div><span>{label}</span><strong>{isLoading ? '—' : value}</strong></div>
          </div>
        ))}
      </div>

      <div className="location-history-mobile-switch" aria-label={t('Vista del historial')}>
        <button type="button" aria-pressed={mobilePanel === 'timeline'} onClick={() => setMobilePanel('timeline')}><ListTree size={16} />{t('Recorrido')}</button>
        <button type="button" aria-pressed={mobilePanel === 'map'} onClick={() => setMobilePanel('map')}><Map size={16} />{t('Mapa')}</button>
      </div>

      {fetchError && (
        <div className="location-history-error" role="alert">
          <span>{fetchError}</span>
          <button type="button" onClick={() => void fetchDayHistory()}>{t('Reintentar')}</button>
        </div>
      )}

      <div className="location-history-body">
        <aside className={`location-history-timeline-panel ${mobilePanel === 'timeline' ? 'is-mobile-active' : ''}`} aria-label={t('Línea de tiempo de la jornada')}>
          <div className="location-history-panel-heading">
            <div><ListTree size={16} aria-hidden="true" /><strong>{t('Recorrido del día')}</strong></div>
            <span>{analysis?.events.length || 0} {t('eventos')}</span>
          </div>
          <div className="location-history-timeline-scroll">
            {isLoading ? (
              <div className="location-history-loading" role="status" aria-live="polite">
                <div /><div /><div />
                <span>{t('Cargando historial de ubicaciones...')}</span>
              </div>
            ) : !fetchError ? (
              <LocationTimeline
                events={analysis?.events || []}
                selectedEventId={selectedEvent?.id || null}
                onSelectEvent={setSelectedEvent}
                isLoadingPlaces={isLoadingPlaces}
              />
            ) : null}
          </div>
        </aside>

        <section className={`location-history-map-panel ${mobilePanel === 'map' ? 'is-mobile-active' : ''}`} aria-label={t('Mapa de la ruta')}>
          <LocationHistoryMap
            fullPath={analysis?.fullPath || []}
            events={analysis?.events || []}
            selectedEvent={selectedEvent}
            onSelectEvent={setSelectedEvent}
            onRefresh={() => void fetchDayHistory()}
            isRefreshing={isLoading}
          />
        </section>
      </div>
    </section>
  );
};
