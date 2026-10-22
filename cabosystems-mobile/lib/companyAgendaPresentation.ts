import type { CompanyEvent } from '../types/companyAgenda';

export function calendarAppearance(event: CompanyEvent) {
  if (!event.google) return undefined;
  const candidate = event.google.calendarColor;
  const backgroundColor = candidate && /^#[a-f0-9]{6}$/i.test(candidate) ? candidate : '#343e48';
  const channels = [1, 3, 5].map((start) => parseInt(backgroundColor.slice(start, start + 2), 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  const luminance = .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2];
  // Keep white on medium and dark calendar colors, including Google's purple.
  return { backgroundColor, color: luminance <= .30 ? '#FFFFFF' : '#000000' };
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
