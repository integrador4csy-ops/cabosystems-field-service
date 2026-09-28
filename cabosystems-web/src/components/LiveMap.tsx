import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './Life360Map.css';
import type { LiveWorker } from '../types/fleet';
import { createLife360MarkerHtml, createHoverCardHtml } from './markerHtml';
import { detectPlace, formatDwellTime } from '../lib/places';
import { Navigation, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface LiveMapProps {
  workers: LiveWorker[];
  selectedWorkerId: string | null;
  onSelectWorker: (workerId: string) => void;
  focusTrigger?: number;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

// Helper: Calculate bearing in degrees (0 - 360) between two coordinates
function calculateBearing(startLat: number, startLng: number, destLat: number, destLng: number): number {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x = Math.cos(startLatRad) * Math.sin(destLatRad) -
            Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

interface MarkerAnimationState {
  marker: L.Marker;
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

export const LiveMap: React.FC<LiveMapProps> = ({
  workers,
  selectedWorkerId,
  onSelectWorker,
  focusTrigger,
  onRefresh,
  isRefreshing,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerAnimationState>>(new Map());
  const selectedWorkerIdRef = useRef<string | null>(selectedWorkerId);
  selectedWorkerIdRef.current = selectedWorkerId;
  const dwellTimesRef = useRef<Record<string, number>>({});
  const [hasCenteredOnce, setHasCenteredOnce] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center: Los Cabos (Cabo San Lucas / San José del Cabo, BCS)
    const map = L.map(mapContainerRef.current, {
      center: [23.0626, -109.7036],
      zoom: 14,
      zoomControl: false,
    });

    const streetLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&scale=2&x={x}&y={y}&z={z}', {
      maxZoom: 20,
      subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      attribution: '&copy; Google Maps',
    });

    streetLayer.addTo(map);
    mapInstanceRef.current = map;

    // Ensure map paints immediately
    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      // Clean up animations
      markersRef.current.forEach(state => {
        if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
      });
      markersRef.current.clear();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Interpolation Animation Loop (Life360 smooth glide)
  const animateMarker = (userId: string, targetLat: number, targetLng: number) => {
    const state = markersRef.current.get(userId);
    if (!state) return;

    if (state.animFrameId) {
      cancelAnimationFrame(state.animFrameId);
    }

    const currentLatLng = state.marker.getLatLng();
    state.fromLat = currentLatLng.lat;
    state.fromLng = currentLatLng.lng;
    state.toLat = targetLat;
    state.toLng = targetLng;
    state.startTime = performance.now();
    state.duration = 2000; // 2 seconds smooth interpolation

    const step = (now: number) => {
      const elapsed = now - state.startTime;
      const progress = Math.min(elapsed / state.duration, 1);
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3);

      const lat = state.fromLat + (state.toLat - state.fromLat) * ease;
      const lng = state.fromLng + (state.toLng - state.fromLng) * ease;

      state.marker.setLatLng([lat, lng]);

      if (progress < 1) {
        state.animFrameId = requestAnimationFrame(step);
      }
    };

    state.animFrameId = requestAnimationFrame(step);
  };

  // Sync Markers with workers prop
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentWorkerIds = new Set(workers.map(w => w.profile.id));

    // Remove obsolete markers
    markersRef.current.forEach((state, userId) => {
      if (!currentWorkerIds.has(userId)) {
        if (state.animFrameId) cancelAnimationFrame(state.animFrameId);
        map.removeLayer(state.marker);
        markersRef.current.delete(userId);
      }
    });

    // Add or update markers
    workers.forEach(worker => {
      const { id } = worker.profile;
      const { latitud, longitud } = worker.location;

      const detectedPlace = detectPlace(latitud, longitud);

      // Use exact GPS telemetry from device (no artificial snapping)
      const targetLat = latitud;
      const targetLng = longitud;

      // Track dwell time
      if (!dwellTimesRef.current[id]) {
        const updatedTime = new Date(worker.location.updated_at).getTime();
        dwellTimesRef.current[id] = updatedTime - (45 * 60 * 1000);
      }
      const dwellText = formatDwellTime(dwellTimesRef.current[id]);

      // Compute heading bearing if moving
      let currentHeading = worker.location.rumbo;
      const existingState = markersRef.current.get(id);
      if (existingState && (existingState.toLat !== targetLat || existingState.toLng !== targetLng)) {
        const dist = Math.hypot(targetLat - existingState.toLat, targetLng - existingState.toLng);
        if (dist > 0.00003) {
          currentHeading = calculateBearing(existingState.toLat, existingState.toLng, targetLat, targetLng);
          existingState.currentHeading = currentHeading;
        } else if (existingState.currentHeading !== undefined) {
          currentHeading = existingState.currentHeading;
        }
      } else if (existingState?.currentHeading !== undefined) {
        currentHeading = existingState.currentHeading;
      }

      const iconHtml = createLife360MarkerHtml(worker, currentHeading, detectedPlace?.name, dwellText);
      const hoverCardHtml = createHoverCardHtml(worker, detectedPlace?.name, dwellText);

      const divIcon = L.divIcon({
        className: 'custom-life360-icon',
        html: iconHtml,
        iconSize: [56, 68],
        iconAnchor: [28, 68],
      });

      if (!markersRef.current.has(id)) {
        // Create new marker
        const marker = L.marker([targetLat, targetLng], { icon: divIcon }).addTo(map);

        // Hover Card Tooltip (interactive: true keeps tooltip open when mouse is over it)
        marker.bindTooltip(hoverCardHtml, {
          direction: 'top',
          offset: [0, -70],
          className: 'cabosystems-hover-card',
          opacity: 1,
          sticky: false,
          interactive: true,
        });

        marker.on('click', () => {
          onSelectWorker(id);
        });

        markersRef.current.set(id, {
          marker,
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
        // Update existing marker
        const state = markersRef.current.get(id)!;

        // In-place marker DOM update: prevents Leaflet from recreating the icon element,
        // which triggers mouseout/mouseover events and causes the tooltip to flicker.
        if (state.lastIconHtml !== iconHtml) {
          state.lastIconHtml = iconHtml;
          const el = state.marker.getElement();
          if (el) {
            el.innerHTML = iconHtml;
          } else {
            state.marker.setIcon(divIcon);
          }
        }

        // Only update tooltip content if text or data actually changed
        if (state.lastHoverCardHtml !== hoverCardHtml) {
          state.lastHoverCardHtml = hoverCardHtml;
          state.marker.setTooltipContent(hoverCardHtml);
        }

        // Smooth glide if position moved
        if (state.toLat !== targetLat || state.toLng !== targetLng) {
          animateMarker(id, targetLat, targetLng);
        }
      }

      // Intelligent follow: only pan if worker is selected and moves outside current visible viewport
      if (selectedWorkerIdRef.current === id && mapInstanceRef.current) {
        const bounds = mapInstanceRef.current.getBounds();
        const paddedBounds = bounds.pad(-0.1); // 10% inner margin
        if (!paddedBounds.contains([targetLat, targetLng])) {
          mapInstanceRef.current.panTo([targetLat, targetLng], { animate: true, duration: 0.8 });
        }
      }
    });

    // Auto-fit bounds on initial load if we have workers
    if (!hasCenteredOnce && workers.length > 0) {
      const validPoints = workers
        .filter(w => !isNaN(w.location.latitud) && !isNaN(w.location.longitud))
        .map(w => [w.location.latitud, w.location.longitud] as [number, number]);

      if (validPoints.length === 1) {
        map.setView(validPoints[0], 16);
        setHasCenteredOnce(true);
      } else if (validPoints.length > 1) {
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
        setHasCenteredOnce(true);
      }
    }
  }, [workers]);

  // Center on selected worker when explicitly requested (free zoom preserved)
  useEffect(() => {
    if (!selectedWorkerId || !mapInstanceRef.current) return;
    const worker = workers.find(w => w.profile.id === selectedWorkerId);
    if (!worker) return;

    const map = mapInstanceRef.current;
    const targetCoord: [number, number] = [worker.location.latitud, worker.location.longitud];
    const currentZoom = map.getZoom();

    // Preserve user zoom: if current zoom is too far out (< 13), zoom to a readable 15, otherwise KEEP user's zoom!
    if (currentZoom < 13) {
      map.flyTo(targetCoord, 15, { duration: 1.0 });
    } else {
      map.panTo(targetCoord, { animate: true, duration: 0.8 });
    }
  }, [selectedWorkerId, focusTrigger]);

  const handleCenterAll = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const validPoints = workers
      .filter(w => !isNaN(w.location.latitud) && !isNaN(w.location.longitud))
      .map(w => [w.location.latitud, w.location.longitud] as [number, number]);

    if (validPoints.length === 1) {
      map.flyTo(validPoints[0], 18);
    } else if (validPoints.length > 1) {
      const bounds = L.latLngBounds(validPoints);
      map.flyToBounds(bounds, { padding: [60, 60] });
    }
  };

  const selectedWorker = workers.find((w) => w.profile.id === selectedWorkerId);

  return (
    <div className="map-wrapper relative h-full w-full">
      {/* Map Container */}
      <div ref={mapContainerRef} className="leaflet-map-canvas" />

      {/* Floating Focused Technician Card - TailAdmin Corporate Style */}
      {selectedWorker && (
        <div className="absolute top-4 left-4 z-[1000] flex items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 px-3.5 py-2.5 shadow-lg shadow-slate-900/10 backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-150 max-w-xs">
          {/* Avatar with status dot */}
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 border border-orange-200 text-[#f78c26] font-bold text-xs">
            {selectedWorker.profile.avatar_url ? (
              <img
                src={selectedWorker.profile.avatar_url}
                alt=""
                className="h-full w-full rounded-xl object-cover"
              />
            ) : (
              <span>
                {(selectedWorker.profile.nombre || selectedWorker.profile.full_name || 'CS')
                  .split(' ')
                  .filter(Boolean)
                  .map((p) => p[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()}
              </span>
            )}
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                selectedWorker.isOffline ? 'bg-slate-400' : 'bg-emerald-500'
              }`}
            />
          </div>

          {/* Info */}
          <div className="flex flex-col overflow-hidden min-w-0 pr-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-xs font-bold text-[#343e48]">
                {selectedWorker.profile.nombre || selectedWorker.profile.full_name || 'Técnico'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`rounded px-1.5 py-0.2 text-[9.5px] font-bold shrink-0 ${
                  selectedWorker.isOffline
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                }`}
              >
                {selectedWorker.isOffline ? 'Offline' : 'En vivo'}
              </span>
              <span className="truncate text-[10.5px] text-slate-400">
                {selectedWorker.location.actividad === 'conduciendo'
                  ? `En ruta (${Math.round(selectedWorker.location.velocidad || 0)} km/h)`
                  : (selectedWorker.profile.rol?.replace(/_/g, ' ') || 'Técnico')}
              </span>
            </div>
          </div>

          {/* Dismiss button */}
          <button
            onClick={() => onSelectWorker('')}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-[#343e48] hover:bg-slate-100 transition-colors"
            title="Quitar enfoque"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modern Floating Map Controls */}
      <div className="floating-map-controls">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          title="Acercar mapa"
          className="map-control-btn"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          title="Alejar mapa"
          className="map-control-btn"
        >
          <ZoomOut size={18} />
        </button>
        <div className="control-divider" />
        <button
          onClick={handleCenterAll}
          title="Centrar en la flota"
          className="map-control-btn center-btn"
        >
          <Navigation size={18} className="text-[#f78c26]" />
        </button>
        {onRefresh && (
          <>
            <div className="control-divider" />
            <button
              onClick={onRefresh}
              title="Forzar actualización de radar ahora"
              className="map-control-btn"
            >
              <RotateCw size={17} className={isRefreshing ? 'animate-spin text-[#f78c26]' : ''} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
