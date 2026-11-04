import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { HistoryTimelineEvent, HistoryStop, HistoryMovement } from '../../lib/locationHistoryAnalytics';
import { formatTimeOfDay, formatDurationMs } from '../../lib/locationHistoryAnalytics';
import {
  AlertTriangle,
  Battery,
  Building2,
  Clock3,
  Home,
  MapPin,
  Navigation,
  Store,
} from 'lucide-react';

interface LocationTimelineProps {
  events: HistoryTimelineEvent[];
  selectedEventId: string | null;
  onSelectEvent: (event: HistoryTimelineEvent) => void;
  isLoadingPlaces?: boolean;
}

export const LocationTimeline: React.FC<LocationTimelineProps> = ({
  events,
  selectedEventId,
  onSelectEvent,
  isLoadingPlaces,
}) => {
  const { t } = useLanguage();

  if (!events.length) {
    return (
      <div className="location-history-empty">
        <div><Clock3 size={22} aria-hidden="true" /></div>
        <strong>{t('Sin actividad registrada')}</strong>
        <p>{t('No se detectaron movimientos o paradas para este técnico en la fecha seleccionada.')}</p>
      </div>
    );
  }

  const stopLabel = (stop: HistoryStop) => {
    if (stop.isProlonged) return { icon: AlertTriangle, text: t('Parada prolongada'), tone: 'warning' };
    if (stop.placeCategory === 'villa') return { icon: Home, text: t('Villa asignada'), tone: 'villa' };
    if (stop.placeCategory === 'office') return { icon: Building2, text: t('Base de operaciones'), tone: 'office' };
    if (stop.placeCategory === 'commercial') return { icon: Store, text: t('Comercio o plaza'), tone: 'commercial' };
    return { icon: MapPin, text: t('Parada'), tone: 'regular' };
  };

  return (
    <div className="location-timeline">
      {isLoadingPlaces && (
        <div className="location-timeline-resolving" role="status">
          <span aria-hidden="true" />
          {t('Identificando lugares de las paradas...')}
        </div>
      )}

      <ol>
        {events.map((event, index) => {
          const selected = selectedEventId === event.id;
          const isLast = index === events.length - 1;

          if (event.type === 'movement') {
            const movement = event as HistoryMovement;
            return (
              <li key={movement.id} className="location-timeline-item is-movement">
                <span className="location-timeline-rail" aria-hidden="true">
                  <span><Navigation size={14} /></span>
                  {!isLast && <i />}
                </span>
                <button type="button" aria-pressed={selected} onClick={() => onSelectEvent(movement)}>
                  <span className="location-timeline-event-heading">
                    <strong>{t('En recorrido')}</strong>
                    <b>{formatDurationMs(movement.durationMs)}</b>
                  </span>
                  <span className="location-timeline-time">{formatTimeOfDay(movement.startTime)} – {formatTimeOfDay(movement.endTime)}</span>
                  <span className="location-timeline-stats">
                    <span><strong>{(movement.distanceMeters / 1000).toFixed(1)}</strong> km</span>
                    <span><strong>{movement.avgSpeedKmH}</strong> km/h {t('promedio')}</span>
                  </span>
                </button>
              </li>
            );
          }

          const stop = event as HistoryStop;
          const label = stopLabel(stop);
          const LabelIcon = label.icon;
          return (
            <li key={stop.id} className={`location-timeline-item is-stop ${stop.isProlonged ? 'is-prolonged' : ''}`}>
              <span className="location-timeline-rail" aria-hidden="true">
                <span><Clock3 size={14} /></span>
                {!isLast && <i />}
              </span>
              <button type="button" aria-pressed={selected} onClick={() => onSelectEvent(stop)}>
                <span className="location-timeline-event-heading">
                  <span className={`location-timeline-label is-${label.tone}`}><LabelIcon size={12} />{label.text}</span>
                  <b>{formatDurationMs(stop.durationMs)}</b>
                </span>
                <strong className="location-timeline-place">{stop.placeName || t('Ubicación aproximada')}</strong>
                {stop.address && stop.address !== stop.placeName && <span className="location-timeline-address">{stop.address}</span>}
                <span className="location-timeline-meta">
                  <span>{formatTimeOfDay(stop.startTime)} – {formatTimeOfDay(stop.endTime)}</span>
                  <span>±{stop.accuracy} m</span>
                  {stop.batteryStart !== null && (
                    <span><Battery size={12} />{stop.batteryStart}%{stop.batteryEnd !== null && stop.batteryEnd !== stop.batteryStart ? ` → ${stop.batteryEnd}%` : ''}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
