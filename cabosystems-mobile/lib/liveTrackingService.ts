import { Platform, Alert, Linking, AppState } from 'react-native';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as TaskManager from 'expo-task-manager';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';
import {
  startActivityRecognition,
  stopActivityRecognition,
  classifyActivity,
  isDevicePhysicallyStill,
  type ActivityType,
} from './activityRecognitionService';
import { globalKalmanFilter } from './kalmanLocationFilter';

export const BACKGROUND_LOCATION_TASK = 'cabosystems-background-location';
const TRACKING_USER_KEY = 'cabosystems_tracking_user_id';

let activeLocationSubscription: Location.LocationSubscription | null = null;
let foregroundHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
let activeBatterySubscription: Battery.Subscription | null = null;
let activeBatteryLevelSubscription: Battery.Subscription | null = null;
let batteryTelemetryTimer: ReturnType<typeof setInterval> | null = null;
let lastSentTimestamp = 0;
let lastSentCoords: { latitude: number; longitude: number } | null = null;
let lastSentBatteryLevel: number | null = null;
let lastSentCharging: boolean | null = null;
let currentTrackingUserId: string | null = null;

import { shouldShowBackgroundLocationPrompt } from '@/components/BackgroundLocationModal';

type PromptListener = () => void;
const promptListeners = new Set<PromptListener>();

export function subscribeToBackgroundLocationPrompt(listener: PromptListener) {
  promptListeners.add(listener);
  return () => {
    promptListeners.delete(listener);
  };
}

export function triggerBackgroundLocationPrompt() {
  promptListeners.forEach((fn) => {
    try {
      fn();
    } catch {}
  });
}


/**
 * Cálculo de distancia haversine entre dos puntos en metros
 */
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

let cachedBatteryTelemetry = { level: 100, isCharging: false };

/**
 * Obtención de nivel y estado real de batería del dispositivo móvil con timeout de seguridad
 */
async function getBatteryTelemetry(): Promise<{ level: number; isCharging: boolean }> {
  try {
    const batteryPromise = Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
    ]);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1200));

    const result = await Promise.race([batteryPromise, timeoutPromise]);
    if (!result) {
      return cachedBatteryTelemetry;
    }

    const [level, state] = result;
    const normalizedLevel = level >= 0 ? Math.round(level * 100) : cachedBatteryTelemetry.level;
    const isCharging =
      state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
    cachedBatteryTelemetry = { level: normalizedLevel, isCharging };
    return cachedBatteryTelemetry;
  } catch (err) {
    console.warn('Error leyendo batería con expo-battery:', err);
    return cachedBatteryTelemetry;
  }
}

/**
 * Transmite telemetría inmediata de batería si el estado de carga o porcentaje cambió (reacción en 1-2s)
 */
async function transmitBatteryChangeImmediate() {
  let userId = currentTrackingUserId;
  if (!userId) {
    try {
      userId = await SecureStore.getItemAsync(TRACKING_USER_KEY);
    } catch {}
  }
  if (!userId) return;

  try {
    const battery = await getBatteryTelemetry();
    const isChargingChanged = lastSentCharging !== null && battery.isCharging !== lastSentCharging;
    const isLevelChanged =
      lastSentBatteryLevel !== null && Math.abs(battery.level - lastSentBatteryLevel) >= 1;

    // Si es primera lectura o cambió el estado de carga o nivel
    if (lastSentCharging === null || isChargingChanged || isLevelChanged) {
      lastSentBatteryLevel = battery.level;
      lastSentCharging = battery.isCharging;

      const { error } = await supabase
        .from('ubicaciones_usuarios')
        .update({
          bateria: battery.level,
          esta_cargando: battery.isCharging,
          updated_at: new Date().toISOString(),
        })
        .eq('usuario_id', userId);

      if (!error) {
        console.log(
          `[Batería Reactiva] Actualizado: ${battery.level}% (Cargando: ${battery.isCharging})`
        );
      }
    }
  } catch (err) {
    console.warn('Error en transmitBatteryChangeImmediate:', err);
  }
}

