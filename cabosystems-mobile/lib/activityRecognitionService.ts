import { Accelerometer, Pedometer } from 'expo-sensors';
import type { EventSubscription } from 'expo-modules-core';

export type ActivityType = 'detenido' | 'caminando' | 'conduciendo';

interface MotionTelemetry {
  activity: ActivityType;
  stepCadence: number;
  variance: number;
  isStill: boolean;
}

// Ventana de muestras para varianza de aceleración (~2.4s a 400ms por muestra)
const BUFFER_SIZE = 6;
const accelBuffer: number[] = [];

let accelSubscription: EventSubscription | null = null;
let pedometerSubscription: EventSubscription | null = null;
let isPedometerAvailable = false;
let recentStepCount = 0;
let lastStepTimestamp = 0;
let currentActivity: ActivityType = 'detenido';
let currentVariance = 0;

/**
 * Calcula la varianza de un arreglo numérico
 */
function calculateVariance(samples: number[]): number {
  if (samples.length < 2) return 0;
  const mean = samples.reduce((acc, val) => acc + val, 0) / samples.length;
  const squareDiffs = samples.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0);
  return squareDiffs / samples.length;
}

/**
 * Inicia el monitoreo de sensores inerciales (Acelerómetro + Podómetro)
 */
export async function startActivityRecognition() {
  // 1. Configurar acelerómetro a baja frecuencia (400ms = 2.5 Hz, óptimo para batería)
  try {
    Accelerometer.setUpdateInterval(400);
    accelSubscription = Accelerometer.addListener(({ x, y, z }) => {
      // Magnitud dinámica sustrayendo la gravedad terrestre (1.0G)
      const rawMagnitude = Math.sqrt(x * x + y * y + z * z);
      const dynamicMagnitude = Math.abs(rawMagnitude - 1.0);

      accelBuffer.push(dynamicMagnitude);
      if (accelBuffer.length > BUFFER_SIZE) {
        accelBuffer.shift();
      }

      currentVariance = calculateVariance(accelBuffer);
    });
  } catch (err) {
    console.warn('Error iniciando Acelerómetro:', err);
  }

  // 2. Podómetro nativo (detección directa de pasos humanos)
  try {
    isPedometerAvailable = await Pedometer.isAvailableAsync();
    if (isPedometerAvailable) {
      let lastTotalSteps = -1;
      pedometerSubscription = Pedometer.watchStepCount((result) => {
        if (lastTotalSteps >= 0 && result.steps > lastTotalSteps) {
          recentStepCount += (result.steps - lastTotalSteps);
          lastStepTimestamp = Date.now();
        }
        lastTotalSteps = result.steps;
      });
    }
  } catch (err) {
    console.warn('Podómetro no disponible en este dispositivo:', err);
  }
}

/**
 * Detiene los sensores inerciales
 */
export function stopActivityRecognition() {
  if (accelSubscription) {
    accelSubscription.remove();
    accelSubscription = null;
  }
  if (pedometerSubscription) {
    pedometerSubscription.remove();
    pedometerSubscription = null;
  }
  accelBuffer.length = 0;
  recentStepCount = 0;
}

/**
 * Clasifica la actividad física combinando los sensores inerciales con la velocidad GPS
 *
 * Algoritmo de Fusión Sensorial:
 * 1. Si la velocidad GPS es > 12 km/h -> Inequívocamente en vehículo ('conduciendo').
 * 2. Si hay pasos activos en los últimos 4 segundos o la varianza del acelerómetro
 *    muestra oscilaciones de impacto corporal (> 0.18) -> 'caminando'.
 * 3. Si la velocidad GPS es < 2.5 km/h y la varianza es muy baja (< 0.05) -> 'detenido' (filtra drift del GPS en interiores).
 */
export function classifyActivity(gpsSpeedKmH: number): ActivityType {
  const now = Date.now();
  const hasRecentSteps = (now - lastStepTimestamp) < 4000 && recentStepCount > 0;

  // A. Conduciendo
  if (gpsSpeedKmH > 12) {
    currentActivity = 'conduciendo';
    return currentActivity;
  }

  // B. Caminando a pie
  // Ya sea que el GPS marque entre 2.5 y 12 km/h, o que el podómetro/acelerómetro detecte pasos en una habitación
  if (hasRecentSteps || (currentVariance >= 0.16 && gpsSpeedKmH >= 1.5) || (gpsSpeedKmH >= 2.5 && gpsSpeedKmH <= 12)) {
    currentActivity = 'caminando';
    return currentActivity;
  }

  // C. En reposo / Detenido
  // Si la varianza del acelerómetro es casi nula (< 0.06), el móvil está quieto en una mesa o el técnico está parado
  currentActivity = 'detenido';
  return currentActivity;
}

/**
 * Indica si el dispositivo está físicamente inmóvil (para ahorro de energía GPS)
 */
export function isDevicePhysicallyStill(): boolean {
  return currentVariance < 0.05 && (Date.now() - lastStepTimestamp) > 5000;
}
