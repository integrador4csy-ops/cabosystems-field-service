// Geofencing y detector de lugares (estilo CaboSystems Life360)
export interface KnownPlace {
  id: string;
  name: string;
  category: 'office' | 'home' | 'client' | 'commercial';
  lat: number;
  lng: number;
  radius: number; // metros
}

export const KNOWN_PLACES: KnownPlace[] = [
  {
    id: 'cabo-systems-hq',
    name: 'Cabo Systems HQ',
    category: 'office',
    lat: 23.0626,
    lng: -109.7037,
    radius: 120,
  },
  {
    id: 'plaza-puerto-paraiso',
    name: 'Plaza Puerto Paraíso / Luxury Avenue',
    category: 'commercial',
    lat: 22.8860,
    lng: -109.9118,
    radius: 200,
  },
  {
    id: 'plaza-patio-los-cabos',
    name: 'Plaza Patio Los Cabos (Sendero)',
    category: 'commercial',
    lat: 22.9125,
    lng: -109.9320,
    radius: 250,
  },
  {
    id: 'plaza-copan',
    name: 'Plaza Copán',
    category: 'commercial',
    lat: 22.8942,
    lng: -109.9185,
    radius: 150,
  },
  {
    id: 'plaza-novva',
    name: 'Plaza Novva',
    category: 'commercial',
    lat: 22.9050,
    lng: -109.9020,
    radius: 180,
  },
  {
    id: 'costco-los-cabos',
    name: 'Costco Los Cabos',
    category: 'commercial',
    lat: 22.9038,
    lng: -109.8732,
    radius: 200,
  },
  {
    id: 'home-depot-los-cabos',
    name: 'Home Depot Los Cabos',
    category: 'commercial',
    lat: 22.9056,
    lng: -109.8710,
    radius: 180,
  },
  {
    id: 'walmart-csl',
    name: 'Walmart Cabo San Lucas',
    category: 'commercial',
    lat: 22.9002,
    lng: -109.9135,
    radius: 180,
  },
  {
    id: 'plaza-las-palmas',
    name: 'Plaza Las Palmas / La Comer San José',
    category: 'commercial',
    lat: 23.0520,
    lng: -109.7038,
    radius: 200,
  },
  {
    id: 'walmart-sjc',
    name: 'Walmart San José del Cabo',
    category: 'commercial',
    lat: 23.0645,
    lng: -109.7005,
    radius: 180,
  },
];

export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
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
