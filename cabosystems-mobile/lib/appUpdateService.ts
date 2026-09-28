import { Platform, AppState, AppStateStatus } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import React, { useState, useEffect, useCallback } from 'react';

export interface AppVersionInfo {
  platform: string;
  latest_version: string;
  min_required_version: string;
  apk_url: string;
  release_notes: string;
  force_update: boolean;
  current_version: string;
  has_update: boolean;
  is_forced: boolean;
}

/**
 * Compara dos cadenas semánticas de versiones (ej. "1.0.1" vs "1.0.0")
 * Retorna:
 *  1 si v1 > v2
 * -1 si v1 < v2
 *  0 si v1 === v2
 */
export function compareSemver(v1: string, v2: string): number {
  if (!v1 || !v2) return 0;
  
  // Limpiar posibles prefijos tipo "v1.0.1"
  const cleanV1 = v1.replace(/^[^\d]*/, '').trim();
  const cleanV2 = v2.replace(/^[^\d]*/, '').trim();
  
  const p1 = cleanV1.split('.').map(Number);
  const p2 = cleanV2.split('.').map(Number);
  const len = Math.max(p1.length, p2.length);

  for (let i = 0; i < len; i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

/**
 * Obtiene la versión actual instalada de la aplicación
 */
export function getCurrentAppVersion(): string {
  return Constants.expoConfig?.version || Constants.nativeAppVersion || '1.0.0';
}

/**
 * Consulta en Supabase si hay una versión más reciente para la plataforma actual
 */
export async function checkAppUpdate(): Promise<AppVersionInfo | null> {
  try {
    const currentVersion = getCurrentAppVersion();
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';

    const { data, error } = await supabase
      .from('app_versions')
      .select('*')
      .eq('platform', platform)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const latestVersion = data.latest_version || currentVersion;
    const minRequiredVersion = data.min_required_version || currentVersion;

    const hasUpdate = compareSemver(latestVersion, currentVersion) > 0;
    const isForced = data.force_update || compareSemver(minRequiredVersion, currentVersion) > 0;

    return {
      platform,
      latest_version: latestVersion,
      min_required_version: minRequiredVersion,
      apk_url: data.apk_url || '',
      release_notes: data.release_notes || '',
      force_update: !!data.force_update,
      current_version: currentVersion,
      has_update: hasUpdate,
      is_forced: isForced,
    };
  } catch (err) {
    console.warn('Error al verificar actualización de la app:', err);
    return null;
  }
}

/**
 * Hook para monitorear actualizaciones de la app al iniciar y al reanudar
 */
export function useAppUpdateCheck() {
  const [updateInfo, setUpdateInfo] = useState<AppVersionInfo | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const performCheck = useCallback(async () => {
    const info = await checkAppUpdate();
    if (info && info.has_update && info.apk_url) {
      setUpdateInfo(info);
      // Si es forzada, no respetar dismissed
      if (info.is_forced || !dismissed) {
        setModalVisible(true);
      }
    }
  }, [dismissed]);

  useEffect(() => {
    performCheck();

    // Re-verificar cuando la app vuelve de segundo plano
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        performCheck();
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [performCheck]);

  const dismissModal = () => {
    if (updateInfo?.is_forced) return; // No permitir descartar si es obligatoria
    setDismissed(true);
    setModalVisible(false);
  };

  return {
    updateInfo,
    modalVisible,
    dismissModal,
    recheck: performCheck,
  };
}