/**
 * Envía la ubicación completa a la base de datos de Supabase con Activity Recognition
 */
async function transmitLocation(
  userId: string,
  location: Location.LocationObject,
  speedKmH: number
) {
  try {
    const battery = await getBatteryTelemetry();
    const heading = location.coords.heading && location.coords.heading >= 0 ? location.coords.heading : null;
    const detectedActivity = classifyActivity(speedKmH);

    // Filtrar coordenadas con el Filtro de Kalman Adaptativo (suprime temblor en reposo/interiores)
    const filteredCoords = globalKalmanFilter.filter(
      location.coords.latitude,
      location.coords.longitude,
      location.coords.accuracy || 10,
      location.timestamp || Date.now(),
      detectedActivity
    );

    const payload = {
      usuario_id: userId,
      latitud: filteredCoords.latitude,
      longitud: filteredCoords.longitude,
      precision: filteredCoords.accuracy,
      velocidad: speedKmH,
      rumbo: heading,
      bateria: battery.level,
      esta_cargando: battery.isCharging,
      actividad: detectedActivity,
      en_linea: true,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('ubicaciones_usuarios').upsert(payload);
    if (error) {
      console.warn('Error actualizando ubicacion en Supabase:', error.message);
    } else {
      lastSentTimestamp = Date.now();
      lastSentCoords = {
        latitude: filteredCoords.latitude,
        longitude: filteredCoords.longitude,
      };
      lastSentBatteryLevel = battery.level;
      lastSentCharging = battery.isCharging;

      // Enviar al historial de manera segura
      try {
        await supabase.from('historial_ubicaciones').insert({
          usuario_id: userId,
          latitud: filteredCoords.latitude,
          longitud: filteredCoords.longitude,
          precision: filteredCoords.accuracy,
          velocidad: speedKmH,
          bateria: battery.level,
          actividad: detectedActivity,
        });
      } catch (histErr) {
        // Ignorar error no crítico de inserción en historial
      }
    }
  } catch (err) {
    console.warn('Error en transmitLocation:', err);
  }
}

/**
 * Definición de la tarea en segundo plano (para móvil suspendido o pantalla bloqueada)
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Error en tarea en segundo plano de ubicación:', error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (locations && locations.length > 0) {
      const loc = locations[locations.length - 1];

      // Recuperar el usuario persistente (clave para que funcione en segundo plano headless)
      let userId = currentTrackingUserId;
      if (!userId) {
        try {
          userId = await SecureStore.getItemAsync(TRACKING_USER_KEY);
        } catch {}
      }
      if (!userId) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          userId = sessionData?.session?.user?.id || null;
        } catch {}
      }

      if (userId) {
        const rawSpeed = loc.coords.speed && loc.coords.speed >= 0 ? loc.coords.speed * 3.6 : 0;
        await transmitLocation(userId, loc, rawSpeed);
      } else {
        console.warn('Background location recibido pero sin usuario asignado.');
      }
    }
  }
});

/**
 * Inicia el servicio de rastreo adaptativo tipo Life360:
 * - Alta frecuencia (cada ~2-4s) al conducir para interpolación fluida en tiempo real
 * - Frecuencia moderada y ahorro de batería en reposo
 * - Servicio en segundo plano para cuando el teléfono esté bloqueado / suspendido
 */
export async function startLiveTracking(userId: string): Promise<boolean> {
  if (!userId) return false;

  currentTrackingUserId = userId;
  try {
    await SecureStore.setItemAsync(TRACKING_USER_KEY, userId);
  } catch {}

  try {
    // 1. Permisos de GPS en primer plano
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
    if (fgStatus !== 'granted') {
      Alert.alert(
        'Ubicación requerida',
        'CaboSystems necesita acceso a la ubicación para registrar tu asistencia técnica y sincronizar con la central.',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Abrir Ajustes', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    // 2. Verificar permiso en segundo plano ("Permitir todo el tiempo")
    let hasBgPermission = false;
    if (Platform.OS !== 'web') {
      try {
        const bgStatus = await Location.getBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
        if (bgStatus.status === 'granted') {
          hasBgPermission = true;
        } else {
          // No solicitar background permission de forma intempestiva en el arranque
          // para no congelar el ciclo de vida de la app ni expulsar al usuario.
          // En su lugar, mostrar el modal educativo de CaboSystems si aplica cooldown.
          const canShow = await shouldShowBackgroundLocationPrompt();
          if (canShow) {
            triggerBackgroundLocationPrompt();
          }
        }
      } catch (err) {
        console.warn('Error con background permission:', err);
      }
    }

    // Detener suscripciones y temporizadores previos si existen
    if (foregroundHeartbeatTimer) {
      clearInterval(foregroundHeartbeatTimer);
      foregroundHeartbeatTimer = null;
    }
    if (activeLocationSubscription) {
      activeLocationSubscription.remove();
      activeLocationSubscription = null;
    }

    // Iniciar sensores inerciales de actividad física (acelerómetro + podómetro)
    await startActivityRecognition();
    globalKalmanFilter.reset();

    // 3. INICIAR REGISTRO NATIVO EN SEGUNDO PLANO DE FORMA ESTABLE
    // Se ejecuta de manera segura sin `foregroundService` para eliminar los cierres nativos
    // fatales de Android 14 (ForegroundServiceStartNotAllowedException). FusedLocationProviderClient
    // de Google Play Services se encarga de entregar las ubicaciones a TaskManager de fondo.
    if (Platform.OS === 'android' && hasBgPermission) {
      try {
        const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
        if (isRegistered) {
          try {
            await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
          } catch {}
        }
        await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
          accuracy: Location.Accuracy.High,
          timeInterval: 2500, // 2.5 segundos: cadencia continua ultra-rápida
          distanceInterval: 0, // 0 metros para emitir siempre
          deferredUpdatesInterval: 0,
          deferredUpdatesDistance: 0,
          pausesUpdatesAutomatically: false,
        });
        console.log('[CABO_BG] Background location updates iniciado con éxito');
      } catch (bgErr) {
        console.warn('No se pudo iniciar background location updates (se continuará en primer plano):', bgErr);
      }
    }

    // 4. Monitoreo ultra-rápido reactivo de batería
    if (activeBatterySubscription) activeBatterySubscription.remove();
    if (activeBatteryLevelSubscription) activeBatteryLevelSubscription.remove();
    if (batteryTelemetryTimer) clearInterval(batteryTelemetryTimer);

    try {
      activeBatterySubscription = Battery.addBatteryStateListener(() => {
        transmitBatteryChangeImmediate();
      });
      activeBatteryLevelSubscription = Battery.addBatteryLevelListener(() => {
        transmitBatteryChangeImmediate();
      });
    } catch (batListenErr) {
      console.warn('No se pudo suscribir a eventos de batería:', batListenErr);
    }

    batteryTelemetryTimer = setInterval(() => {
      transmitBatteryChangeImmediate();
    }, 2000);

    // 5. Envío inicial inmediato
    try {
      const initialPos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (initialPos) {
        const rawSpeed = initialPos.coords.speed && initialPos.coords.speed >= 0 ? initialPos.coords.speed * 3.6 : 0;
        await transmitLocation(userId, initialPos, rawSpeed);
      }
    } catch (initialErr) {
      console.warn('Error obteniendo posición inicial:', initialErr);
    }

    // 6. Suscripción continua en primer plano con Fused Location Provider
    activeLocationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2500, // Cadencia continua cada 2.5 a 3s
        distanceInterval: 0,
      },
      (newLocation) => {
        if (!newLocation?.coords) return;

        const now = Date.now();
        const rawSpeed = newLocation.coords.speed && newLocation.coords.speed >= 0
          ? newLocation.coords.speed * 3.6
          : 0;

        let distanceDelta = 0;
        if (lastSentCoords) {
          distanceDelta = getDistanceMeters(
            lastSentCoords.latitude,
            lastSentCoords.longitude,
            newLocation.coords.latitude,
            newLocation.coords.longitude
          );
        }

        const elapsedMs = now - lastSentTimestamp;

        // Estrategia CaboSystems adaptativa (Life360 style):
        // 1. Conduciendo (> 12 km/h): cada 2 segundos o cada 8 metros
        // 2. Caminando a pie (2.5 a 12 km/h): cada 2.5 segundos o cada 4 metros
        // 3. En reposo / escritorio / detenido (<= 2.5 km/h): cada 3 segundos exactos
        const isDriving = rawSpeed > 12;
        const isWalking = rawSpeed >= 2.5 && rawSpeed <= 12;

        if (isDriving) {
          if (elapsedMs >= 2000 || distanceDelta >= 8) {
            transmitLocation(userId, newLocation, rawSpeed);
          }
        } else if (isWalking) {
          if (elapsedMs >= 2500 || distanceDelta >= 4) {
            transmitLocation(userId, newLocation, rawSpeed);
          }
        } else {
          if (elapsedMs >= 3000 || distanceDelta >= 2) {
            transmitLocation(userId, newLocation, rawSpeed);
          }
        }
      }
    );

    // 7. Heartbeat activo de reposo en primer plano (cada 3 segundos)
    foregroundHeartbeatTimer = setInterval(async () => {
      const elapsed = Date.now() - lastSentTimestamp;
      if (elapsed >= 3000 && currentTrackingUserId) {
        try {
          const freshPos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (freshPos) {
            const rawSpeed = freshPos.coords.speed && freshPos.coords.speed >= 0 ? freshPos.coords.speed * 3.6 : 0;
            await transmitLocation(currentTrackingUserId, freshPos, rawSpeed);
          }
        } catch (hbErr) {
          // Heartbeat silencioso
        }
      }
    }, 3000);

    return true;
  } catch (err) {
    console.error('Error iniciando liveTrackingService:', err);
    return false;
  }
}

