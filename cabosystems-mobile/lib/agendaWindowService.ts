import { AppState } from 'react-native';
import { AgendaWindowManager } from './agendaWindowManager';
import { getCompanyEvents, getGoogleCalendars } from './companyAgendaApi';
import { readAgendaWindow, writeAgendaWindow } from './agendaWindowStore';
import { companyDays } from './companyAgenda';

const instances = new Map<string, { manager: AgendaWindowManager; release?: ReturnType<typeof setTimeout> }>();
export function getAgendaWindow(owner: string): AgendaWindowManager {
  let entry = instances.get(owner);
  if (!entry) {
    entry = { manager: new AgendaWindowManager(owner, { preloadYear: true, fetchEvents: getCompanyEvents, fetchCalendars: getGoogleCalendars, read: readAgendaWindow, write: writeAgendaWindow }) };
    instances.set(owner, entry);
  }
  return entry.manager;
}
/** Start during sign-in, even before the Schedule tab has been opened. */
export function startAgendaWindow(owner: string, startImmediately = true) {
  const manager = getAgendaWindow(owner);
  const entry = instances.get(owner)!;
  if (entry.release) clearTimeout(entry.release);
  manager.setActive(AppState.currentState === 'active' && (startImmediately || manager.ready));
  if (startImmediately) void manager.initialize();
  const subscription = AppState.addEventListener('change', state => manager.setActive(state === 'active' && (startImmediately || manager.ready)));
  return () => {
    subscription.remove(); manager.setActive(false);
    // React Strict Mode immediately acquires the same account again.
    entry.release = setTimeout(() => { manager.dispose(); if (instances.get(owner) === entry) instances.delete(owner); }, 0);
  };
}

/** Preload all agenda data (window, current period events, calendars, colors) into cache immediately. */
export async function preloadAgendaData(owner: string): Promise<void> {
  if (!owner) return;
  try {
    const manager = getAgendaWindow(owner);
    manager.setActive(true);
    await manager.initialize();
    const days = companyDays(manager.anchor, manager.view);
    const from = days[0];
    const to = days[days.length - 1];
    let colorTask: Promise<unknown> = Promise.resolve();
    try {
      const { getCalendarColors } = require('./calendarColorPreferences');
      colorTask = getCalendarColors(owner);
    } catch {}
    await Promise.allSettled([
      manager.cache.load(from, to),
      manager.getCalendars(),
      colorTask,
    ]);
  } catch (error) {
    console.warn('Preload agenda data failed:', error);
  }
}

