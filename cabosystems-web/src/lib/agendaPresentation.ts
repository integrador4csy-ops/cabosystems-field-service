import type { CompanyEvent } from '../types/agenda';

export function calendarAppearance(event: CompanyEvent, personalColor?: string) {
  if (!event.google && !personalColor) return undefined;
  const candidate = personalColor || event.google?.calendarColor;
  const backgroundColor = candidate && /^#[a-f0-9]{6}$/i.test(candidate) ? candidate : '#343e48';
  return { backgroundColor, color: calendarTextColor(backgroundColor) };
}

/** Product preference: dark text only on very light backgrounds. */
export function calendarTextColor(backgroundColor: string): '#FFFFFF' | '#000000' {
  const hex = /^#[a-f0-9]{6}$/i.test(backgroundColor) ? backgroundColor : '#343e48';
  const channels = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  return luminance >= .60 ? '#000000' : '#FFFFFF';
}

export function eventSchedule(event: CompanyEvent, locale: string) {
  if (!event.hora) return locale.startsWith('en') ? 'All day' : 'Todo el día';
  const format = (date: string, time: string) => new Date(`${date}T${time}`).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' });
  const from = format(event.fecha, event.hora);
  const end = event.google?.endTime || event.hora_fin;
  if (!end) return `${from} · ${locale.startsWith('en') ? 'End not set' : 'Fin sin definir'}`;
  const endDate = event.google?.endDate || event.fecha;
  const prefix = endDate !== event.fecha ? `${new Date(`${endDate}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}, ` : '';
  return `${from} – ${prefix}${format(endDate, end)}`;
}
