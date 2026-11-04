import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { LocationTimeline } from './LocationTimeline';
import { LocationHistoryMap } from './LocationHistoryMap';
import {
  Calendar,
  Navigation,
  Clock,
  AlertTriangle,
  RotateCw,
  ArrowLeft,
  ChevronDown,
  Sparkles,
  Info,
} from 'lucide-react';

interface LocationHistoryViewProps {
  workers: LiveWorker[];
  selectedWorkerId: string | null;
  onSelectWorker?: (workerId: string) => void;
  onBackToRadar?: () => void;
}

export const LocationHistoryView: React.FC<LocationHistoryViewProps> = ({
  workers,
  selectedWorkerId: externalWorkerId,
  onSelectWorker,
  onBackToRadar,
}) => {
  const { t } = useLanguage();

  // Selected technician
  const [currentWorkerId, setCurrentWorkerId] = useState<string>(
    externalWorkerId || (workers[0]?.profile.id ?? '')
  );

  // Selected date (YYYY-MM-DD), default to today in local timezone
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingPlaces, setIsLoadingPlaces] = useState<boolean>(false);
  const [analysis, setAnalysis] = useState<DailyHistoryAnalysis | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<HistoryTimelineEvent | null>(null);
  const [knownVillas, setKnownVillas] = useState<KnownVilla[]>([]);

  // Keep internal worker selection synced with prop changes
  useEffect(() => {
    if (externalWorkerId && externalWorkerId !== currentWorkerId) {
      setCurrentWorkerId(externalWorkerId);
    }
  }, [externalWorkerId]);

  // Load villas on mount
  useEffect(() => {
    loadKnownVillas().then((villas) => setKnownVillas(villas));
  }, []);

  const activeWorker = useMemo(() => {
    return workers.find((w) => w.profile.id === currentWorkerId);
  }, [workers, currentWorkerId]);

  // Fetch telemetry from historial_ubicaciones for the technician and date
  const fetchDayHistory = useCallback(async () => {
    if (!currentWorkerId) return;

    setIsLoading(true);
    setSelectedEvent(null);

    try {
      // Calculate start and end of selected day (local date converted to ISO range)
      const startOfDay = new Date(`${selectedDate}T00:00:00`);
      const endOfDay = new Date(`${selectedDate}T23:59:59.999`);

      const { data, error } = await supabase
        .from('historial_ubicaciones')
        .select('*')
        .eq('usuario_id', currentWorkerId)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('Error fetching historial_ubicaciones:', error.message);
        setAnalysis(null);
        setIsLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        setAnalysis({
          totalDistanceMeters: 0,
          totalMovingTimeMs: 0,
          totalStopTimeMs: 0,
          totalStops: 0,
          prolongedStops: 0,
          firstTimestamp: null,
          lastTimestamp: null,
          events: [],
          fullPath: [],
        });
        setIsLoading(false);
        return;
      }

      // Initial algorithmic segmentation (stops, prolonged stops, trips)
      const result = analyzeLocationHistory(data);
      setAnalysis(result);
      setIsLoading(false);

      // Async places enrichment (resolves plazas, villas, streets)
      if (result.events.some((e) => e.type === 'stop')) {
        setIsLoadingPlaces(true);
        const updatedEvents = [...result.events];

        for (let i = 0; i < updatedEvents.length; i++) {
          const ev = updatedEvents[i];
          if (ev.type === 'stop') {
            const stop = ev as HistoryStop;
            try {
              const place = await resolveLocationPlace(stop.lat, stop.lng, knownVillas);
              stop.placeName = place.displayName;
              stop.placeCategory = place.category;
              stop.address = place.rawAddress;
            } catch (pErr) {
              console.warn('Place resolution failed for stop:', pErr);
            }
          }
        }

        setAnalysis((prev) => (prev ? { ...prev, events: updatedEvents } : null));
        setIsLoadingPlaces(false);
      }
    } catch (err) {
      console.warn('Unexpected error in fetchDayHistory:', err);
      setIsLoading(false);
      setIsLoadingPlaces(false);
    }
  }, [currentWorkerId, selectedDate, knownVillas]);

  useEffect(() => {
    fetchDayHistory();
  }, [fetchDayHistory]);

  const setPresetDate = (preset: 'today' | 'yesterday') => {
    const target = new Date();
    if (preset === 'yesterday') {
      target.setDate(target.getDate() - 1);
    }
    const year = target.getFullYear();
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const day = String(target.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const hasGoogleKey = Boolean(
    typeof import.meta !== 'undefined' &&
      import.meta.env?.VITE_GOOGLE_MAPS_API_KEY &&
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY.length > 10
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-slate-50">
      {/* Top Bar / Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-xs">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          {onBackToRadar && (
            <button
              onClick={onBackToRadar}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              title={t('Volver al radar')}
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h1 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Navigation className="h-4 w-4 text-[#f78c26]" />
              <span>{t('Historial de Ubicaciones y Rutas')}</span>
            </h1>
            <p className="text-[11px] text-slate-500">
              {activeWorker?.profile.nombre || activeWorker?.profile.full_name
                ? `${activeWorker.profile.nombre || activeWorker.profile.full_name} · ${t('Seguimiento continuo, línea de tiempo de recorridos y detección de paradas')}`
                : t('Seguimiento continuo, línea de tiempo de recorridos y detección de paradas')}
            </p>
          </div>
        </div>

        {/* Center/Right: Technician Selector & Date Filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Worker Dropdown */}
          <div className="relative">
            <select
              value={currentWorkerId}
              onChange={(e) => {
                const id = e.target.value;
                setCurrentWorkerId(id);
                onSelectWorker?.(id);
              }}
              className="appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 pr-8 text-xs font-semibold text-slate-700 shadow-xs hover:bg-white focus:border-[#f78c26] focus:outline-hidden transition-colors"
            >
              {workers.map((w) => (
                <option key={w.profile.id} value={w.profile.id}>
                  {w.profile.nombre || w.profile.full_name || t('Técnico')} ({w.profile.rol?.replace(/_/g, ' ') || 'técnico'})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium text-slate-600 shadow-xs">
            <button
              onClick={() => setPresetDate('today')}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                selectedDate ===
                `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'hover:text-slate-900'
              }`}
            >
              {t('Hoy')}
            </button>
            <button
              onClick={() => setPresetDate('yesterday')}
              className="rounded-lg px-2.5 py-1 text-[11px] font-semibold hover:text-slate-900 transition-colors"
            >
              {t('Ayer')}
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 shadow-xs">
            <Calendar size={13} className="text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-700 focus:outline-hidden"
            />
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchDayHistory()}
            disabled={isLoading}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50 transition-colors shadow-xs"
            title={t('Actualizar')}
          >
            <RotateCw size={14} className={isLoading ? 'animate-spin text-[#f78c26]' : ''} />
          </button>
        </div>
      </div>

      {/* Daily KPI Metric Cards */}
      {analysis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-b border-slate-200 bg-white/70 px-4 py-2.5 backdrop-blur-xs">
          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 font-bold">
              <Navigation size={15} />
            </div>
            <div>
              <div className="text-[10.5px] font-medium text-slate-500">{t('Distancia')}</div>
              <div className="text-xs font-bold text-slate-800">
                {(analysis.totalDistanceMeters / 1000).toFixed(1)} km
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 font-bold">
              <Clock size={15} />
            </div>
            <div>
              <div className="text-[10.5px] font-medium text-slate-500">{t('En movimiento')}</div>
              <div className="text-xs font-bold text-slate-800">
                {formatDurationMs(analysis.totalMovingTimeMs)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-slate-50 border border-slate-100 p-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 font-bold">
              <Clock size={15} />
            </div>
            <div>
              <div className="text-[10.5px] font-medium text-slate-500">{t('Paradas totales')}</div>
              <div className="text-xs font-bold text-slate-800">{analysis.totalStops}</div>
            </div>
          </div>

          <div
            className={`flex items-center gap-2.5 rounded-xl p-2 border ${
              analysis.prolongedStops > 0
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-slate-50 border-slate-100 text-slate-700'
            }`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-lg font-bold ${
                analysis.prolongedStops > 0
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              <AlertTriangle size={15} />
            </div>
            <div>
              <div className="text-[10.5px] font-medium text-slate-500">
                {t('Paradas > 20 min')}
              </div>
              <div className="text-xs font-bold">
                {analysis.prolongedStops > 0 ? (
                  <span className="text-amber-700 font-black">
                    {analysis.prolongedStops} {t('detectadas')}
                  </span>
                ) : (
                  <span>0</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Split: Timeline (Left) + Interactive Route Map (Right) */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
        {/* Left Column: Timeline */}
        <div className="w-full lg:w-96 flex flex-col shrink-0 border-r border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 bg-slate-50/60">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Clock size={14} className="text-[#f78c26]" />
              {t('Línea de tiempo de la jornada')}
            </span>
            {hasGoogleKey ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200" title={t('Google Places y Geocoding activos')}>
                <Sparkles size={10} />
                Google Places
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full" title={t('Geocodificación OSM / Local activa')}>
                <Info size={10} />
                OSM & Villas
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2">
            {isLoading ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
                <RotateCw className="h-6 w-6 animate-spin text-[#f78c26]" />
                <span className="text-xs font-medium">{t('Cargando historial de ubicaciones...')}</span>
              </div>
            ) : (
              <LocationTimeline
                events={analysis?.events || []}
                selectedEventId={selectedEvent?.id || null}
                onSelectEvent={(ev) => setSelectedEvent(ev)}
                isLoadingPlaces={isLoadingPlaces}
              />
            )}
          </div>
        </div>

        {/* Right Column: Route Map */}
        <div className="hidden lg:flex flex-1 h-full min-h-0 relative isolate p-3">
          <div className="h-full w-full rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden relative">
            <LocationHistoryMap
              fullPath={analysis?.fullPath || []}
              events={analysis?.events || []}
              selectedEvent={selectedEvent}
              onSelectEvent={(ev) => setSelectedEvent(ev)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
