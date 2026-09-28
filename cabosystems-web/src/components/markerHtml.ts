import type { LiveWorker } from '../types/fleet';

// SVG Icons (Clean vector aesthetics matching template and mobile card)
const LIGHTNING_BOLT_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="#f78c26" stroke="#f78c26" stroke-width="1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
const BATTERY_NORMAL_SVG = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>`;

const HOVER_BATTERY_CHARGING_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#f78c26" stroke="#f78c26" stroke-width="1.5" style="display:inline-block; vertical-align:middle; margin-right:4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
const HOVER_BATTERY_NORMAL_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px;"><rect x="2" y="7" width="16" height="10" rx="2" ry="2"/><line x1="22" y1="11" x2="22" y2="13"/></svg>`;

/**
 * Generates the HTML string for the Leaflet divIcon representing the technician.
 * Matches clean Life360 pin: circular avatar with green online dot, pointer, battery charging pill.
 */
export function createLife360MarkerHtml(
  worker: LiveWorker,
  heading?: number | null,
  placeName?: string | null,
  dwellTime?: string | null
): string {
  const { profile, location, isOffline } = worker;
  
  // Speed & Activity status
  const speed = location.velocidad ? Math.round(location.velocidad) : 0;
  const isDriving = location.actividad === 'conduciendo' || speed > 12;
  const isWalking = location.actividad === 'caminando' || (!isDriving && speed >= 2.5 && speed <= 12);
  const isMoving = isDriving || isWalking || speed >= 3;

  // Life360 Top Place & Dwell Badge (e.g. "Cabo Systems · 45 min")
  let placeBadge = '';
  if (!isOffline && !isMoving && (placeName || dwellTime)) {
    const badgeText = placeName
      ? (dwellTime ? `${placeName} · ${dwellTime}` : placeName)
      : (dwellTime || 'En sitio');

    placeBadge = `
      <div class="life360-place-pill" title="${badgeText}">
        <span class="life360-place-text">${badgeText}</span>
      </div>
    `;
  }

  // Heading pointer arrow when moving
  let headingCone = '';
  const effectiveHeading = (heading !== undefined && heading !== null) ? heading : location.rumbo;
  if (!isOffline && isMoving && effectiveHeading !== null && effectiveHeading !== undefined) {
    headingCone = `
      <div class="life360-heading-cone" style="transform: rotate(${effectiveHeading}deg);" title="Rumbo: ${effectiveHeading}°">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L18 18L12 14L6 18L12 2Z" fill="#f78c26" stroke="#ffffff" stroke-width="1.8" stroke-linejoin="round"/>
        </svg>
      </div>
    `;
  }

  let speedBadge = '';
  if (isDriving) {
    speedBadge = '<div class="life360-speed-badge" title="En vehículo"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f78c26" stroke-width="2.5"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg></div>';
  } else if (isWalking) {
    speedBadge = '<div class="life360-speed-badge" title="Caminando"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2.5"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.5-2 8.5V16"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.5 2 8.5V20"/></svg></div>';
  }

  // Avatar or Initials
  const displayName = profile.nombre || profile.full_name || profile.email || 'CS';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'CS';

  const avatarContent = profile.avatar_url
    ? `<img class="life360-avatar-img" src="${profile.avatar_url}" alt="${displayName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="life360-avatar-fallback" style="display:none;">${initials}</div>`
    : `<div class="life360-avatar-fallback">${initials}</div>`;

  // Battery percentage & lightning charging icon
  const batteryLevel = location.bateria !== null ? `${location.bateria}%` : '--%';
  const isCharging = location.esta_cargando;
  const batteryIcon = isCharging ? LIGHTNING_BOLT_SVG : BATTERY_NORMAL_SVG;

  return `
    <div class="life360-marker-container ${isOffline ? 'is-offline' : ''}">
      <div class="life360-accuracy-halo"></div>

      <div class="life360-avatar-wrapper">
        ${placeBadge}
        ${headingCone}
        <div class="life360-avatar-bubble">
          <div class="life360-avatar-inner">
            ${avatarContent}
          </div>
          <span class="life360-avatar-status-dot ${isOffline ? 'offline' : 'online'}"></span>
          ${speedBadge}
        </div>
        <div class="life360-bubble-pointer"></div>
        <div class="life360-battery-pill ${isCharging ? 'is-charging' : ''}">
          ${batteryIcon}
          <span>${batteryLevel}</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Generates the CaboSystems Hover Card displayed when the user hovers over a technician pin.
 */
export function createHoverCardHtml(
  worker: LiveWorker,
  placeName?: string | null,
  dwellTime?: string | null
): string {
  const { profile, location, isOffline } = worker;
  const updatedDate = new Date(location.updated_at);
  const timeFormatted = updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // Determine if update is recent (< 60s) -> show "Ahora"
  const now = Date.now();
  const updateTime = updatedDate.getTime();
  const diffSec = Math.max(0, Math.floor((now - updateTime) / 1000));
  const isRecent = !isOffline && diffSec < 60;
  const timeDisplay = isRecent ? 'Ahora' : timeFormatted;

  const displayName = profile.nombre || profile.full_name || profile.email || 'Técnico CaboSystems';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .map(p => p[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'CS';

  const avatarTag = profile.avatar_url
    ? `<img class="hover-card-avatar" src="${profile.avatar_url}" alt="" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" /><div class="hover-card-avatar-fallback" style="display:none;">${initials}</div>`
    : `<div class="hover-card-avatar-fallback">${initials}</div>`;

  const statusBadge = isOffline
    ? `<span class="hover-card-badge offline">Desconectado</span>`
    : `<span class="hover-card-badge online"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#10b981;margin-right:4px;"></span>En línea</span>`;

  const roleValue = profile.rol || profile.role || 'tecnico';
  const roleName = roleValue === 'admin' ? 'Administrador' : 'Técnico de Campo';
  const speed = location.velocidad ? Math.round(location.velocidad) : 0;
  const isDrivingCard = location.actividad === 'conduciendo' || speed > 12;
  const isWalkingCard = location.actividad === 'caminando' || (!isDrivingCard && speed >= 2.5 && speed <= 12);

  let speedText = '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:6px;"></span>En sitio / Detenido';
  if (isDrivingCard) {
    speedText = speed > 0 ? `Conduciendo (${speed} km/h)` : 'En vehículo';
  } else if (isWalkingCard) {
    speedText = speed > 0 ? `Caminando (${speed} km/h)` : 'Caminando a pie';
  }

  // Battery: charging battery icon, percentage, NO word "(cargando)", NO lightning emoji
  const batteryIcon = location.esta_cargando ? HOVER_BATTERY_CHARGING_SVG : HOVER_BATTERY_NORMAL_SVG;
  const batteryText = location.bateria !== null
    ? `${batteryIcon}<span style="font-weight:700;">${location.bateria}%</span>`
    : 'No disponible';

  return `
    <div class="hover-card-inner">
      <div class="hover-card-header">
        ${avatarTag}
        <div class="hover-card-info">
          <h4 class="hover-card-title">${displayName}</h4>
          <div class="hover-card-subtitle">${profile.email || 'CaboSystems'}</div>
          <div class="hover-card-badges">
            <span class="hover-card-badge role">${roleName}</span>
            ${statusBadge}
          </div>
        </div>
      </div>

      <div class="hover-card-row">
        <span class="hover-card-label">Ubicación</span>
        <span class="hover-card-value" style="color: #f78c26; font-weight: 700;">${placeName || 'San José del Cabo'}</span>
      </div>

      ${dwellTime ? `
      <div class="hover-card-row">
        <span class="hover-card-label">Desde:</span>
        <span class="hover-card-value" style="color: #0284c7; font-weight: 600;">${dwellTime}</span>
      </div>
      ` : ''}

      <div class="hover-card-row">
        <span class="hover-card-label">Estado</span>
        <span class="hover-card-value">${speedText}</span>
      </div>

      <div class="hover-card-row">
        <span class="hover-card-label">Batería</span>
        <span class="hover-card-value" style="display:flex; align-items:center;">${batteryText}</span>
      </div>

      <div class="hover-card-footer">
        <span>Última actualización:</span>
        <strong style="color: ${isRecent ? '#059669' : '#64748b'}; font-weight: 700;">${timeDisplay}</strong>
      </div>
    </div>
  `;
}
