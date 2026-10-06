// cabosystems-mobile/lib/notifications.ts
// Servicio para gestión segura de Notificaciones Push de Expo en CaboSystems Mobile
import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import { supabase } from './supabase';

// Detectar si la app se ejecuta dentro de la aplicación cliente "Expo Go"
// En Expo SDK 53+, las notificaciones push remotas en Android fueron removidas de Expo Go
// y requieren un Development Build o APK nativo.
const isExpoGo =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

const isExpoGoAndroid = isExpoGo && Platform.OS === 'android';

let NotificationsModule: typeof import('expo-notifications') | null = null;

// Cargar expo-notifications solo fuera de Expo Go en Android para evitar el crash de warnOfExpoGoPushUsage
if (!isExpoGoAndroid && Platform.OS !== 'web') {
  try {
    // Carga dinámica en tiempo de ejecución
    NotificationsModule = require('expo-notifications');

    if (NotificationsModule && typeof NotificationsModule.setNotificationHandler === 'function') {
      NotificationsModule.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
  } catch (error) {
    console.warn('[Notifications] No se pudo inicializar expo-notifications:', error);
  }
}

/**
 * Registra el dispositivo en Expo Push y sincroniza el token en Supabase
 * En Expo Go (Android) retorna null de manera segura sin crashear la app.
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<string | null> {
  if (!userId) return null;

  if (isExpoGoAndroid) {
    console.log(
      'ℹ️ [Notifications] Notificaciones push remotas no disponibles en Expo Go (Android SDK 53+). Utiliza el APK instalado o un Development Build para recibirlas.'
    );
    return null;
  }

  if (!NotificationsModule) {
    return null;
  }

  try {
    if (!Device.isDevice && Platform.OS === 'web') {
      console.log('Notificaciones push no soportadas en entorno web.');
      return null;
    }

    // 1. Configurar canal de alta prioridad para Android (sonido, vibración y pantalla de bloqueo)
    if (Platform.OS === 'android') {
      await NotificationsModule.setNotificationChannelAsync('chat-messages', {
        name: 'Mensajes de Cuadrilla',
        description: 'Notificaciones en tiempo real para mensajes de grupos de trabajo y obra',
        importance: NotificationsModule.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#f78c26',
        enableVibrate: true,
        showBadge: true,
        lockscreenVisibility: NotificationsModule.AndroidNotificationVisibility.PUBLIC,
      });
    }

    // 2. Verificar o solicitar permisos al usuario
    const { status: existingStatus } = await NotificationsModule.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await NotificationsModule.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permiso para notificaciones push denegado por el usuario.');
      return null;
    }

    // 3. Obtener el projectId de EAS
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId ??
      '51b20f76-64c1-4f2a-a237-7e270229467c';

    // 4. Generar el token oficial de Expo Push
    const tokenResponse = await NotificationsModule.getExpoPushTokenAsync({
      projectId,
    });

    const pushToken = tokenResponse.data;
    if (!pushToken) return null;

    console.log('Expo Push Token obtenido con éxito:', pushToken);

    // 5. Guardar o actualizar en la tabla user_push_tokens de Supabase
    const { error: dbError } = await supabase.from('user_push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: pushToken,
        platform: Platform.OS,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,expo_push_token' }
    );

    if (dbError) {
      console.error('Error guardando push token en Supabase:', dbError);
    }

    return pushToken;
  } catch (error: any) {
    if (
      error?.message?.includes('Firebase Messaging') ||
      error?.message?.includes('Default FirebaseApp is not initialized')
    ) {
      console.warn(
        '⚠️ [Notifications] Para recibir notificaciones push en Android nativo, se requiere colocar el archivo google-services.json de Firebase en cabosystems-mobile/.'
      );
    } else {
      console.error('Error registrando notificaciones push:', error);
    }
    return null;
  }
}

/**
 * Escucha las interacciones cuando el usuario toca la notificación
 * (funciona con pantalla bloqueada, app minimizada o en segundo plano)
 */
export function setupNotificationResponseListener(navigateFn: (path: string) => void) {
  if (isExpoGoAndroid || !NotificationsModule) {
    return () => {};
  }

  try {
    // 1. Manejar caso cuando la app se abrió desde una notificación cerrada
    NotificationsModule.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        if (data?.groupId) {
          navigateFn(`/chat/${data.groupId}`);
        }
      }
    });

    // 2. Manejar eventos mientras la app estaba en segundo plano o minimizada
    const subscription = NotificationsModule.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.groupId) {
        navigateFn(`/chat/${data.groupId}`);
      }
    });

    return () => {
      subscription.remove();
    };
  } catch (err) {
    console.warn('Error configurando listener de respuesta de notificación:', err);
    return () => {};
  }
}
