import { useTranslation } from '../context/LanguageContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import './Life360Map.css';
import type { LiveWorker } from '../types/fleet';
import { createLife360MarkerHtml, createHoverCardHtml } from './markerHtml';
import { detectPlace, formatDwellTime } from '../lib/places';
import { loadGoogleMaps } from '../lib/googleMapsLoader';
import { MapPinned, Navigation, RotateCw, Route, ZoomIn, ZoomOut } from 'lucide-react';

interface LiveMapProps {
  workers: LiveWorker[];
  selectedWorkerId: string | null;
  onSelectWorker: (workerId: string) => void;
  focusTrigger?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onOpenHistory?: (workerId: string) => void;
}

function calculateBearing(startLat: number, startLng: number, destLat: number, destLng: number): number {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;
  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
  return Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360);
}

function fleetBounds(points: Array<[number, number]>) {
  const bounds = new google.maps.LatLngBounds();
  for (const [lat, lng] of points) bounds.extend({ lat, lng });
  return bounds;
}

interface MarkerAnimationState {
  marker: google.maps.marker.AdvancedMarkerElement;
  content: HTMLDivElement;
  clickListener: google.maps.MapsEventListener;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  startTime: number;
  duration: number;
  animFrameId?: number;
  lastIconHtml?: string;
  lastHoverCardHtml?: string;
  currentHeading?: number;
}

function removeMarker(state: MarkerAnimationState) {
  if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
  state.content.removeEventListener('mouseenter', state.onMouseEnter);
  state.content.removeEventListener('mouseleave', state.onMouseLeave);
  state.clickListener.remove();
  state.marker.map = null;
}

