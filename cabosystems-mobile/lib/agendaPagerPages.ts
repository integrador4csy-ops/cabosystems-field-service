import { moveAgendaPeriod } from './agendaGestures';
import type { CompanyView } from './companyAgenda';

/** Stable page identities; selecting another period never shifts this array. */
export function agendaPagerPages(anchor: string, view: CompanyView, radius = 12) {
  const pages = new Map<string, { anchor: string; position: number }>();
  for (let position = -radius; position <= radius; position++) {
    const day = moveAgendaPeriod(anchor, view, position);
    if (position && day === anchor) continue;
    if (!pages.has(day)) pages.set(day, { anchor: day, position });
  }
  return [...pages.values()];
}
