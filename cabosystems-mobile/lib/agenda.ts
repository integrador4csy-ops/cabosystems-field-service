import type { TaskWithProject } from './api';
import type { TaskStatus } from '@/types/database';

export type AgendaView = 'month' | 'day' | 'week' | 'year' | 'unscheduled';
export type AgendaStatus = 'all' | TaskStatus;
export type AgendaRow = { kind: 'heading'; date: string; count: number } | { kind: 'task'; task: TaskWithProject } | { kind: 'empty'; date: string };

/** Scheduled dates are calendar days, never UTC instants. Keep parity with the web. */
export function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
export function shiftDate(value: string, days: number) {
  const date = parseDateKey(value); date.setDate(date.getDate() + days); return dateKey(date);
}
export function weekDates(value: string) {
  const monday = shiftDate(value, -((parseDateKey(value).getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}
export function shiftMonth(value: string, months: number) {
  const date = parseDateKey(value); const day = date.getDate();
  date.setDate(1); date.setMonth(date.getMonth() + months);
  date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth() + 1, 0, 12).getDate()));
  return dateKey(date);
}
export function monthWorkWeeks(value: string) {
  const date = parseDateKey(value);
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  while ([0, 6].includes(first.getDay())) first.setDate(first.getDate() + 1);
  while ([0, 6].includes(last.getDay())) last.setDate(last.getDate() - 1);
  const weeks: string[][] = [];
  for (let monday = weekDates(dateKey(first))[0]; monday <= weekDates(dateKey(last))[0]; monday = shiftDate(monday, 7)) weeks.push(weekDates(monday).slice(0, 5));
  return weeks;
}
export const normalizeAgendaSearch = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
export function filterAgendaTasks(tasks: TaskWithProject[], query: string, projectId?: string, status: AgendaStatus = 'all') {
  const terms = normalizeAgendaSearch(query.trim()).split(/\s+/).filter(Boolean);
  return tasks.filter((task) => {
    if (projectId && task.proyecto_id !== projectId) return false;
    if (status !== 'all' && task.estatus !== status) return false;
    const text = normalizeAgendaSearch([task.titulo, task.descripcion, task.proyectos?.villa, task.proyectos?.unidad, task.proyectos?.desarrollo, `WO-${task.id.slice(0, 6)}`].filter(Boolean).join(' '));
    return terms.every((term) => text.includes(term));
  });
}
export function periodTasks(tasks: TaskWithProject[], view: AgendaView, date: string) {
  if (view === 'unscheduled') return tasks.filter((task) => !task.fecha_programada);
  if (view === 'year' || view === 'month') {
    const prefix = date.slice(0, view === 'year' ? 4 : 7);
    return tasks.filter(task => task.fecha_programada?.startsWith(`${prefix}-`));
  }
  if (view === 'day') return tasks.filter((task) => task.fecha_programada === date);
  const days = new Set(weekDates(date));
  return tasks.filter((task) => task.fecha_programada && days.has(task.fecha_programada));
}
export function agendaRows(tasks: TaskWithProject[], view: AgendaView, date: string): AgendaRow[] {
  const items = periodTasks(tasks, view, date).slice().sort((a, b) => (a.fecha_programada || '').localeCompare(b.fecha_programada || '') || a.id.localeCompare(b.id));
  if (view === 'day' || view === 'unscheduled') return items.map(task => ({ kind: 'task', task }));
  const groups = new Map<string, TaskWithProject[]>();
  for (const task of items) {
    const day = task.fecha_programada!;
    const group = groups.get(day) || [];
    group.push(task); groups.set(day, group);
  }
  return Array.from(groups, ([day, group]): AgendaRow[] => [
    { kind: 'heading', date: day, count: group.length },
    ...group.map((task): AgendaRow => ({ kind: 'task', task })),
  ]).flat();
}
export function isOverdue(task: Pick<TaskWithProject, 'fecha_programada' | 'estatus'>, today = dateKey(new Date())) {
  return Boolean(task.fecha_programada && task.fecha_programada < today && task.estatus !== 'completada');
}
