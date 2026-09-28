import React, { useRef, useEffect } from 'react';
import {
  SearchIcon,
  CloseIcon,
} from '../../icons';
import { Car, MapPin } from 'lucide-react';

interface AppHeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onlineCount: number;
  movingCount: number;
  offlineCount: number;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  searchQuery,
  onSearchChange,
  onlineCount,
  movingCount,
  offlineCount,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd+K / Ctrl+K still focuses input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 relative flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6 shadow-2xs">
      {/* Left: City of the company */}
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
        <MapPin size={14} className="text-[#f78c26] shrink-0" />
        <span className="hidden sm:inline">Los Cabos, B.C.S.</span>
      </div>

      {/* Center: Search Bar in the Exact Middle (No ⌘K icon) */}
      <div className="absolute left-1/2 -translate-x-1/2 w-full max-w-md px-4">
        <div className="relative flex items-center">
          <SearchIcon size={15} className="absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar técnico por nombre o correo..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9.5 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-[#f78c26] focus:ring-4 focus:ring-orange-500/10 focus:outline-none transition-all shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:text-slate-600"
              title="Borrar búsqueda"
            >
              <CloseIcon size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Right: Live Telemetry counters */}
      <div className="flex items-center gap-2">
        {/* Online pill */}
        <div
          className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"
          title="Técnicos conectados con señal activa"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-500 beacon-pulse" />
          <span>{onlineCount}</span>
          <span className="hidden sm:inline font-normal">en línea</span>
        </div>

        {/* Moving pill */}
        {movingCount > 0 && (
          <div
            className="flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700"
            title="Técnicos en movimiento/ruta (>12 km/h)"
          >
            <Car size={13} className="text-[#f78c26]" />
            <span>{movingCount}</span>
            <span className="hidden sm:inline font-normal">en ruta</span>
          </div>
        )}

        {/* Offline pill */}
        <div
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600"
          title="Técnicos sin señal reciente (>15 min)"
        >
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span>{offlineCount}</span>
          <span className="hidden sm:inline text-slate-500">offline</span>
        </div>
      </div>
    </header>
  );
};
