import { useEffect, useRef, useState } from 'react';
import { ExternalLink, LogIn, LogOut, X } from 'lucide-react';
import { useTranslation } from '../../context/LanguageContext';
import { loadGoogleMaps } from '../../lib/googleMapsLoader';

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
  const { t, language } = useTranslation();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [mapLoading, setMapLoading] = useState(true);
  const [mapError, setMapError] = useState('');

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
    let active = true;
    let resizeObserver: ResizeObserver | null = null;
    let marker: google.maps.marker.AdvancedMarkerElement | google.maps.Marker | null = null;
    let infoWindow: google.maps.InfoWindow | null = null;

    setMapLoading(true);
    setMapError('');

    void loadGoogleMaps(language)
      .then(() => {
        if (!active || !mapContainerRef.current) return;

        const map = new google.maps.Map(mapContainerRef.current, {
          center: { lat: data.latitude, lng: data.longitude },
          zoom: 17,
          mapId: import.meta.env.VITE_GOOGLE_MAP_ID || 'DEMO_MAP_ID',
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          colorScheme: google.maps.ColorScheme.LIGHT,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          streetViewControl: true,
          fullscreenControl: false,
        });
        mapRef.current = map;

        const pinElement = document.createElement('div');
        pinElement.style.display = 'flex';
        pinElement.style.alignItems = 'center';
        pinElement.style.justifyContent = 'center';
        pinElement.style.width = '38px';
        pinElement.style.height = '38px';
        pinElement.style.borderRadius = '50%';
        pinElement.style.backgroundColor = isIn ? '#059669' : '#f78c26';
        pinElement.style.color = '#ffffff';
        pinElement.style.boxShadow = '0 4px 14px rgba(0,0,0,0.35)';
        pinElement.style.border = '2.5px solid #ffffff';
        pinElement.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          ${isIn ? '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>' : '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'}
        </svg>`;

        if (google.maps.marker?.AdvancedMarkerElement) {
          marker = new google.maps.marker.AdvancedMarkerElement({
            map,
            position: { lat: data.latitude, lng: data.longitude },
            title: data.place || data.technicianName,
            content: pinElement,
          });
        } else {
          marker = new google.maps.Marker({
            map,
            position: { lat: data.latitude, lng: data.longitude },
            title: data.place || data.technicianName,
          });
        }

        infoWindow = new google.maps.InfoWindow({
          content: `<div style="padding:4px 6px;font-family:sans-serif;">
            <strong style="font-size:13px;color:#1e293b;">${data.place || data.technicianName}</strong>
            <div style="font-size:12px;color:#64748b;margin-top:2px;">${isIn ? 'Check-in' : 'Check-out'} · ${data.time}</div>
          </div>`,
        });
        infoWindow.open({ map, anchor: marker });

        resizeObserver = new ResizeObserver(() => google.maps.event.trigger(map, 'resize'));
        resizeObserver.observe(mapContainerRef.current);
        setMapLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        console.error('Error loading Google Maps in CheckLocationModal:', err);
        setMapError(t('No se pudo cargar Google Maps. Revisa la clave API y sus restricciones.'));
        setMapLoading(false);
      });

    return () => {
      active = false;
      resizeObserver?.disconnect();
      if (marker && 'map' in marker) {
        marker.map = null;
      }
      infoWindow?.close();
      mapRef.current = null;
    };
  }, [data.latitude, data.longitude, data.place, data.technicianName, data.time, isIn, language, t]);

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
          <div className="flex items-center gap-2">
            {data.photoUrl && onViewPhoto && (
              <button
                type="button"
                onClick={() => onViewPhoto(data.photoUrl!)}
                className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer mr-2"
              >
                {t('Ver evidencia')}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 transition-colors"
              aria-label={t('Cerrar')}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {data.comments && (
            <p className="text-xs text-slate-600 bg-amber-50/60 border border-amber-200/60 rounded-lg p-2.5">
              {data.comments}
            </p>
          )}

          {/* Interactive Google Map */}
          <div className="relative h-80 w-full rounded-xl overflow-hidden border border-slate-200 shadow-inner z-0">
            <div ref={mapContainerRef} className="h-full w-full" />
            {mapLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 backdrop-blur-xs z-10">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                  <span>{t('Cargando...')}</span>
                </div>
              </div>
            )}
            {mapError && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-100 p-4 text-center z-10">
                <p className="text-xs text-slate-600 max-w-sm">{mapError}</p>
              </div>
            )}
          </div>
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
