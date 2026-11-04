/**
 * Location History Analytics & Segmentation
 * Processes raw telemetry into discrete trips (movement) and stops (dwell events).
 * Detects prolonged stops (>= 20 minutes) and computes daily KPIs.
 */

export interface LocationHistoryRecord {
  id: string;
  usuario_id: string;
  latitud: number;
  longitud: number;
  precision?: number | null;
  velocidad?: number | null;
  bateria?: number | null;
  actividad?: string | null;
  created_at: string;
}

export type PlaceCategory = 'villa' | 'office' | 'commercial' | 'street' | 'unknown';

export interface HistoryStop {
  type: 'stop';
  id: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  durationMinutes: number;
  lat: number;
  lng: number;
  accuracy: number;
  isProlonged: boolean; // >= 20 minutes
  placeName?: string;
  placeCategory?: PlaceCategory;
  address?: string;
  batteryStart?: number | null;
  batteryEnd?: number | null;
  pointsCount: number;
}

export interface HistoryMovement {
  type: 'movement';
  id: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  durationMinutes: number;
  distanceMeters: number;
  avgSpeedKmH: number;
  maxSpeedKmH: number;
  path: [number, number][]; // [lat, lng] array
}

export type HistoryTimelineEvent = HistoryStop | HistoryMovement;

export interface DailyHistoryAnalysis {
  totalDistanceMeters: number;
  totalMovingTimeMs: number;
  totalStopTimeMs: number;
  totalStops: number;
  prolongedStops: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
  events: HistoryTimelineEvent[];
  fullPath: [number, number][];
}

const PROLONGED_STOP_THRESHOLD_MS = 20 * 60 * 1000; // 20 minutes
const STOP_RADIUS_METERS = 90; // Group points within 90m
const MIN_STOP_DURATION_MS = 3 * 60 * 1000; // 3 minutes minimum to consider a stop

/**
 * Haversine distance in meters between two lat/lng coordinates
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format milliseconds into a human-readable duration (e.g. "48 min", "1 h 12 min")
 */
export function formatDurationMs(ms: number): string {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) {
    return `${hours} h`;
  }
  return `${hours} h ${mins} min`;
}

/**
 * Format time of day from timestamp (e.g. "08:35")
 */
