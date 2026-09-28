// Geofencing and Places detector (Life360 style)
export interface KnownPlace {
  id: string;
  name: string;
  category: 'office' | 'home' | 'client';
  lat: number;
  lng: number;
  radius: number; // meters
}

export const KNOWN_PLACES: KnownPlace[] = [
  {
    id: 'cabo-systems-hq',
    name: 'Cabo Systems',
    category: 'office',
    lat: 23.0626,
    lng: -109.7037,
    radius: 120, // 120m covers the Cabo Systems building complex and surroundings
  },
];

export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function detectPlace(lat: number, lng: number): KnownPlace | null {
  for (const place of KNOWN_PLACES) {
    const dist = getDistanceMeters(lat, lng, place.lat, place.lng);
    if (dist <= place.radius) {
      return place;
    }
  }
  return null;
}

export function formatDwellTime(sinceTimestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - sinceTimestamp) / 1000));
  const diffMin = Math.floor(diffSec / 60);

  if (diffMin < 1) {
    return '1 min';
  }
  if (diffMin < 60) {
    return `${diffMin} min`;
  }
  const hours = Math.floor(diffMin / 60);
  const mins = diffMin % 60;
  if (mins === 0) {
    return `${hours} h`;
  }
  return `${hours} h, ${mins} min`;
}
