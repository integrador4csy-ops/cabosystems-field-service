export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'En línea';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes === 1) {
    return 'Hace 1 minuto';
  }
  if (diffInMinutes < 60) {
    return `Hace ${diffInMinutes} minutos`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours === 1) {
    return 'Hace 1 hora';
  }
  if (diffInHours < 24) {
    return `Hace ${diffInHours} horas`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return 'Hace 1 día';
  }
  return `Hace ${diffInDays} días`;
}

export function isWorkerOffline(location: { en_linea: boolean; updated_at: string }): boolean {
  if (!location.en_linea) return true;
  const updateTime = new Date(location.updated_at).getTime();
  const now = Date.now();
  // If no update in 15 minutes (900,000 ms), consider offline / GPS lost
  return now - updateTime > 15 * 60 * 1000;
}