export function formatTimeOfDay(timestamp: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Analyzes chronological location points and partitions them into movement trips and stops
 */
export function analyzeLocationHistory(
  records: LocationHistoryRecord[]
): DailyHistoryAnalysis {
  if (!records || records.length === 0) {
    return {
      totalDistanceMeters: 0,
      totalMovingTimeMs: 0,
      totalStopTimeMs: 0,
      totalStops: 0,
      prolongedStops: 0,
      firstTimestamp: null,
      lastTimestamp: null,
      events: [],
      fullPath: [],
    };
  }

  // Sort ascending by creation time
  const sorted = [...records]
    .map((r) => ({
      ...r,
      time: new Date(r.created_at).getTime(),
    }))
    .filter((r) => Number.isFinite(r.time) && Number.isFinite(r.latitud) && Number.isFinite(r.longitud))
    .sort((a, b) => a.time - b.time);

  if (sorted.length === 0) {
    return {
      totalDistanceMeters: 0,
      totalMovingTimeMs: 0,
      totalStopTimeMs: 0,
      totalStops: 0,
      prolongedStops: 0,
      firstTimestamp: null,
      lastTimestamp: null,
      events: [],
      fullPath: [],
    };
  }

  const fullPath: [number, number][] = sorted.map((r) => [r.latitud, r.longitud]);
  const events: HistoryTimelineEvent[] = [];

  let currentCluster: typeof sorted = [];
  let clusterCenter = { lat: sorted[0].latitud, lng: sorted[0].longitud };
  let movementBuffer: typeof sorted = [];

  function flushMovement() {
    if (movementBuffer.length < 2) {
      movementBuffer = [];
      return;
    }
    const start = movementBuffer[0];
    const end = movementBuffer[movementBuffer.length - 1];
    const durationMs = Math.max(1000, end.time - start.time);

    let distanceMeters = 0;
    let maxSpeed = 0;
    const path: [number, number][] = [];

    for (let i = 0; i < movementBuffer.length; i++) {
      const pt = movementBuffer[i];
      path.push([pt.latitud, pt.longitud]);
      const speed = pt.velocidad || 0;
      if (speed > maxSpeed) maxSpeed = speed;

      if (i > 0) {
        const prev = movementBuffer[i - 1];
        distanceMeters += calculateHaversineDistance(
          prev.latitud,
          prev.longitud,
          pt.latitud,
          pt.longitud
        );
      }
    }

    const avgSpeedKmH =
      durationMs > 0 ? (distanceMeters / (durationMs / 1000)) * 3.6 : 0;

    events.push({
      type: 'movement',
      id: `mov-${start.id}-${end.id}`,
      startTime: start.time,
      endTime: end.time,
      durationMs,
      durationMinutes: Math.round(durationMs / 60000),
      distanceMeters: Math.round(distanceMeters),
      avgSpeedKmH: Math.round(avgSpeedKmH * 10) / 10,
      maxSpeedKmH: Math.round(maxSpeed * 10) / 10,
      path,
    });

    movementBuffer = [];
  }

  function flushStopCluster() {
    if (currentCluster.length === 0) return;
    const start = currentCluster[0];
    const end = currentCluster[currentCluster.length - 1];
    const durationMs = end.time - start.time;

    // Check if this cluster qualifies as a stop
    if (durationMs >= MIN_STOP_DURATION_MS || currentCluster.length >= 4) {
      // It's a stop!
      flushMovement();

      // Compute centroid
      let sumLat = 0;
      let sumLng = 0;
      let sumAcc = 0;
      for (const pt of currentCluster) {
        sumLat += pt.latitud;
        sumLng += pt.longitud;
        sumAcc += pt.precision || 10;
      }
      const centroidLat = sumLat / currentCluster.length;
      const centroidLng = sumLng / currentCluster.length;
      const avgAccuracy = Math.round(sumAcc / currentCluster.length);

      const isProlonged = durationMs >= PROLONGED_STOP_THRESHOLD_MS;

      events.push({
        type: 'stop',
        id: `stop-${start.id}-${end.id}`,
        startTime: start.time,
        endTime: end.time,
        durationMs,
        durationMinutes: Math.round(durationMs / 60000),
        lat: centroidLat,
        lng: centroidLng,
        accuracy: avgAccuracy,
        isProlonged,
        batteryStart: start.bateria ?? null,
        batteryEnd: end.bateria ?? null,
        pointsCount: currentCluster.length,
      });
    } else {
      // Too short to be a meaningful stop, treat as part of movement
      movementBuffer.push(...currentCluster);
    }

    currentCluster = [];
  }

  for (let i = 0; i < sorted.length; i++) {
    const pt = sorted[i];

    if (currentCluster.length === 0) {
      currentCluster.push(pt);
      clusterCenter = { lat: pt.latitud, lng: pt.longitud };
      continue;
    }

    const distFromCenter = calculateHaversineDistance(
      clusterCenter.lat,
      clusterCenter.lng,
      pt.latitud,
      pt.longitud
    );

    const speed = pt.velocidad || 0;

    // If point is close and speed is low or still
    if (distFromCenter <= STOP_RADIUS_METERS && speed < 8) {
      currentCluster.push(pt);
      // update running center
      clusterCenter.lat =
        (clusterCenter.lat * (currentCluster.length - 1) + pt.latitud) /
        currentCluster.length;
      clusterCenter.lng =
        (clusterCenter.lng * (currentCluster.length - 1) + pt.longitud) /
        currentCluster.length;
    } else {
      // Technician moved away
      flushStopCluster();
      // Start moving
      movementBuffer.push(pt);
      currentCluster = [pt];
      clusterCenter = { lat: pt.latitud, lng: pt.longitud };
    }
  }

  // Final flush
  flushStopCluster();
  flushMovement();

  // Compute daily totals
  let totalDistanceMeters = 0;
  let totalMovingTimeMs = 0;
  let totalStopTimeMs = 0;
  let totalStops = 0;
  let prolongedStops = 0;

  for (const ev of events) {
    if (ev.type === 'movement') {
      totalDistanceMeters += ev.distanceMeters;
      totalMovingTimeMs += ev.durationMs;
    } else if (ev.type === 'stop') {
      totalStopTimeMs += ev.durationMs;
      totalStops++;
      if (ev.isProlonged) {
        prolongedStops++;
      }
    }
  }

  return {
    totalDistanceMeters: Math.round(totalDistanceMeters),
    totalMovingTimeMs,
    totalStopTimeMs,
    totalStops,
    prolongedStops,
    firstTimestamp: sorted[0].time,
    lastTimestamp: sorted[sorted.length - 1].time,
    events,
    fullPath,
  };
}
