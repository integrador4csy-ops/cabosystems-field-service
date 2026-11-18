import { useEffect, useRef } from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ExternalLink, LogIn, LogOut, MapPin, X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';

export interface CheckLocationData {
  latitude: number;
  longitude: number;
  technicianName: string;
  checkType: 'check_in' | 'check_out';
  time: string;
  place: string;
  photoUrl: string | null;
  comments: string | null;
}

interface CheckLocationModalProps {
  data: CheckLocationData;
  onClose: () => void;
  onViewPhoto?: (url: string) => void;
}

export function CheckLocationModal({ data, onClose, onViewPhoto }: CheckLocationModalProps) {
  const { t } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const isIn = data.checkType === 'check_in';
  const googleMapsUrl = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    let resizeObserver: ResizeObserver | null = null;

    try {
      const map = L.map(mapContainerRef.current, {
        center: [data.latitude, data.longitude],
        zoom: 16,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const markerIcon = L.divIcon({
        className: 'check-location-pin',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${isIn ? '#059669' : '#f78c26'};color:#ffffff;box-shadow:0 4px 14px rgba(0,0,0,0.35);border:2.5px solid #ffffff;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${isIn ? '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>' : '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'}
          </svg>
        </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([data.latitude, data.longitude], { icon: markerIcon }).addTo(map);
      marker.bindPopup(`<b>${data.place || data.technicianName}</b><br><span style="font-size:12px;color:#64748b;">${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}</span>`);

      mapRef.current = map;
      resizeObserver = new ResizeObserver(() => map.invalidateSize({ pan: false }));
      resizeObserver.observe(mapContainerRef.current);
    } catch (err) {
      console.error('Error initializing check location map:', err);
    }

    return () => {
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [data.latitude, data.longitude, data.place, data.technicianName, isIn]);

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="check-location-title"
    >
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-100 text-brand-700'}`}>
              {isIn ? <LogIn size={20} /> : <LogOut size={20} />}
            </div>
            <div className="min-w-0">
              <h2 id="check-location-title" className="text-base font-semibold text-slate-800 truncate">
                {data.technicianName}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {isIn ? 'Check-in' : 'Check-out'} · {data.time} {data.place ? `· ${data.place}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
            aria-label={t('Cerrar')}
          >
            <X size={18} />
          </button>
        </header>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg">
              <MapPin size={14} className="text-brand-600 shrink-0" />
              <span>{t('Coordenadas')}: {data.latitude.toFixed(6)}, {data.longitude.toFixed(6)}</span>
            </div>
            {data.photoUrl && onViewPhoto && (
              <button
                type="button"
                onClick={() => onViewPhoto(data.photoUrl!)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
              >
                {t('Ver evidencia')}
              </button>
            )}
          </div>

          {data.comments && (
            <p className="text-xs text-slate-600 bg-amber-50/60 border border-amber-200/60 rounded-lg p-2.5">
              {data.comments}
            </p>
          )}

          {/* Interactive Leaflet Map */}
          <div
            ref={mapContainerRef}
            className="h-80 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner z-0"
          />
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3.5 bg-slate-50/60">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 shadow-xs transition-colors"
          >
            <ExternalLink size={14} />
            {t('Abrir en Google Maps')}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 hover:bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition-colors"
          >
            {t('Cerrar')}
          </button>
        </footer>
      </div>
    </div>
  );
}
