import { translateUiText } from './uiTranslations';

export function formatRelativeTime(dateString: string, language: 'es' | 'en' = 'es'): string {
  const t = (text: string, params?: Record<string, number>) => translateUiText(text, language, params);
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return t('En línea');
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes === 1) {
    return t('Hace 1 minuto');
  }
  if (diffInMinutes < 60) {
    return t('Hace {value0} minutos', { value0: diffInMinutes });
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) {
    return t('Hace 1 hora');
  }
  if (diffInHours < 24) {
    return t('Hace {value0} horas', { value0: diffInHours });
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return t('Hace 1 día');
  }
  return t('Hace {value0} días', { value0: diffInDays });
}

export function isWorkerOffline(location: { en_linea: boolean; updated_at: string }): boolean {
  if (!location.en_linea) return true;
  const updateTime = new Date(location.updated_at).getTime();
  const now = Date.now();
  // If no update in 15 minutes (900,000 ms), consider offline / GPS lost
  return now - updateTime > 15 * 60 * 1000;
}
