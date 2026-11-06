export const DEFAULT_VILLA_GEOFENCE_RADIUS_METERS = 150;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface VillaGeofenceData {
  latitud?: number | null;
  longitud?: number | null;
  radio_geocerca_m?: number | null;
}

export function hasVillaCoordinates<T extends VillaGeofenceData>(
  project: T | null | undefined,
): project is T & { latitud: number; longitud: number } {
  return Boolean(
    project &&
      Number.isFinite(project.latitud) &&
      Number.isFinite(project.longitud) &&
      Math.abs(project.latitud as number) <= 90 &&
      Math.abs(project.longitud as number) <= 180,
  );
}

export function villaGeofenceRadius(project: VillaGeofenceData): number {
  const radius = project.radio_geocerca_m;
  return Number.isFinite(radius) && (radius as number) >= 25
    ? (radius as number)
    : DEFAULT_VILLA_GEOFENCE_RADIUS_METERS;
}

export function distanceBetweenCoordinatesMeters(
  origin: Coordinates,
  destination: Coordinates,
): number {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

export function isInsideVillaGeofence(project: VillaGeofenceData, distanceMeters: number): boolean {
  return distanceMeters <= villaGeofenceRadius(project);
}
