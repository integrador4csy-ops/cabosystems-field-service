import { dateKey, parseDateKey, shiftDate, weekDates } from './taskDates';

export type CompanyAgendaView = 'month' | 'week' | 'day';

// Include weekends: company events must remain discoverable on every date.
export function agendaDays(anchor: string, view: CompanyAgendaView): string[] {
  if (view === 'day') return [anchor];
  if (view === 'week') return weekDates(anchor);
  const date = parseDateKey(anchor);
  const first = dateKey(new Date(date.getFullYear(), date.getMonth(), 1, 12));
  const last = dateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0, 12));
  const start = weekDates(first)[0];
  const end = weekDates(last)[6];
  const days: string[] = [];
  for (let day = start; day <= end; day = shiftDate(day, 1)) days.push(day);
  return days;
}
