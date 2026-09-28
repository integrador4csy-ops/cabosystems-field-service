import React from 'react';
import type { LiveWorker } from '../../types/fleet';
import { detectPlace, formatDwellTime } from '../../lib/places';
import { GroupIcon, MapPinIcon, RegenerateIcon } from '../../icons';
import {
  Car,
  Footprints,
  CircleDot,
  Battery,
  Zap,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../../utils';

interface TeamListCardProps {
  workers: LiveWorker[];
  selectedWorkerId: string | null;
  onSelectWorker: (id: string) => void;
  loading: boolean;
  dwellStartTimesRef: React.MutableRefObject<Record<string, number>>;
  onClose?: () => void;
}

export const TeamListCard: React.FC<TeamListCardProps> = ({
  workers,
  selectedWorkerId,
  onSelectWorker,
  loading,
  dwellStartTimesRef,
}) => {
  return (
    <div className="flex flex-col h-full rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs">
      {/* Card Header - Clean Minimalist */}
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-[#f78c26]">
            <GroupIcon size={15} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 tracking-tight">Equipo de Campo</h3>
            <p className="text-[10.5px] text-slate-500">Telemetría y paradas</p>
          </div>
        </div>

        <span className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {workers.length} {workers.length === 1 ? 'técnico' : 'técnicos'}
        </span>
      </div>

      {/* Technician List */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
        {workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            {loading ? (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <RegenerateIcon size={22} className="animate-spin text-[#f78c26]" />
                <span className="text-xs font-semibold text-slate-600">Sincronizando flota...</span>
              </div>
            ) : (
              <div className="text-slate-400 space-y-1">
                <p className="text-xs font-semibold text-slate-700">Sin técnicos en radar</p>
                <p className="text-[11px] text-slate-400">Ajusta el filtro de búsqueda</p>
              </div>
            )}
          </div>
        ) : (
          workers.map((worker) => {
            const { profile, location, isOffline, relativeTime } = worker;
            const isSelected = selectedWorkerId === profile.id;
            const displayName =
              profile.nombre || profile.full_name || profile.email || 'Técnico CSY';
            const initials =
              displayName
                .split(' ')
                .filter(Boolean)
                .map((p) => p[0])
                .join('')
                .substring(0, 2)
                .toUpperCase() || 'CS';

            const speed = location.velocidad || 0;
            const isDriving = location.actividad === 'conduciendo' || speed > 12;
            const isWalking =
              location.actividad === 'caminando' || (!isDriving && speed >= 2.5 && speed <= 12);

            const detectedPlace = detectPlace(location.latitud, location.longitud);
            if (!dwellStartTimesRef.current[profile.id]) {
              const updatedTime = new Date(location.updated_at).getTime();
              dwellStartTimesRef.current[profile.id] = updatedTime - 45 * 60 * 1000;
            }
            const dwellText = formatDwellTime(dwellStartTimesRef.current[profile.id]);

            return (
              <div
                key={profile.id}
                onClick={() => onSelectWorker(profile.id)}
                className={cn(
                  'group relative flex items-start gap-2.5 rounded-xl p-2.5 my-1 cursor-pointer transition-all duration-150 border',
                  isSelected
                    ? 'border-[#f78c26] bg-orange-50/50 shadow-xs'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                  isOffline && !isSelected && 'opacity-65'
                )}
                title="Clic para enfocar en el mapa satelital"
              >
                {/* Avatar with Online/Offline Dot */}
                <div className="relative shrink-0 mt-0.5">
                  <div className="h-9 w-9 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-700 overflow-hidden shadow-2xs">
                    {profile.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white',
                      isOffline ? 'bg-slate-400' : 'bg-emerald-500'
                    )}
                  />
                </div>

                {/* Info Container */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-slate-800 truncate group-hover:text-[#f78c26] transition-colors">
                      {displayName}
                    </h4>
                    <span
                      className={cn(
                        'text-[10px] font-semibold shrink-0',
                        isOffline ? 'text-slate-400' : 'text-emerald-700'
                      )}
                    >
                      {isOffline ? relativeTime : 'En línea'}
                    </span>
                  </div>

                  {/* Place & Dwell */}
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-600">
                    <MapPinIcon size={12} className="text-[#f78c26] shrink-0" />
                    <span className="truncate font-medium">
                      {detectedPlace ? detectedPlace.name : (isDriving ? 'En ruta' : 'En sitio')}
                    </span>
                    <span className="text-slate-400 shrink-0 font-normal">· {dwellText}</span>
                  </div>

                  {/* Telemetry Badges */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {/* Battery */}
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border',
                        location.esta_cargando
                          ? 'border-orange-200 bg-orange-50 text-orange-700'
                          : (location.bateria ?? 100) < 20
                          ? 'border-red-200 bg-red-50 text-red-600'
                          : 'border-slate-200 bg-slate-100 text-slate-700'
                      )}
                      title={location.esta_cargando ? 'Cargando batería' : 'Nivel de batería'}
                    >
                      {location.esta_cargando ? (
                        <Zap size={10} className="text-[#f78c26] fill-[#f78c26]" />
                      ) : (
                        <Battery size={10} className="text-slate-500" />
                      )}
                      <span>{location.bateria !== null ? `${location.bateria}%` : '--'}</span>
                    </span>

                    {/* Movement Activity */}
                    {isDriving ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
                        <Car size={10} />
                        <span>{speed > 0 ? `${Math.round(speed)} km/h` : 'En ruta'}</span>
                      </span>
                    ) : isWalking ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        <Footprints size={10} />
                        <span>Caminando</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                        <CircleDot size={9} />
                        <span>Detenido</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Chevron */}
                <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight size={14} className="text-slate-400" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
