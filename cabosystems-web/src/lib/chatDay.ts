import { useEffect, useState } from 'react';

export function chatDayKey(value: string | Date): string {
  const date = new Date(value);
  return [date.getFullYear(), date.getMonth(), date.getDate()].join('-');
}

export function chatDayLabel(value: string, language: string, now = new Date()): string {
  const english = language.startsWith('en');
  if (chatDayKey(value) === chatDayKey(now)) return english ? 'Today' : 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (chatDayKey(value) === chatDayKey(yesterday)) return english ? 'Yesterday' : 'Ayer';
  return new Date(value).toLocaleDateString(english ? 'en-US' : 'es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function useChatDayClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      const current = new Date();
      setNow(current);
      const midnight = new Date(current);
      midnight.setHours(24, 0, 0, 50);
      timer = setTimeout(schedule, midnight.getTime() - current.getTime());
    }
    schedule();
    return () => clearTimeout(timer);
  }, []);
  return now;
}
