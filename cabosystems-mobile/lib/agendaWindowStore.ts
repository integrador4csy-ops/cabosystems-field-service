import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { AgendaPeriodRecord } from './agendaPeriodCache';
import type { CompanyView } from './companyAgenda';
import type { AgendaGoogleCalendar } from '../types/companyAgenda';
import { agendaTextEvent, agendaTextCalendar } from './agendaTextCache';

export interface AgendaWindowSnapshot {
  version: 1; owner: string; anchor: string; view: CompanyView;
  periods: AgendaPeriodRecord[]; calendars: AgendaGoogleCalendar[]; calendarsLoaded: number;
}
const isoDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '9999-12-31' && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
function file(owner: string) { const root = FileSystem.documentDirectory || FileSystem.cacheDirectory; return root ? `${root}agenda-window-${encodeURIComponent(owner)}.json` : null; }
const storageKey = (owner: string) => `agenda-window:${owner}`;
const writes = new Map<string, Promise<void>>();

export async function readAgendaWindow(owner: string): Promise<AgendaWindowSnapshot | null> {
  if (!owner) return null;
  try {
    await writes.get(owner)?.catch(() => {});
    const path = file(owner);
    const raw = Platform.OS === 'web' ? localStorage.getItem(storageKey(owner)) : path ? await FileSystem.readAsStringAsync(path) : null;
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved.version !== 1 || saved.owner !== owner || !isoDate(saved.anchor) || !['month', 'week', 'day'].includes(saved.view) || !Array.isArray(saved.periods) || saved.periods.length > 19) return null;
    const periods = saved.periods.filter((entry: AgendaPeriodRecord) => entry && isoDate(entry.from) && isoDate(entry.to) && entry.from <= entry.to && Number.isFinite(entry.loaded) && entry.loaded >= 0 && Array.isArray(entry.items) && entry.items.every(item => item && typeof item.id === 'string' && typeof item.titulo === 'string' && isoDate(item.fecha) && (!item.occurrence_date || isoDate(item.occurrence_date))));
    const calendars = Array.isArray(saved.calendars) ? saved.calendars.filter((item: AgendaGoogleCalendar) => item && typeof item.id === 'string' && typeof item.name === 'string') : [];
    return { version: 1, owner, anchor: saved.anchor, view: saved.view,
      periods: periods.map((period: AgendaPeriodRecord) => ({ from: period.from, to: period.to, loaded: period.loaded, items: period.items.map(agendaTextEvent) })),
      calendars: calendars.map(agendaTextCalendar), calendarsLoaded: Number.isFinite(saved.calendarsLoaded) ? saved.calendarsLoaded : 0 };
  } catch { return null; }
}

export async function writeAgendaWindow(owner: string, snapshot: AgendaWindowSnapshot): Promise<void> {
  if (!owner || snapshot.owner !== owner) return;
  const value = JSON.stringify({ version: 1, owner, anchor: snapshot.anchor, view: snapshot.view,
    periods: snapshot.periods.map(period => ({ from: period.from, to: period.to, loaded: period.loaded, items: period.items.map(agendaTextEvent) })),
    calendars: snapshot.calendars.map(agendaTextCalendar), calendarsLoaded: snapshot.calendarsLoaded });
  const request = (writes.get(owner) || Promise.resolve()).catch(() => {}).then(async () => {
    if (Platform.OS === 'web') localStorage.setItem(storageKey(owner), value);
    else { const path = file(owner); if (path) await FileSystem.writeAsStringAsync(path, value); }
  });
  writes.set(owner, request);
  try { await request; } finally { if (writes.get(owner) === request) writes.delete(owner); }
}
