/**
 * Location Places and Reverse Geocoding Service
 * Crosses GPS coordinates with:
 * 1. Cabo Systems HQ / Known Places
 * 2. Assigned Villas / Developments from database (`proyectos`)
 * 3. Google Maps Places / Reverse Geocoding (if VITE_GOOGLE_MAPS_API_KEY is configured)
 * 4. OpenStreetMap Nominatim with caching fallback
 */

import { KNOWN_PLACES, getDistanceMeters } from './places';
import type { PlaceCategory } from './locationHistoryAnalytics';
import { supabase } from './supabase';

export interface ResolvedPlace {
  displayName: string;
  category: PlaceCategory;
  rawAddress?: string;
  source: 'known_place' | 'villa' | 'google_places' | 'google_geocoding' | 'osm_nominatim' | 'coordinates';
}

export interface KnownVilla {
  id: string;
  nombre: string;
  latitud: number;
  longitud: number;
}

// In-memory cache for resolved locations
const placeCache = new Map<string, ResolvedPlace>();

function getCacheKey(lat: number, lng: number): string {
  // Round to ~100m grid for caching efficiency
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

let cachedVillas: KnownVilla[] | null = null;
let lastVillasFetch = 0;

/**
 * Loads project/villa coordinates from Supabase (cached for 10 minutes)
 */
export async function loadKnownVillas(): Promise<KnownVilla[]> {
  const now = Date.now();
  if (cachedVillas && now - lastVillasFetch < 10 * 60 * 1000) {
    return cachedVillas;
  }

  try {
    const { data, error } = await supabase
      .from('proyectos')
      .select('id, nombre, latitud, longitud')
      .not('latitud', 'is', null)
      .not('longitud', 'is', null);

    if (error || !data) {
      return cachedVillas || [];
    }

    cachedVillas = data.filter(
      (p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud)
    ) as KnownVilla[];
    lastVillasFetch = now;
    return cachedVillas;
  } catch (err) {
    console.warn('Error loading known villas:', err);
    return cachedVillas || [];
  }
}

/**
 * Resolves coordinates into a human-readable place name and category
 */
export async function resolveLocationPlace(
  lat: number,
  lng: number,
  villasList?: KnownVilla[]
): Promise<ResolvedPlace> {
  const cacheKey = getCacheKey(lat, lng);
  if (placeCache.has(cacheKey)) {
    return placeCache.get(cacheKey)!;
  }

  // 1. Check Cabo Systems Known Places (HQ, warehouses)
  for (const place of KNOWN_PLACES) {
    const dist = getDistanceMeters(lat, lng, place.lat, place.lng);
    if (dist <= place.radius) {
      const isCommercial = place.category === 'commercial';
      const isOffice = place.category === 'office';
      const res: ResolvedPlace = {
        displayName: isCommercial ? `Cerca de ${place.name}` : `En ${place.name}`,
        category: isCommercial ? 'commercial' : isOffice ? 'office' : 'villa',
        source: 'known_place',
      };
      placeCache.set(cacheKey, res);
      return res;
    }
  }

  // 2. Check Database Villas / Projects (within 120m)
  const villas = villasList || (await loadKnownVillas());
  for (const villa of villas) {
    const dist = getDistanceMeters(lat, lng, villa.latitud, villa.longitud);
    if (dist <= 130) {
      const res: ResolvedPlace = {
        displayName: `En Villa: ${villa.nombre}`,
        category: 'villa',
        source: 'villa',
      };
      placeCache.set(cacheKey, res);
      return res;
    }
  }

  // 3. Google Maps APIs (if VITE_GOOGLE_MAPS_API_KEY is configured)
  const googleApiKey =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GOOGLE_MAPS_API_KEY
      : undefined;

  if (googleApiKey && typeof googleApiKey === 'string' && googleApiKey.trim().length > 10) {
    try {
      // Try Google Places Nearby search first for shopping malls / plazas / businesses
      const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=120&key=${googleApiKey}`;
      const placesResp = await fetch(placesUrl);
      if (placesResp.ok) {
        const placesData = await placesResp.json();
        if (placesData.results && placesData.results.length > 0) {
          // Look for shopping malls, stores, plazas, or notable venues
          const commercialPlace = placesData.results.find((p: { types?: string[] }) =>
            p.types?.some((t: string) =>
              ['shopping_mall', 'store', 'department_store', 'supermarket', 'point_of_interest'].includes(t)
            )
          ) || placesData.results[0];

          if (commercialPlace && commercialPlace.name) {
            const res: ResolvedPlace = {
              displayName: `Cerca de ${commercialPlace.name}`,
              category: 'commercial',
              rawAddress: commercialPlace.vicinity,
              source: 'google_places',
            };
            placeCache.set(cacheKey, res);
            return res;
          }
        }
      }

      // If no commercial place, try Google Geocoding for street name
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleApiKey}&language=es`;
      const geocodeResp = await fetch(geocodeUrl);
      if (geocodeResp.ok) {
        const geocodeData = await geocodeResp.json();
        if (geocodeData.results && geocodeData.results.length > 0) {
          const first = geocodeData.results[0];
          const route = first.address_components?.find((c: { types: string[] }) =>
            c.types.includes('route')
          )?.short_name;
          const neighborhood = first.address_components?.find((c: { types: string[] }) =>
            c.types.includes('sublocality') || c.types.includes('neighborhood')
          )?.short_name;

          let label = route ? `Cerca de ${route}` : first.formatted_address;
          if (route && neighborhood) {
            label = `${route}, ${neighborhood}`;
          }

          const res: ResolvedPlace = {
            displayName: label,
            category: 'street',
            rawAddress: first.formatted_address,
            source: 'google_geocoding',
          };
          placeCache.set(cacheKey, res);
          return res;
        }
      }
    } catch (googleErr) {
      console.warn('Google Maps reverse geocode query error:', googleErr);
    }
  }

  // 4. OpenStreetMap Nominatim reverse geocoding fallback
  try {
    const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const resp = await fetch(osmUrl, {
      headers: {
        'Accept-Language': 'es',
        'User-Agent': 'CaboSystems-FieldService/1.0',
      },
    });

    if (resp.ok) {
      const data = await resp.json();
      const addr = data.address || {};

      // Check if it's a shopping mall, supermarket, commercial center, or amenity
      const placeName =
        data.namedetails?.name ||
        addr.commercial ||
        addr.retail ||
        addr.amenity ||
        addr.shop ||
        addr.mall ||
        addr.leisure ||
        addr.tourism;

      if (placeName && typeof placeName === 'string') {
        const res: ResolvedPlace = {
          displayName: `Cerca de ${placeName}`,
          category: 'commercial',
          rawAddress: data.display_name,
          source: 'osm_nominatim',
        };
        placeCache.set(cacheKey, res);
        return res;
      }

      // Check street / road
      const road = addr.road || addr.highway || addr.street;
      const suburb = addr.suburb || addr.neighbourhood || addr.residential;

      if (road) {
        const isHighway = /carretera|corredor|transpeninsular|federal/i.test(road);
        const displayName = isHighway
          ? `Tramo ${road}`
          : suburb
          ? `Cerca de ${road}, ${suburb}`
          : `Cerca de ${road}`;

        const res: ResolvedPlace = {
          displayName,
          category: 'street',
          rawAddress: data.display_name,
          source: 'osm_nominatim',
        };
        placeCache.set(cacheKey, res);
        return res;
      }

      if (data.display_name) {
        const parts = data.display_name.split(',');
        const shortLabel = parts.slice(0, 2).join(',').trim();
        const res: ResolvedPlace = {
          displayName: `Cerca de ${shortLabel}`,
          category: 'street',
          rawAddress: data.display_name,
          source: 'osm_nominatim',
        };
        placeCache.set(cacheKey, res);
        return res;
      }
    }
  } catch (osmErr) {
    console.warn('OSM Nominatim reverse geocoding error:', osmErr);
  }

  // 5. Fallback coordinates representation
  const fallback: ResolvedPlace = {
    displayName: `Ubicación (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    category: 'unknown',
    source: 'coordinates',
  };
  placeCache.set(cacheKey, fallback);
  return fallback;
}
