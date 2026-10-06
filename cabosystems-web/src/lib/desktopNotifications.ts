// cabosystems-web/src/lib/desktopNotifications.ts
// Utilidades de Notificaciones de Escritorio (Web Notifications API y Web Audio API)

let originalTitle = document.title || 'CaboSystems · Radar de Flota & Gestión de Campo';

/**
 * Reproduce un sonido sutil de campana/chime sintetizado con Web Audio API
 * No requiere archivos MP3 externos y tiene 0 latencia de red.
 */
export function playNotificationSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // Nota 1 (tono principal)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);

    // Nota 2 (armónico suave)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.08); // D6

    gain2.gain.setValueAtTime(0.1, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.5);
  } catch (err) {
    // Los navegadores bloquean el audio si el usuario aún no interactuó con la pestaña
  }
}

/**
 * Solicita permisos de notificación del navegador (si no han sido otorgados)
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission;
  }
}

/**
 * Muestra una notificación nativa del sistema operativo Windows/Mac/Linux
 * cuando el navegador está minimizado o en otra pestaña.
 */
export function showDesktopNotification(
  title: string,
  body: string,
  onClick?: () => void
): void {
  if (!('Notification' in window)) return;

  if (Notification.permission === 'granted') {
    try {
      const options: any = {
        body,
        icon: '/apple-touch-icon.png',
        badge: '/favicon-32x32.png',
        tag: 'cabosystems-chat-alert',
        renotify: true,
      };
      const notification = new Notification(title, options);

      notification.onclick = () => {
        window.focus();
        if (onClick) onClick();
        notification.close();
      };
    } catch (e) {
      console.warn('Error al mostrar notificación de escritorio:', e);
    }
  }
}

/**
 * Actualiza el título de la pestaña del navegador para alertar al usuario
 */
export function updateTabTitle(unreadCount: number): void {
  if (unreadCount > 0) {
    document.title = `(${unreadCount}) 💬 Nuevo mensaje · CaboSystems`;
  } else {
    document.title = originalTitle;
  }
}

/**
 * Restaura el título original de la pestaña
 */
export function resetTabTitle(): void {
  document.title = originalTitle;
}
