import React from 'react';
import { Users, Radio, Car, BatteryCharging, Zap } from 'lucide-react';
import type { LiveWorker } from '../../types/fleet';

interface FleetMetricsProps {
  workers: LiveWorker[];
  onlineCount: number;
  movingCount: number;
  offlineCount: number;
}

export const FleetMetrics: React.FC<FleetMetricsProps> = ({
  workers,
  onlineCount,
  movingCount,
  offlineCount,
}) => {
  // Average battery calculation
  const batteryStats = React.useMemo(() => {
    const valid = workers
      .map((w) => w.location.bateria)
      .filter((b): b is number => typeof b === 'number' && !isNaN(b));
    if (valid.length === 0) return { avg: 100, charging: 0 };
    const sum = valid.reduce((acc, curr) => acc + curr, 0);
    const avg = Math.round(sum / valid.length);
    const charging = workers.filter((w) => w.location.esta_cargando).length;
    return { avg, charging };
  }, [workers]);

  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      {/* 1. Total Flota */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1f2736] bg-[#121721] p-4 lg:p-5 shadow-sm transition-all hover:border-[#2e3a4e]">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-brand-500/25 bg-brand-500/10 text-brand-500">
            <Users size={20} />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-500/30 bg-brand-500/10 px-2 py-0.5 text-[11px] font-bold text-brand-400">
            Los Cabos
          </span>
        </div>
        <div className="mt-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Total en Radar
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              {workers.length}
            </h3>
            <span className="text-xs font-medium text-gray-400">
              {offlineCount > 0 ? `(${offlineCount} offline)` : '100% online'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Conectados en Línea */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1f2736] bg-[#121721] p-4 lg:p-5 shadow-sm transition-all hover:border-[#2e3a4e]">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <Radio size={20} />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 beacon-pulse" />
            {Math.round((onlineCount / (workers.length || 1)) * 100)}%
          </span>
        </div>
        <div className="mt-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            En Línea (GPS Activo)
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              {onlineCount}
            </h3>
            <span className="text-xs font-medium text-emerald-400">transmitiendo</span>
          </div>
        </div>
      </div>

      {/* 3. En Ruta / Tránsito */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1f2736] bg-[#121721] p-4 lg:p-5 shadow-sm transition-all hover:border-[#2e3a4e]">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-400">
            <Car size={20} />
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400">
            &gt;12 km/h
          </span>
        </div>
        <div className="mt-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Unidades en Ruta
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              {movingCount}
            </h3>
            <span className="text-xs font-medium text-amber-400">en movimiento</span>
          </div>
        </div>
      </div>

      {/* 4. Nivel Promedio de Batería */}
      <div className="relative overflow-hidden rounded-2xl border border-[#1f2736] bg-[#121721] p-4 lg:p-5 shadow-sm transition-all hover:border-[#2e3a4e]">
        <div className="flex items-center justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-400">
            <Zap size={20} />
          </div>
          {batteryStats.charging > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
              <BatteryCharging size={12} />
              {batteryStats.charging} cargando
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-bold text-cyan-400">
              Promedio
            </span>
          )}
        </div>
        <div className="mt-4">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Telemetría de Batería
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <h3 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              {batteryStats.avg}%
            </h3>
            <span className="text-xs font-medium text-gray-400">nivel de flota</span>
          </div>
        </div>
      </div>
    </div>
  );
};