export const LiveMap: React.FC<LiveMapProps> = ({
  workers,
  selectedWorkerId,
  onSelectWorker,
  focusTrigger,
  onRefresh,
  isRefreshing,
  onOpenHistory,
}) => {
  const { t, language } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const savedView = useRef<{ center: google.maps.LatLngLiteral; zoom: number } | null>(null);
  const markersRef = useRef<Map<string, MarkerAnimationState>>(new Map());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const selectedWorkerIdRef = useRef(selectedWorkerId);
  const dwellTimesRef = useRef<Record<string, number>>({});
  const hasCenteredOnceRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  selectedWorkerIdRef.current = selectedWorkerId;

  useEffect(() => {
    let active = true;
    let resizeObserver: ResizeObserver | null = null;

    void loadGoogleMaps(language)
      .then(() => {
        if (!active || !mapContainerRef.current) return;
        const map = new google.maps.Map(mapContainerRef.current, {
          center: savedView.current?.center || { lat: 23.0626, lng: -109.7036 },
          zoom: savedView.current?.zoom ?? 14,
          mapId: import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID',
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          backgroundColor: '#e9eef2',
        });
        mapInstanceRef.current = map;
        const infoWindow = new google.maps.InfoWindow({ disableAutoPan: false });
        infoWindow.addListener('closeclick', () => {
          onSelectWorker('');
        });
        map.addListener('click', () => {
          onSelectWorker('');
          infoWindow.close();
        });
        infoWindowRef.current = infoWindow;
        resizeObserver = new ResizeObserver(() => google.maps.event.trigger(map, 'resize'));
        resizeObserver.observe(mapContainerRef.current);
        setMapError('');
        setMapReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Google Maps radar initialization failed:', error);
        setMapError(t('No se pudo cargar Google Maps. Revisa la clave API y sus restricciones.'));
      });

    return () => {
      active = false;
      resizeObserver?.disconnect();
      const map = mapInstanceRef.current;
      if (map) savedView.current = { center: map.getCenter()?.toJSON() || { lat: 23.0626, lng: -109.7036 }, zoom: map.getZoom() || 14 };
      for (const state of markersRef.current.values()) removeMarker(state);
      markersRef.current.clear();
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      mapInstanceRef.current = null;
      hasCenteredOnceRef.current = false;
      setMapReady(false);
    };
  }, [language, t]);

  const animateMarker = useCallback((userId: string, targetLat: number, targetLng: number) => {
    const state = markersRef.current.get(userId);
    if (!state) return;
    if (state.animFrameId) cancelAnimationFrame(state.animFrameId);

    state.fromLat = state.toLat;
    state.fromLng = state.toLng;
    state.toLat = targetLat;
    state.toLng = targetLng;
    state.startTime = performance.now();
    state.duration = 2000;

    const step = (now: number) => {
      const progress = Math.min((now - state.startTime) / state.duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      state.marker.position = {
        lat: state.fromLat + (state.toLat - state.fromLat) * ease,
        lng: state.fromLng + (state.toLng - state.fromLng) * ease,
      };
      if (progress < 1) state.animFrameId = requestAnimationFrame(step);
    };
    state.animFrameId = requestAnimationFrame(step);
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;
    if (!mapReady || !map || !infoWindow) return;

    const currentWorkerIds = new Set(workers.map((worker) => worker.profile.id));
    for (const [userId, state] of markersRef.current) {
      if (!currentWorkerIds.has(userId)) {
        removeMarker(state);
        markersRef.current.delete(userId);
      }
    }

    for (const worker of workers) {
      const { id } = worker.profile;
      const targetLat = worker.location.latitud;
      const targetLng = worker.location.longitud;
      if (!Number.isFinite(targetLat) || !Number.isFinite(targetLng)) continue;
      const detectedPlace = detectPlace(targetLat, targetLng);

      if (!dwellTimesRef.current[id]) {
        dwellTimesRef.current[id] = new Date(worker.location.updated_at).getTime() - 45 * 60 * 1000;
      }
      const dwellText = formatDwellTime(dwellTimesRef.current[id]);
      const existingState = markersRef.current.get(id);
      let currentHeading = worker.location.rumbo;
      if (existingState && (existingState.toLat !== targetLat || existingState.toLng !== targetLng)) {
        const distance = Math.hypot(targetLat - existingState.toLat, targetLng - existingState.toLng);
        if (distance > 0.00003) {
          currentHeading = calculateBearing(existingState.toLat, existingState.toLng, targetLat, targetLng);
          existingState.currentHeading = currentHeading;
        } else if (existingState.currentHeading !== undefined) currentHeading = existingState.currentHeading;
      } else if (existingState?.currentHeading !== undefined) currentHeading = existingState.currentHeading;

      const iconHtml = createLife360MarkerHtml(worker, currentHeading, detectedPlace?.name, dwellText, language);
      const hoverCardHtml = createHoverCardHtml(worker, detectedPlace?.name, dwellTimesRef.current[id], language);

      if (!existingState) {
        const content = document.createElement('div');
        content.className = 'google-life360-marker';
        content.innerHTML = iconHtml;
        let closeTimer: number | undefined;
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: targetLat, lng: targetLng },
          title: worker.profile.nombre || worker.profile.full_name || t('Técnico'),
          content,
        });
        const onMouseEnter = () => {
          if (selectedWorkerIdRef.current) return;
          if (closeTimer) window.clearTimeout(closeTimer);
          const current = markersRef.current.get(id);
          infoWindow.setContent(current?.lastHoverCardHtml || hoverCardHtml);
          infoWindow.open({ map, anchor: marker, shouldFocus: false });
        };
        const onMouseLeave = () => {
          if (selectedWorkerIdRef.current === id) return;
          closeTimer = window.setTimeout(() => {
            if (selectedWorkerIdRef.current === id) return;
            infoWindow.close();
          }, 180);
        };
        content.addEventListener('mouseenter', onMouseEnter);
        content.addEventListener('mouseleave', onMouseLeave);
        const clickListener = marker.addListener('click', () => {
          if (closeTimer) window.clearTimeout(closeTimer);
          onSelectWorker(id);
          const current = markersRef.current.get(id);
          infoWindow.setContent(current?.lastHoverCardHtml || hoverCardHtml);
          infoWindow.open({ map, anchor: marker, shouldFocus: false });
        });
        markersRef.current.set(id, {
          marker,
          content,
          clickListener,
          onMouseEnter,
          onMouseLeave,
          fromLat: targetLat,
          fromLng: targetLng,
          toLat: targetLat,
          toLng: targetLng,
          startTime: performance.now(),
          duration: 2000,
          lastIconHtml: iconHtml,
          lastHoverCardHtml: hoverCardHtml,
          currentHeading: currentHeading ?? undefined,
        });
      } else {
        if (existingState.lastIconHtml !== iconHtml) {
          existingState.lastIconHtml = iconHtml;
          existingState.content.innerHTML = iconHtml;
        }
        existingState.lastHoverCardHtml = hoverCardHtml;
        if (selectedWorkerIdRef.current === id && infoWindowRef.current) {
          infoWindowRef.current.setContent(hoverCardHtml);
        }
        if (existingState.toLat !== targetLat || existingState.toLng !== targetLng) animateMarker(id, targetLat, targetLng);
      }

      if (selectedWorkerIdRef.current === id) {
        const bounds = map.getBounds();
        if (bounds && !bounds.contains({ lat: targetLat, lng: targetLng })) map.panTo({ lat: targetLat, lng: targetLng });
      }
    }

    if (!hasCenteredOnceRef.current) {
      const validPoints = workers
        .filter((worker) => Number.isFinite(worker.location.latitud) && Number.isFinite(worker.location.longitud))
        .map((worker) => [worker.location.latitud, worker.location.longitud] as [number, number]);
      if (validPoints.length === 1) {
        map.setCenter({ lat: validPoints[0][0], lng: validPoints[0][1] });
        map.setZoom(16);
        hasCenteredOnceRef.current = true;
      } else if (validPoints.length > 1) {
        map.fitBounds(fleetBounds(validPoints), 60);
        google.maps.event.addListenerOnce(map, 'idle', () => { if ((map.getZoom() || 0) > 16) map.setZoom(16); });
        hasCenteredOnceRef.current = true;
      }
    }
  }, [animateMarker, language, mapReady, onSelectWorker, t, workers]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const infoWindow = infoWindowRef.current;
    if (!mapReady || !map) return;
    if (!selectedWorkerId) {
      infoWindow?.close();
      return;
    }
    const worker = workers.find((item) => item.profile.id === selectedWorkerId);
    if (!worker) return;
    map.panTo({ lat: worker.location.latitud, lng: worker.location.longitud });
    if ((map.getZoom() || 0) < 13) map.setZoom(15);

    const state = markersRef.current.get(selectedWorkerId);
    if (state && infoWindow) {
      infoWindow.setContent(state.lastHoverCardHtml);
      infoWindow.open({ map, anchor: state.marker, shouldFocus: false });
    }
  }, [focusTrigger, mapReady, selectedWorkerId, workers]);

  const handleCenterAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const validPoints = workers
      .filter((worker) => Number.isFinite(worker.location.latitud) && Number.isFinite(worker.location.longitud))
      .map((worker) => [worker.location.latitud, worker.location.longitud] as [number, number]);
    if (validPoints.length === 1) {
      map.panTo({ lat: validPoints[0][0], lng: validPoints[0][1] });
      map.setZoom(18);
    } else if (validPoints.length > 1) map.fitBounds(fleetBounds(validPoints), 60);
  };

  const selectedWorker = workers.find((worker) => worker.profile.id === selectedWorkerId);

  return (
    <div className="map-wrapper relative h-full w-full">
      <div ref={mapContainerRef} className="google-map-canvas" />

      {mapError ? (
        <div className="google-map-error" role="alert">
          <MapPinned size={22} aria-hidden="true" />
          <strong>{t('Mapa no disponible')}</strong>
          <span>{mapError}</span>
        </div>
      ) : null}

      {selectedWorker ? (
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-slate-900/10 backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-150 max-w-xs">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 border border-orange-200 text-[#f78c26] font-bold text-xs">
            {selectedWorker.profile.avatar_url ? <img src={selectedWorker.profile.avatar_url} alt="" className="h-full w-full rounded-xl object-cover" /> : (
              <span>{(selectedWorker.profile.nombre || selectedWorker.profile.full_name || 'CS').split(' ').filter(Boolean).map((part) => part[0]).join('').substring(0, 2).toUpperCase()}</span>
            )}
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${selectedWorker.isOffline ? 'bg-slate-400' : 'bg-emerald-500'}`} />
          </div>
          <div className="flex flex-col overflow-hidden min-w-0 pr-1">
            <span className="truncate text-xs font-bold text-[#343e48]">{selectedWorker.profile.nombre || selectedWorker.profile.full_name || t('Técnico')}</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`rounded px-1.5 py-0.2 text-[9.5px] font-bold shrink-0 ${selectedWorker.isOffline ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'}`}>{selectedWorker.isOffline ? t('Offline') : t('En vivo')}</span>
              <span className="truncate text-[10.5px] text-slate-400">{selectedWorker.location.actividad === 'conduciendo' ? `En ruta (${Math.round(selectedWorker.location.velocidad || 0)} km/h)` : (selectedWorker.profile.rol?.replace(/_/g, ' ') || t('Técnico'))}</span>
            </div>
          </div>
          {onOpenHistory ? <button onClick={() => onOpenHistory(selectedWorker.profile.id)} className="flex items-center gap-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-[#f78c26] px-2 py-1 text-[11px] font-bold transition-colors shrink-0" title={t('Ver historial de rutas')}><Route size={12} /><span>{t('Historial')}</span></button> : null}
          <button onClick={() => onSelectWorker('')} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-[#343e48] hover:bg-slate-100 transition-colors" title={t('Quitar enfoque')}>✕</button>
        </div>
      ) : null}

      <div className="floating-map-controls">
        <button onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || 14) + 1)} title={t('Acercar mapa')} className="map-control-btn"><ZoomIn size={18} /></button>
        <button onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || 14) - 1)} title={t('Alejar mapa')} className="map-control-btn"><ZoomOut size={18} /></button>
        <div className="control-divider" />
        <button onClick={handleCenterAll} title={t('Centrar en la flota')} className="map-control-btn center-btn"><Navigation size={18} /></button>
        {onRefresh ? <><div className="control-divider" /><button onClick={onRefresh} disabled={isRefreshing} title={t('Forzar actualización de radar ahora')} className="map-control-btn"><RotateCw size={17} className={isRefreshing ? 'animate-spin text-[#f78c26]' : ''} /></button></> : null}
      </div>
    </div>
  );
};
