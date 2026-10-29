import { companyDays, type CompanyView } from './companyAgenda';
import { moveAgendaPeriod } from './agendaGestures';
import type { AgendaPeriodRange } from './agendaPeriodCache';

/** Closest pages first; bounds can produce fewer than seven distinct periods. */
export function agendaPeriodWindow(anchor: string, view: CompanyView): AgendaPeriodRange[] {
  const periods = new Map<string, AgendaPeriodRange>();
  for (const offset of [0, -1, 1, -2, 2, -3, 3]) {
    const date = moveAgendaPeriod(anchor, view, offset);
    if (offset && date === anchor) continue;
    const days = companyDays(date, view);
    const period = { from: days[0], to: days[days.length - 1] };
    periods.set(`${period.from}:${period.to}`, period);
  }
  return [...periods.values()];
}

/** Nearby pages take priority; retain every month of the selected year as data. */
export function agendaYearWindow(anchor: string, view: CompanyView): AgendaPeriodRange[] {
  const periods = new Map(agendaPeriodWindow(anchor, view).map(period => [`${period.from}:${period.to}`, period]));
  for (let month = 1; month <= 12; month++) {
    const days = companyDays(`${anchor.slice(0, 4)}-${String(month).padStart(2, '0')}-15`, 'month');
    const period = { from: days[0], to: days[days.length - 1] };
    periods.set(`${period.from}:${period.to}`, period);
  }
  return [...periods.values()];
}
