import type { ActivityType } from './activityRecognitionService';

/**
 * Filtro de Kalman Adaptativo de 2 Dimensiones para Coordenadas Geográficas (GPS).
 * 
 * Elimina la deriva satelital ("jitter/multipath") y el temblor de coordenadas cuando:
 * 1. El móvil está quieto en un escritorio o dentro de una edificación.
 * 2. El satélite GPS pierde precisión momentánea debido a techos o estructuras metálicas.
 */
export class KalmanLocationFilter {
  private lat: number | null = null;
  private lng: number | null = null;
  private varianceLat: number = 0;
  private varianceLng: number = 0;
  private lastTimestampMs: number = 0;

  // Grados por metro aproximados en latitud
  private readonly METERS_TO_LAT_DEG = 1 / 111319.49;

  /**
   * Reinicia el estado del filtro (útil al iniciar una nueva sesión de rastreo)
   */
  public reset() {
    this.lat = null;
    this.lng = null;
    this.varianceLat = 0;
    this.varianceLng = 0;
    this.lastTimestampMs = 0;
  }

  /**
   * Filtra una lectura bruta de GPS con el modelo Bayesiano de Kalman
   * 
   * @param rawLat Latitud recibida del satélite
   * @param rawLng Longitud recibida del satélite
   * @param accuracy Precisión en metros (margen de error circular reportado por Android)
   * @param timestampMs Momento de la lectura en milisegundos
   * @param activity Actividad física detectada por acelerómetro/podómetro
   * @returns Coordenadas óptimas y suavizadas
   */
  public filter(
    rawLat: number,
    rawLng: number,
    accuracy: number,
    timestampMs: number,
    activity: ActivityType = 'detenido'
  ): { latitude: number; longitude: number; accuracy: number } {
    // Garantizar precisión positiva razonable (mínimo 2 metros)
    const validAccuracy = Math.max(accuracy || 10, 2);

    // Factor de conversión métrico para longitud según la latitud actual
    const radLat = (rawLat * Math.PI) / 180;
    const metersToLngDeg = this.METERS_TO_LAT_DEG / Math.max(Math.cos(radLat), 0.1);

    // Varianza de medición (R) en grados al cuadrado: proporcional al error satelital
    const rLat = Math.pow(validAccuracy * this.METERS_TO_LAT_DEG, 2);
    const rLng = Math.pow(validAccuracy * metersToLngDeg, 2);

    // 1. Inicialización con la primera coordenada
    if (this.lat === null || this.lng === null || this.lastTimestampMs === 0) {
      this.lat = rawLat;
      this.lng = rawLng;
      this.varianceLat = rLat;
      this.varianceLng = rLng;
      this.lastTimestampMs = timestampMs;
      return { latitude: rawLat, longitude: rawLng, accuracy: validAccuracy };
    }

    // 2. Tiempo transcurrido (delta t en segundos)
    const deltaSeconds = Math.max((timestampMs - this.lastTimestampMs) / 1000, 0.1);
    this.lastTimestampMs = timestampMs;

    // 3. Covarianza del Proceso (Q) - Ajustada adaptativamente por Activity Recognition
    // Si el acelerómetro detecta 'detenido', la probabilidad de movimiento físico es casi nula
    let expectedVelocityMps = 0; // metros por segundo
    if (activity === 'conduciendo') {
      expectedVelocityMps = 25; // hasta ~90 km/h
    } else if (activity === 'caminando') {
      expectedVelocityMps = 2.0; // hasta ~7.2 km/h
    } else {
      // 'detenido': Q colapsa casi a cero para bloquear el temblor satelital en interiores
      expectedVelocityMps = 0.05;
    }

    const processDeltaMeters = expectedVelocityMps * deltaSeconds;
    const qLat = Math.pow(processDeltaMeters * this.METERS_TO_LAT_DEG, 2);
    const qLng = Math.pow(processDeltaMeters * metersToLngDeg, 2);

    // 4. Paso de Predicción (A priori)
    const pPriorLat = this.varianceLat + qLat;
    const pPriorLng = this.varianceLng + qLng;

    // 5. Ganancia de Kalman (K = P_prior / (P_prior + R))
    // Si la precisión es mala (R es grande), K es pequeña -> ignora el ruido satelital
    // Si la precisión es muy alta (R es pequeña), K es grande -> adopta la medición
    const kLat = pPriorLat / (pPriorLat + rLat);
    const kLng = pPriorLng / (pPriorLng + rLng);

    // 6. Rechazo de outliers (saltos cuánticos de triangulación imposibles)
    const distDeltaMeters = this.distanceMeters(this.lat, this.lng, rawLat, rawLng);
    const maxPossibleMeters = (activity === 'conduciendo' ? 60 : 15) * deltaSeconds;

    if (distDeltaMeters > maxPossibleMeters && validAccuracy > 20) {
      // Salto no creíble con baja precisión: descartar o atenuar fuertemente
      return {
        latitude: this.lat,
        longitude: this.lng,
        accuracy: Math.round(Math.sqrt(this.varianceLat) / this.METERS_TO_LAT_DEG),
      };
    }

    // 7. Paso de Actualización (A posteriori)
    this.lat = this.lat + kLat * (rawLat - this.lat);
    this.lng = this.lng + kLng * (rawLng - this.lng);

    this.varianceLat = (1 - kLat) * pPriorLat;
    this.varianceLng = (1 - kLng) * pPriorLng;

    // Precisión estimada posterior en metros
    const estimatedAccuracyMeters = Math.max(
      Math.round(Math.sqrt(this.varianceLat) / this.METERS_TO_LAT_DEG),
      2
    );

    return {
      latitude: Number(this.lat.toFixed(6)),
      longitude: Number(this.lng.toFixed(6)),
      accuracy: estimatedAccuracyMeters,
    };
  }

  private distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

// Instancia singleton para el rastreo del dispositivo
export const globalKalmanFilter = new KalmanLocationFilter();
