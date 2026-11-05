import type { CompanyEvent } from '../types/agenda';

export interface BirthdayProfile {
  id: string;
  nombre: string | null;
  fecha_nacimiento: string | null;
}

export interface MonthlyBirthday {
  id: string;
  name: string;
  day: number;
  date: string;
}

export function birthdaysForMonth(profiles: BirthdayProfile[], anchor: string, locale: string): MonthlyBirthday[] {
  const month = anchor.match(/^\d{4}-(\d{2})-\d{2}$/)?.[1];
  if (!month) return [];
  const birthdays: MonthlyBirthday[] = [];
  for (const profile of profiles) {
    const name = profile.nombre?.trim();
    const match = profile.fecha_nacimiento?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!name || !match || match[2] !== month) continue;
    const year = Number(match[1]); const monthNumber = Number(match[2]); const day = Number(match[3]);
    const valid = new Date(Date.UTC(year, monthNumber - 1, day));
    if (valid.getUTCFullYear() !== year || valid.getUTCMonth() !== monthNumber - 1 || valid.getUTCDate() !== day) continue;
    birthdays.push({ id: profile.id, name, day, date: profile.fecha_nacimiento! });
  }
  return birthdays.sort((a, b) => a.day - b.day || a.name.localeCompare(b.name, locale, { sensitivity: 'base' }));
}

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

/**
 * Extrae el primer nombre y el primer apellido de un nombre completo.
 * Ejemplo:
 * - "Carlos Jesús Fregoso Zapata" -> "Carlos Fregoso"
 * - "Carlos Fregoso" -> "Carlos Fregoso"
 * - "Juan Pérez Gómez" -> "Juan Pérez"
 * - "Carlos" -> "Carlos"
 */
export function formatShortName(fullName?: string | null): string {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${parts[1]}`;
  if (parts.length === 3) return `${parts[0]} ${parts[1]}`;
  return `${parts[0]} ${parts[2]}`;
}

/**
 * Si el nombre del calendario coincide con el correo registrado o tiene formato de correo electrónico,
 * devuelve el primer nombre y primer apellido con el que se registró el usuario.
 */
export function resolveCalendarDisplayName(
  calendar: { id: string; name: string },
  userEmail?: string | null,
  userFullName?: string | null
): string {
  const email = (userEmail || '').trim().toLowerCase();
  const rawName = (calendar.name || '').trim();
  const rawId = (calendar.id || '').trim().toLowerCase();

  const isEmail = /^[^\s@]+@[^\s@]+$/.test(rawName);
  const isMatch = (
    (email && rawName.toLowerCase() === email) ||
    (email && isEmail && (rawId === email || rawName.toLowerCase().includes(email.split('@')[0]))) ||
    isEmail
  );

  if (isMatch) {
    const short = formatShortName(userFullName);
    if (short) return short;
  }
  return calendar.name;
}
