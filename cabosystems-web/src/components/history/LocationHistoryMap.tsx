import React, { useEffect, useRef, useState } from 'react';
import { MapPinned, Navigation, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { loadGoogleMaps } from '../../lib/googleMapsLoader';
import type { HistoryTimelineEvent, HistoryStop, HistoryMovement } from '../../lib/locationHistoryAnalytics';
import { formatTimeOfDay, formatDurationMs } from '../../lib/locationHistoryAnalytics';

interface LocationHistoryMapProps {
  fullPath: [number, number][];
  events: HistoryTimelineEvent[];
  selectedEvent: HistoryTimelineEvent | null;
  onSelectEvent: (event: HistoryTimelineEvent) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

function markerContent(html: string) {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html.trim();
  return wrapper.firstElementChild as HTMLElement;
}

function historyBounds(path: [number, number][]) {
  const bounds = new google.maps.LatLngBounds();
  for (const [lat, lng] of path) bounds.extend({ lat, lng });
  return bounds;
}

export const LocationHistoryMap: React.FC<LocationHistoryMapProps> = ({
  fullPath,
  events,
  selectedEvent,
  onSelectEvent,
  onRefresh,
  isRefreshing,
}) => {
  const { t, language } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);
  const highlightPolylineRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const markerListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');

  useEffect(() => {
    let active = true;
    let resizeObserver: ResizeObserver | null = null;

    void loadGoogleMaps(language)
      .then(() => {
        if (!active || !mapContainerRef.current) return;
        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: 23.0626, lng: -109.7036 },
          zoom: 13,
          mapId: import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID',
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          backgroundColor: '#e9eef2',
        });
        mapInstanceRef.current = map;
        infoWindowRef.current = new google.maps.InfoWindow({ disableAutoPan: true });
        resizeObserver = new ResizeObserver(() => google.maps.event.trigger(map, 'resize'));
        resizeObserver.observe(mapContainerRef.current);
        setMapError('');
        setMapReady(true);
      })
      .catch((error: unknown) => {
        if (!active) return;
        console.error('Google Maps history initialization failed:', error);
        setMapError(t('No se pudo cargar Google Maps. Revisa la clave API y sus restricciones.'));
      });

    return () => {
      active = false;
      resizeObserver?.disconnect();
      setMapReady(false);
      mapInstanceRef.current = null;
      infoWindowRef.current = null;
    };
  }, [language, t]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map) return;

    routePolylineRef.current?.setMap(null);
    routePolylineRef.current = null;
    highlightPolylineRef.current?.setMap(null);
    highlightPolylineRef.current = null;
    for (const marker of markersRef.current) marker.map = null;
    markersRef.current = [];
    for (const listener of markerListenersRef.current) listener.remove();
    markerListenersRef.current = [];
    infoWindowRef.current?.close();

    if (fullPath.length > 1) {
      routePolylineRef.current = new google.maps.Polyline({
        map,
        path: fullPath.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: '#343e48',
        strokeWeight: 4,
        strokeOpacity: 0.82,
        geodesic: true,
      });
      map.fitBounds(historyBounds(fullPath), 50);

      const start = fullPath[0];
      const end = fullPath[fullPath.length - 1];
      markersRef.current.push(
        new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: start[0], lng: start[1] },
          title: `${t('Punto de inicio')} (${formatTimeOfDay(events[0]?.startTime || Date.now())})`,
          content: markerContent(`<div class="route-map-endpoint is-start"><span></span>${t('Inicio')}</div>`),
        }),
        new google.maps.marker.AdvancedMarkerElement({
          map,
          position: { lat: end[0], lng: end[1] },
          title: `${t('Último punto registrado')} (${formatTimeOfDay(events[events.length - 1]?.endTime || Date.now())})`,
          content: markerContent(`<div class="route-map-endpoint is-end"><span></span>${t('Fin')}</div>`),
        })
      );
    } else if (fullPath.length === 1) {
      map.setCenter({ lat: fullPath[0][0], lng: fullPath[0][1] });
      map.setZoom(16);
    }

    for (const event of events) {
      if (event.type !== 'stop') continue;
      const stop = event as HistoryStop;
      let toneClass = 'is-regular';
      let iconSymbol = '•';
      if (stop.placeCategory === 'villa') { toneClass = 'is-villa'; iconSymbol = 'V'; }
      else if (stop.placeCategory === 'office') { toneClass = 'is-office'; iconSymbol = 'B'; }
      else if (stop.isProlonged) { toneClass = 'is-prolonged'; iconSymbol = '!'; }

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: stop.lat, lng: stop.lng },
        title: stop.placeName || t('Parada'),
        content: markerContent(`<div class="route-map-stop ${toneClass}"><span>${iconSymbol}</span><strong>${formatDurationMs(stop.durationMs)}</strong></div>`),
      });
      const listener = marker.addListener('click', () => {
        onSelectEvent(stop);
        infoWindowRef.current?.setContent(`
          <div class="route-map-info-window">
            <strong>${stop.placeName || t('Parada')}</strong>
            <span>${formatTimeOfDay(stop.startTime)} – ${formatTimeOfDay(stop.endTime)} · ${formatDurationMs(stop.durationMs)}</span>
            ${stop.isProlonged ? `<b>${t('Parada prolongada (>20 min)')}</b>` : ''}
          </div>
        `);
        infoWindowRef.current?.open({ map, anchor: marker });
      });
      markersRef.current.push(marker);
      markerListenersRef.current.push(listener);
    }

    return () => {
      routePolylineRef.current?.setMap(null);
      highlightPolylineRef.current?.setMap(null);
      for (const marker of markersRef.current) marker.map = null;
      for (const listener of markerListenersRef.current) listener.remove();
    };
  }, [events, fullPath, mapReady, onSelectEvent, t]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map || !selectedEvent) return;
    highlightPolylineRef.current?.setMap(null);
    highlightPolylineRef.current = null;

    if (selectedEvent.type === 'stop') {
      const stop = selectedEvent as HistoryStop;
      map.panTo({ lat: stop.lat, lng: stop.lng });
      map.setZoom(16);
      return;
    }

    const movement = selectedEvent as HistoryMovement;
    if (!movement.path.length) return;
    highlightPolylineRef.current = new google.maps.Polyline({
      map,
      path: movement.path.map(([lat, lng]) => ({ lat, lng })),
      strokeColor: '#f78c26',
      strokeWeight: 6,
      strokeOpacity: 0.95,
      geodesic: true,
    });
    map.fitBounds(historyBounds(movement.path), 60);
  }, [mapReady, selectedEvent]);

  const handleFitAll = () => {
    if (!mapInstanceRef.current || !fullPath.length) return;
    mapInstanceRef.current.fitBounds(historyBounds(fullPath), 50);
  };

  return (
    <div className="route-history-map">
      <div ref={mapContainerRef} className="route-history-map-canvas" />

      {mapError ? (
        <div className="route-history-map-empty" role="alert">
          <div><MapPinned size={22} aria-hidden="true" /></div>
          <strong>{t('Mapa no disponible')}</strong>
          <span>{mapError}</span>
        </div>
      ) : fullPath.length === 0 && mapReady ? (
        <div className="route-history-map-empty">
          <div><MapPinned size={22} aria-hidden="true" /></div>
          <strong>{t('Sin ruta para mostrar')}</strong>
          <span>{t('El mapa se actualizará cuando existan puntos GPS en la fecha seleccionada.')}</span>
        </div>
      ) : null}

      <div className="route-history-map-controls">
        <button type="button" onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || 13) + 1)} title={t('Acercar mapa')} aria-label={t('Acercar mapa')}>
          <ZoomIn size={18} />
        </button>
        <button type="button" onClick={() => mapInstanceRef.current?.setZoom((mapInstanceRef.current.getZoom() || 13) - 1)} title={t('Alejar mapa')} aria-label={t('Alejar mapa')}>
          <ZoomOut size={18} />
        </button>
        {fullPath.length > 0 ? (
          <button type="button" onClick={handleFitAll} title={t('Centrar en la flota')} aria-label={t('Mostrar ruta completa')}>
            <Navigation size={18} />
          </button>
        ) : null}
        {onRefresh ? (
          <button type="button" onClick={onRefresh} disabled={isRefreshing} title={t('Actualizar historial')} aria-label={t('Actualizar historial')}>
            <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        ) : null}
      </div>
    </div>
  );
};
