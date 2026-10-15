import type { Tarea } from '../types/projects';

/** Calendar dates stay local: ISO UTC conversion can move a task to another day. */
export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function shiftDate(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function weekDates(value: string): string[] {
  const date = parseDateKey(value);
  const mondayOffset = (date.getDay() + 6) % 7;
  const monday = shiftDate(value, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}

export function shiftMonth(value: string, months: number): string {
  const date = parseDateKey(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate();
  date.setDate(Math.min(day, lastDay));
  return dateKey(date);
}

/** Calendar rows contain working days only, including adjacent dates for alignment. */
export function monthWorkWeeks(value: string): string[][] {
  const date = parseDateKey(value);
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  while (first.getDay() === 0 || first.getDay() === 6) first.setDate(first.getDate() + 1);
  while (last.getDay() === 0 || last.getDay() === 6) last.setDate(last.getDate() - 1);
  const finalMonday = weekDates(dateKey(last))[0];
  const weeks: string[][] = [];
  for (let monday = weekDates(dateKey(first))[0]; monday <= finalMonday; monday = shiftDate(monday, 7)) {
    weeks.push(weekDates(monday).slice(0, 5));
  }
  return weeks;
}

export function isOverdue(task: Tarea, today = dateKey(new Date())): boolean {
  return Boolean(task.fecha_programada && task.fecha_programada < today && task.estatus !== 'completada');
}
