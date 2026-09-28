import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import { Colors } from '@/constants/Theme';

export const USER_DAILY_FORM_URL =
  'https://docs.google.com/forms/d/1l4HhVXEtbGH4lpvcCFGsCe8u8PzjiiScknWEZtmjC5g/viewform?embedded=true';

export const DEFAULT_DAILY_FORM_URL =
  process.env.EXPO_PUBLIC_DAILY_FORM_URL || USER_DAILY_FORM_URL;

/**
 * Normaliza cualquier link de Google Forms a la versión de llenado (/viewform?embedded=true)
 */
export function normalizeGoogleFormUrl(rawUrl?: string | null): string {
  let url = (rawUrl || DEFAULT_DAILY_FORM_URL).trim();
  if (url.includes('/edit')) {
    url = url.split('/edit')[0] + '/viewform';
  }
  if (!url.includes('embedded=true')) {
    url += url.includes('?') ? '&embedded=true' : '?embedded=true';
  }
  return url;
}

/**
 * Detecta de forma 100% segura si el módulo nativo de WebView existe en el binario actual
 * sin disparar la excepción fatal 'RNCWebViewModule could not be found'
 */
export function isNativeWebViewAvailable(): boolean {
  try {
    const turbo = TurboModuleRegistry?.get ? TurboModuleRegistry.get('RNCWebViewModule') : null;
    const legacy = (NativeModules as any)?.RNCWebView || (NativeModules as any)?.RNCWebViewModule;
    return !!(turbo || legacy);
  } catch {
    return false;
  }
}

/**
 * Abre el formulario con el navegador seguro in-app de Expo
 */
export async function openDailyFormInBrowser(url: string): Promise<WebBrowser.WebBrowserResult> {
  return await WebBrowser.openBrowserAsync(url, {
    toolbarColor: Colors.text,
    controlsColor: Colors.primary,
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
  });
}

function getTodayMazatlanDateKey(): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Mazatlan',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // Formato YYYY-MM-DD
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export function formatCompletedTime(isoString?: string | null): string {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mazatlan',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * Obtiene el estado del formulario diario para el usuario en la fecha actual
 */
export async function getDailyFormStatus(userId: string): Promise<{
  completed: boolean;
  completedAt: string | null;
}> {
  if (!userId) return { completed: false, completedAt: null };

  const dateKey = getTodayMazatlanDateKey();
  const storageKey = `daily_form_${userId}_${dateKey}`;

  try {
    const stored = await SecureStore.getItemAsync(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        completed: !!parsed.completed,
        completedAt: parsed.completedAt || null,
      };
    }
  } catch (err) {
    console.warn('Error reading daily form status:', err);
  }

  return { completed: false, completedAt: null };
}

/**
 * Marca el formulario diario como completado para el usuario en la fecha actual
 */
export async function markDailyFormCompleted(userId: string): Promise<string> {
  const dateKey = getTodayMazatlanDateKey();
  const storageKey = `daily_form_${userId}_${dateKey}`;
  const now = new Date().toISOString();

  try {
    await SecureStore.setItemAsync(
      storageKey,
      JSON.stringify({
        completed: true,
        completedAt: now,
      })
    );
  } catch (err) {
    console.warn('Error saving daily form status:', err);
  }

  return now;
}

/**
 * Reinicia el estado del formulario diario (para pruebas / debug)
 */
export async function resetDailyFormStatus(userId: string): Promise<void> {
  const dateKey = getTodayMazatlanDateKey();
  const storageKey = `daily_form_${userId}_${dateKey}`;
  try {
    await SecureStore.deleteItemAsync(storageKey);
  } catch (err) {
    console.warn('Error resetting daily form status:', err);
  }
}

/**
 * Obtiene la URL del formulario de Google normalizada
 */
export function getDailyFormUrl(profile?: { nombre?: string; email?: string } | null): string {
  return normalizeGoogleFormUrl(DEFAULT_DAILY_FORM_URL);
}
