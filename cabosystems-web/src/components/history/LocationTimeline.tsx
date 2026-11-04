import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { HistoryTimelineEvent, HistoryStop, HistoryMovement } from '../../lib/locationHistoryAnalytics';
import { formatTimeOfDay, formatDurationMs } from '../../lib/locationHistoryAnalytics';
import {
  Clock,
  Navigation,
  AlertTriangle,
  Building2,
  MapPin,
  Battery,
  ShieldAlert,
  Home,
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

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400">
        <Clock className="h-10 w-10 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-600">{t('Sin actividad registrada')}</p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs">
          {t('No se detectaron movimientos o paradas para este técnico en la fecha seleccionada.')}
        </p>
      </div>
    );
  }

  const renderStopBadge = (stop: HistoryStop) => {
    if (stop.placeCategory === 'villa') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
          <Home className="h-3 w-3" />
          {t('Villa asignada')}
        </span>
      );
    }
    if (stop.placeCategory === 'office') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
          <Building2 className="h-3 w-3" />
          {t('Base de operaciones')}
        </span>
      );
    }
    if (stop.isProlonged) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-300 animate-pulse">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          {t('Parada prolongada (>20 min)')}
        </span>
      );
    }
    if (stop.placeCategory === 'commercial') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 border border-purple-200">
          <Store className="h-3 w-3" />
          {t('Comercio o plaza')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
        <MapPin className="h-3 w-3 text-slate-400" />
        {t('Parada regular')}
      </span>
    );
  };

  return (
    <div className="relative flex flex-col space-y-3 py-2">
      {isLoadingPlaces && (
        <div className="text-[11px] text-[#f78c26] bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-1 flex items-center gap-1.5 animate-pulse">
          <Clock className="h-3 w-3 animate-spin" />
          <span>{t('Identificando calles y plazas de las paradas...')}</span>
        </div>
      )}

      {events.map((event, index) => {
        const isSelected = selectedEventId === event.id;

        if (event.type === 'movement') {
          const mov = event as HistoryMovement;
          return (
            <div
              key={mov.id}
              onClick={() => onSelectEvent(mov)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') onSelectEvent(mov);
              }}
              className={`group flex items-start gap-3 rounded-xl p-2.5 transition-all cursor-pointer border ${
                isSelected
                  ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400/20'
                  : 'bg-white border-slate-100 hover:border-blue-200 hover:bg-slate-50/80'
              }`}
            >
              {/* Connector line and dot */}
              <div className="relative flex flex-col items-center self-stretch shrink-0 pt-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <Navigation className="h-3.5 w-3.5 rotate-45" />
                </div>
                {index < events.length - 1 && (
                  <div className="w-0.5 grow bg-slate-200 my-1 group-hover:bg-blue-200 transition-colors" />
                )}
              </div>

              {/* Movement Details */}
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    {t('En recorrido')}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-500">
                    {formatDurationMs(mov.durationMs)}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                  <span>
                    {formatTimeOfDay(mov.startTime)} - {formatTimeOfDay(mov.endTime)}
                  </span>
                  <span>·</span>
                  <span className="font-medium text-slate-700">
                    {(mov.distanceMeters / 1000).toFixed(1)} km
                  </span>
                  <span>·</span>
                  <span>
                    {t('Promedio')}: {mov.avgSpeedKmH} km/h
                  </span>
                </div>
              </div>
            </div>
          );
        }

        // Stop Event
        const stop = event as HistoryStop;
        return (
          <div
            key={stop.id}
            onClick={() => onSelectEvent(stop)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectEvent(stop);
            }}
            className={`group flex items-start gap-3 rounded-xl p-3 transition-all cursor-pointer border ${
              isSelected
                ? stop.isProlonged
                  ? 'bg-amber-50/90 border-amber-400 ring-2 ring-amber-400/20 shadow-xs'
                  : 'bg-slate-50 border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
                : stop.isProlonged
                ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300 hover:bg-amber-50/70'
                : 'bg-white border-slate-100 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {/* Dot indicator */}
            <div className="relative flex flex-col items-center self-stretch shrink-0 pt-1">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-xl shadow-xs font-bold text-xs ${
                  stop.placeCategory === 'villa'
                    ? 'bg-emerald-500 text-white'
                    : stop.placeCategory === 'office'
                    ? 'bg-blue-600 text-white'
                    : stop.isProlonged
                    ? 'bg-amber-500 text-white'
                    : 'bg-slate-600 text-white'
                }`}
              >
                {stop.isProlonged ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
              </div>
              {index < events.length - 1 && (
                <div className="w-0.5 grow bg-slate-200 my-1 group-hover:bg-slate-300 transition-colors" />
              )}
            </div>

            {/* Stop content */}
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1 flex-wrap">
                {renderStopBadge(stop)}
                <span className="text-xs font-bold text-slate-800">
                  {formatDurationMs(stop.durationMs)}
                </span>
              </div>

              {/* Resolved Place Name or Street */}
              <div className="mt-1.5 font-bold text-slate-800 text-sm truncate">
                {stop.placeName || t('Ubicación aproximada')}
              </div>

              {stop.address && stop.address !== stop.placeName && (
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {stop.address}
                </div>
              )}

              {/* Footer info: time range, accuracy, battery */}
              <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                <span className="font-medium text-slate-600">
                  {formatTimeOfDay(stop.startTime)} - {formatTimeOfDay(stop.endTime)}
                </span>
                <span>·</span>
                <span>±{stop.accuracy}m</span>
                {stop.batteryStart !== null && (
                  <>
                    <span>·</span>
                    <span className="inline-flex items-center gap-0.5 text-slate-600">
                      <Battery className="h-3 w-3 text-slate-400" />
                      {stop.batteryStart}%
                      {stop.batteryEnd !== null && stop.batteryEnd !== stop.batteryStart && (
                        <span>→ {stop.batteryEnd}%</span>
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
