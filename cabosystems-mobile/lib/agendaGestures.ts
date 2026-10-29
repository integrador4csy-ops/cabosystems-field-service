import { shiftDate, shiftMonth } from './agenda';
import type { CompanyView } from './companyAgenda';

/** Ignore taps and vertical/diagonal drags; a left swipe advances the period. */
export function agendaSwipeDirection(dx: number, dy: number, velocityX = 0): -1 | 0 | 1 {
  'worklet';
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(velocityX)) return 0;
  const distance = Math.abs(dx);
  if (Math.abs(dy) > 40 || distance < Math.abs(dy) * 1.5) return 0;
  const fastSwipe = distance >= 28 && Math.abs(velocityX) >= 800 && dx * velocityX > 0;
  if (distance < 64 && !fastSwipe) return 0;
  return dx < 0 ? 1 : -1;
}

export function moveAgendaPeriod(anchor: string, view: CompanyView, direction: number): string {
  const next = view === 'month' ? shiftMonth(anchor, direction) : shiftDate(anchor, direction * (view === 'week' ? 7 : 1));
  return /^\d{4}-\d{2}-\d{2}$/.test(next) && next >= '1900-01-01' && next <= '9999-12-31' ? next : anchor;
}