/**
 * Detiene el rastreo y marca al usuario como desconectado
 */
export async function stopLiveTracking() {
  stopActivityRecognition();
  globalKalmanFilter.reset();

  if (foregroundHeartbeatTimer) {
    clearInterval(foregroundHeartbeatTimer);
    foregroundHeartbeatTimer = null;
  }

  if (activeBatterySubscription) {
    activeBatterySubscription.remove();
    activeBatterySubscription = null;
  }

  if (activeBatteryLevelSubscription) {
    activeBatteryLevelSubscription.remove();
    activeBatteryLevelSubscription = null;
  }

  if (batteryTelemetryTimer) {
    clearInterval(batteryTelemetryTimer);
    batteryTelemetryTimer = null;
  }

  if (activeLocationSubscription) {
    activeLocationSubscription.remove();
    activeLocationSubscription = null;
  }

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {}

  if (currentTrackingUserId) {
    try {
      await supabase
        .from('ubicaciones_usuarios')
        .update({ en_linea: false, updated_at: new Date().toISOString() })
        .eq('usuario_id', currentTrackingUserId);
    } catch {}
    currentTrackingUserId = null;
  }
}

// Reactivar de forma transparente si la app regresa al primer plano sin spamear diálogos
let appStateDebounceTimer: ReturnType<typeof setTimeout> | null = null;
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', async (nextState) => {
    if (nextState === 'active' && currentTrackingUserId) {
      if (appStateDebounceTimer) clearTimeout(appStateDebounceTimer);
      // Retardo de 1s para permitir que la Activity esté completamente estabilizada en primer plano
      // y evitar la excepción ForegroundServiceStartNotAllowedException de Android 14
      appStateDebounceTimer = setTimeout(async () => {
        try {
          const bgStatus = await Location.getBackgroundPermissionsAsync().catch(() => ({ status: 'denied' }));
          if (bgStatus.status === 'granted') {
            const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
            if (!isRunning && currentTrackingUserId) {
              startLiveTracking(currentTrackingUserId);
            }
          }
        } catch {}
      }, 1000);
    }
  });
}

