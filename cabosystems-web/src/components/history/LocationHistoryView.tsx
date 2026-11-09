import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { supabase } from '../../lib/supabase';
import {
  analyzeLocationHistory,
  type DailyHistoryAnalysis,
  type HistoryTimelineEvent,
  type HistoryStop,
  formatDurationMs,
} from '../../lib/locationHistoryAnalytics';
import { resolveLocationPlace, loadKnownVillas } from '../../lib/locationPlacesService';
import { LocationTimeline } from './LocationTimeline';
import { LocationHistoryMap } from './LocationHistoryMap';
import {
  AlertTriangle,
  Clock3,
  ListTree,
  Map,
  Navigation,
  Route,
} from 'lucide-react';
import './LocationHistory.css';

interface LocationHistoryViewProps {
  selectedWorkerId: string;
  selectedDate: string;
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
  timelinePath: [],
};

export const LocationHistoryView: React.FC<LocationHistoryViewProps> = ({
  selectedWorkerId: currentWorkerId,
  selectedDate,
}) => {
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(Boolean(currentWorkerId));
  const [isLoadingPlaces, setIsLoadingPlaces] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [analysis, setAnalysis] = useState<DailyHistoryAnalysis | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HistoryTimelineEvent | null>(null);
  const [loadedKey, setLoadedKey] = useState('');
  const [mobilePanel, setMobilePanel] = useState<'timeline' | 'map'>('timeline');
  const villasRequest = useRef<ReturnType<typeof loadKnownVillas> | null>(null);
  const requestVersion = useRef(0);
  const requestKey = `${currentWorkerId}:${selectedDate}`;
  const showLoading = isLoading || Boolean(currentWorkerId && !fetchError && loadedKey !== requestKey);

  const fetchDayHistory = useCallback(async (force = false) => {
    const nextKey = `${currentWorkerId}:${selectedDate}`;
    if (!force && loadedKey === nextKey) return;
    if (!currentWorkerId) {
      setAnalysis(emptyAnalysis);
      setLoadedKey(nextKey);
      setIsLoading(false);
      return;
    }

    const version = ++requestVersion.current;
    setIsLoading(true);
    setFetchError('');
    setSelectedEvent(null);

    try {
      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(`${selectedDate}T23:59:59.999`);
      const historyRequest = supabase
        .from('historial_ubicaciones')
        .select('*')
        .eq('usuario_id', currentWorkerId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: true });
      villasRequest.current ??= loadKnownVillas();
      const [{ data, error }, knownVillas] = await Promise.all([historyRequest, villasRequest.current]);

      if (error) throw error;
      if (version !== requestVersion.current) return;
      if (!data?.length) {
        setAnalysis(emptyAnalysis);
        setLoadedKey(nextKey);
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
      if (version === requestVersion.current) setLoadedKey(nextKey);
    } catch (error) {
      if (version !== requestVersion.current) return;
      console.warn('Error fetching location history:', error);
      setAnalysis(null);
      setFetchError(t('No se pudo cargar el historial de rutas. Revisa tu conexión e intenta de nuevo.'));
    } finally {
      if (version === requestVersion.current) {
        setIsLoading(false);
        setIsLoadingPlaces(false);
      }
    }
  }, [currentWorkerId, loadedKey, selectedDate, t]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => { if (!cancelled) void fetchDayHistory(); });
    return () => { cancelled = true; };
  }, [fetchDayHistory]);

  const metrics = [
    { label: t('Distancia recorrida'), value: `${((analysis?.totalDistanceMeters || 0) / 1000).toFixed(1)} km`, icon: Route },
    { label: t('Tiempo en movimiento'), value: analysis?.totalMovingTimeMs ? formatDurationMs(analysis.totalMovingTimeMs) : '0 min', icon: Navigation },
    { label: t('Paradas registradas'), value: String(analysis?.totalStops || 0), icon: Clock3 },
    { label: t('Paradas prolongadas'), value: String(analysis?.prolongedStops || 0), icon: AlertTriangle, warning: Boolean(analysis?.prolongedStops) },
  ];

  return (
    <section className="location-history operational-panel" aria-label={t('Historial de ubicaciones y rutas')}>
      <div className="location-history-metrics" aria-label={t('Resumen de la jornada')}>
        {metrics.map(({ label, value, icon: Icon, warning }) => (
          <div key={label} className={`location-history-metric ${warning ? 'is-warning' : ''}`}>
            <Icon size={17} aria-hidden="true" />
            <div><span>{label}</span><strong>{showLoading ? '—' : value}</strong></div>
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
          <button type="button" onClick={() => void fetchDayHistory(true)}>{t('Reintentar')}</button>
        </div>
      )}

      <div className="location-history-body">
        <aside className={`location-history-timeline-panel ${mobilePanel === 'timeline' ? 'is-mobile-active' : ''}`} aria-label={t('Línea de tiempo de la jornada')}>
          <div className="location-history-panel-heading">
            <div><ListTree size={16} aria-hidden="true" /><strong>{t('Recorrido del día')}</strong></div>
            <span>{analysis?.events.length || 0} {t('eventos')}</span>
          </div>
          <div className="location-history-timeline-scroll">
            {showLoading ? (
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
            timelinePath={analysis?.timelinePath ?? emptyAnalysis.timelinePath}
            events={analysis?.events || []}
            selectedEvent={selectedEvent}
            onSelectEvent={setSelectedEvent}
            onRefresh={() => void fetchDayHistory(true)}
            isRefreshing={showLoading}
          />
        </section>
      </div>
    </section>
  );
};
