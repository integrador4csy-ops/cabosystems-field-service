import { useEffect, useRef, useState } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin } from 'lucide-react';
import type { ProjectCopy } from '../../lib/projectAccessCopy';

interface VillaGeofenceMapProps {
  latitude: string;
  longitude: string;
  radiusMeters: string;
  editable: boolean;
  disabled?: boolean;
  copy: ProjectCopy;
  onCoordinatesChange?: (latitude: string, longitude: string) => void;
  onRadiusChange?: (radius: string) => void;
}

const CABO_SAN_LUCAS: L.LatLngExpression = [22.8905, -109.9167];
const GEOFENCE_ICON = L.divIcon({
  className: 'pd-leaflet-marker-shell',
  html: '<div class="pd-geofence-marker"><span></span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function numericCoordinates(latitude: string, longitude: string) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return latitude.trim() && longitude.trim() && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

export function VillaGeofenceMap({
  latitude,
  longitude,
  radiusMeters,
  editable,
  disabled = false,
  copy,
  onCoordinatesChange,
  onRadiusChange,
}: VillaGeofenceMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const coordinatesChangeRef = useRef(onCoordinatesChange);
  const initialPositionRef = useRef(numericCoordinates(latitude, longitude));
  const hasFramedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    coordinatesChangeRef.current = onCoordinatesChange;
  }, [onCoordinatesChange]);

  const commitPosition = (position: L.LatLng) => {
    coordinatesChangeRef.current?.(position.lat.toFixed(6), position.lng.toFixed(6));
  };

  useEffect(() => {
    if (!containerRef.current) return;
    let resizeObserver: ResizeObserver | null = null;
    try {
      const initialPosition = initialPositionRef.current;
      const map = L.map(containerRef.current, {
        center: initialPosition ? [initialPosition.lat, initialPosition.lng] : CABO_SAN_LUCAS,
        zoom: initialPosition ? 17 : 13,
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      resizeObserver.observe(containerRef.current);
      setError('');
      setReady(true);
    } catch (mapError) {
      console.error('Villa geofence map initialization failed:', mapError);
      setError(copy.mapLoadError);
    }

    return () => {
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
      hasFramedRef.current = false;
    };
  }, [copy.mapLoadError]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    map.off('click');
    if (editable && !disabled) {
      map.on('click', event => {
        commitPosition(event.latlng);
        map.panTo(event.latlng);
      });
    }
    return () => { map.off('click'); };
  }, [disabled, editable, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const position = numericCoordinates(latitude, longitude);

    if (!position) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      hasFramedRef.current = false;
      return;
    }

    const center = L.latLng(position.lat, position.lng);
    if (!circleRef.current) {
      circleRef.current = L.circle(center, {
        radius: Number(radiusMeters) || 150,
        fillColor: '#f78c26',
        fillOpacity: 0.18,
        color: '#f78c26',
        opacity: 0.9,
        weight: 2,
        interactive: false,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(center).setRadius(Number(radiusMeters) || 150);
    }

    if (!markerRef.current) {
      markerRef.current = L.marker(center, {
        icon: GEOFENCE_ICON,
        title: copy.mapMarkerTitle,
        draggable: editable && !disabled,
        autoPan: true,
        keyboard: true,
      }).addTo(map);
      markerRef.current.on('drag', event => circleRef.current?.setLatLng((event.target as L.Marker).getLatLng()));
      markerRef.current.on('dragend', event => {
        const nextPosition = (event.target as L.Marker).getLatLng();
        commitPosition(nextPosition);
        map.panTo(nextPosition);
      });
    } else {
      markerRef.current.setLatLng(center);
      if (editable && !disabled) markerRef.current.dragging?.enable();
      else markerRef.current.dragging?.disable();
    }

    if (!hasFramedRef.current) {
      map.fitBounds(circleRef.current.getBounds(), { padding: [48, 48], maxZoom: 18 });
      hasFramedRef.current = true;
    }
  }, [copy.mapMarkerTitle, disabled, editable, latitude, longitude, radiusMeters, ready]);

  const hasCoordinates = Boolean(numericCoordinates(latitude, longitude));

  return <div className="pd-geofence-map-shell">
    <div ref={containerRef} className="pd-geofence-map" aria-label={copy.mapAriaLabel} />
    {!ready && !error && <div className="pd-map-state">{copy.mapLoading}</div>}
    {error && <div className="pd-map-state pd-map-error">{error}</div>}
    {ready && !hasCoordinates && <div className="pd-map-empty"><MapPin size={18} /><span>{editable ? copy.mapEmpty : copy.locationNotSet}</span></div>}
    {ready && editable && <p className="pd-map-instruction">{copy.mapInstruction}</p>}
    {editable && <div className="pd-radius-control">
      <label htmlFor="villa-geofence-radius">{copy.geofenceRadius}</label>
      <output htmlFor="villa-geofence-radius">{radiusMeters || 150} m</output>
      <input
        id="villa-geofence-radius"
        type="range"
        min="25"
        max="1000"
        step="25"
        value={Math.min(1000, Math.max(25, Number(radiusMeters) || 150))}
        disabled={disabled}
        onChange={event => onRadiusChange?.(event.target.value)}
      />
    </div>}
  </div>;
}
