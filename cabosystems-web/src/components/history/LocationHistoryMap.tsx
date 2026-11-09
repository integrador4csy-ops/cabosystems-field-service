import React, { useEffect, useRef, useState } from 'react';
import { MapPinned, Navigation, Pause, Play, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { loadGoogleMaps } from '../../lib/googleMapsLoader';
import type { HistoryTimelineEvent, HistoryStop, HistoryMovement, TimedHistoryPoint } from '../../lib/locationHistoryAnalytics';
import { formatTimeOfDay, formatDurationMs } from '../../lib/locationHistoryAnalytics';

interface LocationHistoryMapProps {
  fullPath: [number, number][];
  timelinePath: TimedHistoryPoint[];
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
  timelinePath,
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
  const progressPolylineRef = useRef<google.maps.Polyline | null>(null);
  const personMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const markerListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const [playbackIndex, setPlaybackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setPlaybackIndex(0);
    setIsPlaying(false);
  }, [timelinePath]);

  useEffect(() => {
    if (!isPlaying || timelinePath.length < 2) return;
    const timer = window.setInterval(() => {
      setPlaybackIndex((current) => {
        if (current >= timelinePath.length - 1) {
          setIsPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [isPlaying, timelinePath.length]);

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
    progressPolylineRef.current?.setMap(null);
    progressPolylineRef.current = null;
    personMarkerRef.current = null;
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
        strokeColor: '#94a3b8',
        strokeWeight: 3,
        strokeOpacity: 0.7,
        geodesic: true,
      });
      map.fitBounds(historyBounds(fullPath), 50);

    } else if (fullPath.length === 1) {
      map.setCenter({ lat: fullPath[0][0], lng: fullPath[0][1] });
      map.setZoom(16);
    }

    if (timelinePath.length > 0) {
      const firstPoint = timelinePath[0];
      const personMarker = new google.maps.marker.AdvancedMarkerElement({
        map,
        position: { lat: firstPoint.lat, lng: firstPoint.lng },
        title: t('Posición del técnico en la línea de tiempo'),
        zIndex: 20,
        content: markerContent('<div class="route-map-person" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3"></circle><path d="M6.8 20c.7-4 2.4-6 5.2-6s4.5 2 5.2 6"></path></svg></div>'),
      });
      personMarkerRef.current = personMarker;
      markersRef.current.push(personMarker);
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
      progressPolylineRef.current?.setMap(null);
      for (const marker of markersRef.current) marker.map = null;
      for (const listener of markerListenersRef.current) listener.remove();
    };
  }, [events, fullPath, mapReady, onSelectEvent, t, timelinePath]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const marker = personMarkerRef.current;
    const point = timelinePath[playbackIndex];
    if (!mapReady || !map || !marker || !point) return;

    marker.position = { lat: point.lat, lng: point.lng };
    marker.title = `${t('Ubicación registrada')} · ${formatTimeOfDay(point.time)}`;
    progressPolylineRef.current?.setMap(null);
    progressPolylineRef.current = null;
    if (playbackIndex > 0) {
      progressPolylineRef.current = new google.maps.Polyline({
        map,
        path: timelinePath.slice(0, playbackIndex + 1).map(({ lat, lng }) => ({ lat, lng })),
        strokeColor: '#f78c26',
        strokeWeight: 5,
        strokeOpacity: 0.95,
        geodesic: true,
        zIndex: 5,
      });
    }
  }, [mapReady, playbackIndex, t, timelinePath]);

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

      {timelinePath.length > 0 ? (
        <div className="route-history-playback" aria-label={t('Línea de tiempo de la ruta')}>
          <button
            type="button"
            onClick={() => {
              if (playbackIndex >= timelinePath.length - 1) setPlaybackIndex(0);
              setIsPlaying((playing) => !playing);
            }}
            disabled={timelinePath.length < 2}
            aria-label={isPlaying ? t('Pausar recorrido') : t('Reproducir recorrido')}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <span>{formatTimeOfDay(timelinePath[playbackIndex]?.time || timelinePath[0].time)}</span>
          <input
            type="range"
            min="0"
            max={Math.max(0, timelinePath.length - 1)}
            value={playbackIndex}
            onChange={(event) => {
              setIsPlaying(false);
              setPlaybackIndex(Number(event.target.value));
            }}
            aria-label={t('Momento del recorrido')}
          />
          <span>{formatTimeOfDay(timelinePath[timelinePath.length - 1].time)}</span>
        </div>
      ) : null}
    </div>
  );
};
