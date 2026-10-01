import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { supabase } from './supabase';

const BIOMETRICS_ENABLED_KEY = 'csy_biometrics_enabled';
const BIOMETRICS_EMAIL_KEY = 'csy_biometrics_email';
const BIOMETRICS_PASS_KEY = 'csy_biometrics_password';
const BIOMETRICS_REFRESH_TOKEN_KEY = 'csy_biometrics_refresh_token';

export interface BiometricStatus {
  available: boolean;
  enrolled: boolean;
  biometryType: 'fingerprint' | 'facial' | 'iris' | 'generic';
  label: string;
}

export interface StoredBiometricCredentials {
  email: string;
  password?: string;
  refreshToken?: string;
}

/**
 * Verifica si el dispositivo cuenta con hardware biométrico (huella, rostro) y si está configurado.
 */
export async function getBiometricStatus(): Promise<BiometricStatus> {
  try {
    if (Platform.OS === 'web') {
      return { available: false, enrolled: false, biometryType: 'generic', label: 'Biometría' };
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometryType: 'fingerprint' | 'facial' | 'iris' | 'generic' = 'generic';
    let label = 'Huella Dactilar';

    if (Platform.OS === 'ios') {
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometryType = 'facial';
        label = 'Face ID';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometryType = 'fingerprint';
        label = 'Touch ID';
      }
    } else {
      // En Android: La huella dactilar siempre tiene prioridad principal sobre la cámara 2D
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        biometryType = 'fingerprint';
        label = 'Huella Dactilar';
      } else if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        biometryType = 'facial';
        label = 'Reconocimiento Facial';
      } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
        biometryType = 'iris';
        label = 'Escáner de Iris';
      }
    }

    return {
      available: hasHardware,
      enrolled: isEnrolled,
      biometryType,
      label,
    };
  } catch (error) {
    console.warn('Error checking biometric status:', error);
    return { available: false, enrolled: false, biometryType: 'generic', label: 'Huella Dactilar' };
  }
}

/**
 * Verifica si el usuario tiene activado el acceso biométrico en este dispositivo.
 */
export async function isBiometricAuthEnabled(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') return false;
    const enabled = await SecureStore.getItemAsync(BIOMETRICS_ENABLED_KEY);
    return enabled === 'true';
  } catch {
    return false;
  }
}

/**
 * Activa o desactiva la bandera biométrica sin borrar las credenciales seguras.
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  try {
    if (Platform.OS === 'web') return;
    if (enabled) {
      await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, 'true');
    } else {
      await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, 'false');
    }
  } catch (error) {
    console.warn('Error setting biometric enabled state:', error);
  }
}

/**
 * Obtiene la contraseña almacenada previamente en el Keystore/Keychain de forma segura.
 */
export async function getStoredPassword(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return null;
    return await SecureStore.getItemAsync(BIOMETRICS_PASS_KEY);
  } catch {
    return null;
  }
}

/**
 * Guarda o elimina las credenciales o tokens seguros para el inicio de sesión biométrico.
 */
export async function setBiometricCredentials(
  email: string | null,
  password: string | null,
  enabled: boolean,
  refreshToken?: string | null
): Promise<void> {
  try {
    if (Platform.OS === 'web') return;

    if (enabled && email) {
      await SecureStore.setItemAsync(BIOMETRICS_ENABLED_KEY, 'true');
      await SecureStore.setItemAsync(BIOMETRICS_EMAIL_KEY, email.trim().toLowerCase());

      if (password) {
        await SecureStore.setItemAsync(BIOMETRICS_PASS_KEY, password);
      }
      if (refreshToken) {
        await SecureStore.setItemAsync(BIOMETRICS_REFRESH_TOKEN_KEY, refreshToken);
      }
    } else {
      await SecureStore.deleteItemAsync(BIOMETRICS_ENABLED_KEY);
      await SecureStore.deleteItemAsync(BIOMETRICS_EMAIL_KEY);
      await SecureStore.deleteItemAsync(BIOMETRICS_PASS_KEY);
      await SecureStore.deleteItemAsync(BIOMETRICS_REFRESH_TOKEN_KEY);
    }
  } catch (error) {
    console.warn('Error saving biometric credentials:', error);
  }
}

/**
 * Obtiene las credenciales o tokens seguros almacenados para el inicio de sesión.
 */
export async function getBiometricCredentials(requireEnabled = true): Promise<StoredBiometricCredentials | null> {
  try {
    if (Platform.OS === 'web') return null;
    if (requireEnabled) {
      const isEnabled = await isBiometricAuthEnabled();
      if (!isEnabled) return null;
    }

    const email = await SecureStore.getItemAsync(BIOMETRICS_EMAIL_KEY);
    const password = await SecureStore.getItemAsync(BIOMETRICS_PASS_KEY);
    const refreshToken = await SecureStore.getItemAsync(BIOMETRICS_REFRESH_TOKEN_KEY);

    if (email && (password || refreshToken)) {
      return {
        email,
        password: password || undefined,
        refreshToken: refreshToken || undefined,
      };
    }
    return null;
  } catch (error) {
    console.warn('Error reading biometric credentials:', error);
    return null;
  }
}

/**
 * Dispara el sensor biométrico del dispositivo (huella/FaceID).
 */
export async function authenticateWithBiometrics(
  promptMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (Platform.OS === 'web') {
      return { success: false, error: 'La biometría no está disponible en la web.' };
    }

    const { available, enrolled, label } = await getBiometricStatus();
    if (!available || !enrolled) {
      return {
        success: false,
        error: `No se encontró ${label} configurada en este dispositivo.`,
      };
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: promptMessage || `Acceder a CaboSystems con ${label}`,
      fallbackLabel: 'Ingresar con contraseña',
      cancelLabel: 'Cancelar',
      disableDeviceFallback: false,
    });

    if (result.success) {
      return { success: true };
    }

    return {
      success: false,
      error: result.error === 'user_cancel' ? 'Autenticación cancelada.' : 'No se pudo verificar la huella.',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || 'Error al autenticar mediante biometría.',
    };
  }
}

/**
 * Ejecuta el inicio de sesión biométrico completo usando credenciales o refresh token.
 */
export async function performBiometricLogin(
  signInWithEmail: (e: string, p: string) => Promise<{ error: Error | null }>
): Promise<{ success: boolean; error?: string }> {
  const creds = await getBiometricCredentials();
  if (!creds) {
    return { success: false, error: 'No hay credenciales registradas para inicio biométrico.' };
  }

  const { label } = await getBiometricStatus();
  const auth = await authenticateWithBiometrics(`Acceder a CaboSystems con ${label}`);
  if (!auth.success) {
    return { success: false, error: auth.error };
  }

  // 1. Si tenemos contraseña guardada, autenticar directamente
  if (creds.password) {
    const { error } = await signInWithEmail(creds.email, creds.password);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  // 2. Si tenemos refresh token, refrescar la sesión en Supabase
  if (creds.refreshToken) {
    try {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: creds.refreshToken,
      });

      if (error || !data.session) {
        return {
          success: false,
          error: 'La sesión biométrica expiró. Por favor ingresa con tu contraseña una vez para renovarla.',
        };
      }

      // Guardar el nuevo refresh token actualizado
      await setBiometricCredentials(
        creds.email,
        null,
        true,
        data.session.refresh_token
      );

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al restaurar sesión biométrica.' };
    }
  }

  return { success: false, error: 'Credenciales incompletas para acceso biométrico.' };
}
