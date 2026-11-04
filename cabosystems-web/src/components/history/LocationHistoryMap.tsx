import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZoomIn, ZoomOut, Navigation } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import type { HistoryTimelineEvent, HistoryStop, HistoryMovement } from '../../lib/locationHistoryAnalytics';
import { formatTimeOfDay, formatDurationMs } from '../../lib/locationHistoryAnalytics';

interface LocationHistoryMapProps {
  fullPath: [number, number][];
  events: HistoryTimelineEvent[];
  selectedEvent: HistoryTimelineEvent | null;
  onSelectEvent: (event: HistoryTimelineEvent) => void;
}

export const LocationHistoryMap: React.FC<LocationHistoryMapProps> = ({
  fullPath,
  events,
  selectedEvent,
  onSelectEvent,
}) => {
  const { t } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const highlightPolylineRef = useRef<L.Polyline | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.0626, -109.7036],
      zoom: 13,
      zoomControl: false,
    });

    const streetLayer = L.tileLayer(
      'https://{s}.google.com/vt/lyrs=m&scale=2&x={x}&y={y}&z={z}',
      {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '&copy; Google Maps',
      }
    );

    streetLayer.addTo(map);
    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    map.invalidateSize();
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Render Route and Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    // Clear previous elements
    markersLayer.clearLayers();
    if (routePolylineRef.current) {
      map.removeLayer(routePolylineRef.current);
      routePolylineRef.current = null;
    }
    if (highlightPolylineRef.current) {
      map.removeLayer(highlightPolylineRef.current);
      highlightPolylineRef.current = null;
    }

    if (fullPath.length > 1) {
      // Draw background route glow
      const polyline = L.polyline(fullPath, {
        color: '#2563eb',
        weight: 4,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);
      routePolylineRef.current = polyline;

      // Fit bounds to entire route
      const bounds = L.latLngBounds(fullPath);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

      // Add Start Point Marker
      const startCoord = fullPath[0];
      const startIcon = L.divIcon({
        className: 'custom-history-marker',
        html: `
          <div class="flex items-center gap-1 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md border-2 border-white">
            <span>●</span> ${t('Inicio')}
          </div>
        `,
        iconSize: [60, 24],
        iconAnchor: [30, 12],
      });
      L.marker(startCoord, { icon: startIcon })
        .bindTooltip(`${t('Punto de inicio')} (${formatTimeOfDay(events[0]?.startTime || Date.now())})`, {
          direction: 'top',
        })
        .addTo(markersLayer);

      // Add End Point Marker
      const endCoord = fullPath[fullPath.length - 1];
      const endIcon = L.divIcon({
        className: 'custom-history-marker',
        html: `
          <div class="flex items-center gap-1 bg-[#f78c26] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md border-2 border-white">
            <span>🏁</span> ${t('Fin')}
          </div>
        `,
        iconSize: [50, 24],
        iconAnchor: [25, 12],
      });
      L.marker(endCoord, { icon: endIcon })
        .bindTooltip(`${t('Último punto registrado')} (${formatTimeOfDay(events[events.length - 1]?.endTime || Date.now())})`, {
          direction: 'top',
        })
        .addTo(markersLayer);
    }

    // Render Stop Markers
    events.forEach((ev) => {
      if (ev.type !== 'stop') return;
      const stop = ev as HistoryStop;

      const isProlonged = stop.isProlonged;
      const isVilla = stop.placeCategory === 'villa';
      const isOffice = stop.placeCategory === 'office';

      let bgClass = 'bg-slate-700';
      let borderClass = 'border-white';
      let iconSymbol = '⏱️';

      if (isVilla) {
        bgClass = 'bg-emerald-600';
        iconSymbol = '🏡';
      } else if (isOffice) {
        bgClass = 'bg-blue-600';
        iconSymbol = '🏢';
      } else if (isProlonged) {
        bgClass = 'bg-amber-600 animate-bounce';
        borderClass = 'border-amber-200 ring-2 ring-amber-500';
        iconSymbol = '⚠️';
      }

      const stopHtml = `
        <div class="flex items-center gap-1 ${bgClass} text-white text-[10.5px] font-bold px-2 py-0.8 rounded-full shadow-lg border-2 ${borderClass} transition-transform hover:scale-110">
          <span>${iconSymbol}</span>
          <span>${formatDurationMs(stop.durationMs)}</span>
        </div>
      `;

      const stopIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: stopHtml,
        iconSize: [70, 26],
        iconAnchor: [35, 13],
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon }).addTo(markersLayer);

      const tooltipContent = `
        <div class="p-1 text-xs">
          <div class="font-bold text-slate-800">${stop.placeName || t('Parada')}</div>
          <div class="text-slate-500 text-[11px]">${formatTimeOfDay(stop.startTime)} - ${formatTimeOfDay(stop.endTime)} (${formatDurationMs(stop.durationMs)})</div>
          ${isProlonged ? `<div class="text-amber-600 font-bold text-[10.5px] mt-0.5">⚠️ ${t('Parada prolongada (>20 min)')}</div>` : ''}
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -10],
      });

      marker.on('click', () => {
        onSelectEvent(stop);
      });
    });
  }, [fullPath, events, t]);

  // Center on Selected Event (from Timeline click)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !selectedEvent) return;

    if (selectedEvent.type === 'stop') {
      const stop = selectedEvent as HistoryStop;
      map.flyTo([stop.lat, stop.lng], 16, { duration: 0.8 });
    } else if (selectedEvent.type === 'movement') {
      const mov = selectedEvent as HistoryMovement;
      if (mov.path.length > 0) {
        // Highlight movement line in red/orange
        if (highlightPolylineRef.current) {
          map.removeLayer(highlightPolylineRef.current);
        }
        highlightPolylineRef.current = L.polyline(mov.path, {
          color: '#f97316',
          weight: 6,
          opacity: 0.95,
        }).addTo(map);

        const bounds = L.latLngBounds(mov.path);
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
      }
    }
  }, [selectedEvent]);

  const handleFitAll = () => {
    const map = mapInstanceRef.current;
    if (!map || fullPath.length === 0) return;
    const bounds = L.latLngBounds(fullPath);
    map.flyToBounds(bounds, { padding: [50, 50] });
  };

  return (
    <div className="relative h-full w-full">
      <div ref={mapContainerRef} className="h-full w-full rounded-2xl" />

      {/* Floating Controls */}
      <div className="absolute bottom-5 right-5 z-[1000] flex flex-col gap-1.5 bg-white/95 p-1 rounded-xl shadow-lg border border-slate-200">
        <button
          onClick={() => mapInstanceRef.current?.zoomIn()}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title={t('Acercar mapa')}
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={() => mapInstanceRef.current?.zoomOut()}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          title={t('Alejar mapa')}
        >
          <ZoomOut size={18} />
        </button>
        {fullPath.length > 0 && (
          <button
            onClick={handleFitAll}
            className="p-2 text-[#f78c26] hover:bg-orange-50 rounded-lg transition-colors"
            title={t('Centrar en la flota')}
          >
            <Navigation size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
