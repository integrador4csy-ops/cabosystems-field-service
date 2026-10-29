import { dateKey } from './agenda';
import type { CompanyView } from './companyAgenda';
import { AgendaPeriodCache, type AgendaPeriodRange } from './agendaPeriodCache';
import { agendaPeriodWindow, agendaYearWindow } from './agendaPeriodWindow';
import type { AgendaWindowSnapshot } from './agendaWindowStore';
import type { CompanyEvent, AgendaGoogleCalendar } from '../types/companyAgenda';

interface Dependencies {
  preloadYear?: boolean;
  fetchEvents: (from: string, to: string) => Promise<CompanyEvent[]>;
  fetchCalendars: () => Promise<AgendaGoogleCalendar[]>;
  read: (owner: string) => Promise<AgendaWindowSnapshot | null>;
  write: (owner: string, snapshot: AgendaWindowSnapshot) => Promise<void>;
}

export class AgendaWindowManager {
  readonly cache: AgendaPeriodCache;
  anchor = dateKey(new Date()); view: CompanyView = 'month'; ready = false;
  calendars: AgendaGoogleCalendar[] = [];
  private calendarsLoaded = 0;
  private calendarRequest?: Promise<AgendaGoogleCalendar[]>;
  private boot?: Promise<void>;
  private listeners = new Set<() => void>();
  private queue: AgendaPeriodRange[] = [];
  private running = 0;
  private active = true;
  private disposed = false;
  private persistTimer?: ReturnType<typeof setTimeout>;
  private refreshTimer?: ReturnType<typeof setTimeout>;
  private writing: Promise<void> = Promise.resolve();
  private unsubscribe: () => void;
  constructor(readonly owner: string, private deps: Dependencies) {
    this.cache = new AgendaPeriodCache(deps.fetchEvents, Date.now, deps.preloadYear ? 19 : 7);
    this.unsubscribe = this.cache.subscribe(() => { if (!this.disposed) { this.emit(); this.scheduleSave(); } });
  }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() { for (const listener of this.listeners) listener(); }
  private periods() { return this.deps.preloadYear ? agendaYearWindow(this.anchor, this.view) : agendaPeriodWindow(this.anchor, this.view); }
  initialize(): Promise<void> {
    if (this.boot) return this.boot;
    this.boot = this.deps.read(this.owner).catch(() => null).then(saved => {
      if (this.disposed) return;
      if (saved?.owner !== this.owner) saved = null;
      if (saved) { this.anchor = saved.anchor; this.view = saved.view; this.calendars = saved.calendars; this.calendarsLoaded = Math.min(saved.calendarsLoaded, Date.now()); }
      this.cache.setWindow(this.periods());
      if (saved) this.cache.restore(saved.periods);
      this.ready = true; this.emit(); this.warm();
    });
    return this.boot;
  }
  select(anchor: string, view: CompanyView) {
    if (!this.ready || this.disposed || this.anchor === anchor && this.view === view) return;
    this.anchor = anchor; this.view = view;
    this.cache.setWindow(this.periods());
    this.scheduleSave(); this.warm();
  }
  getCalendars(refresh = false): Promise<AgendaGoogleCalendar[]> {
    if (this.calendarRequest) return this.calendarRequest;
    if (!refresh && this.calendarsLoaded && Date.now() - this.calendarsLoaded < 60_000) return Promise.resolve(this.calendars);
    const request = this.deps.fetchCalendars().then(items => {
      if (!this.disposed) { this.calendars = items; this.calendarsLoaded = Date.now(); this.emit(); this.scheduleSave(); }
      return items;
    }).finally(() => { if (this.calendarRequest === request) this.calendarRequest = undefined; });
    this.calendarRequest = request; return request;
  }
  setActive(active: boolean) {
    this.active = active;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (active) this.warm(); else { this.queue = []; void this.flush(); }
  }
  warm() {
    if (!this.ready || !this.owner || !this.active || this.disposed) return;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const nearby = new Set(agendaPeriodWindow(this.anchor, this.view).map(period => `${period.from}:${period.to}`));
    this.queue = this.periods().filter(period => !this.cache.isFresh(period.from, period.to,
      nearby.has(`${period.from}:${period.to}`) ? 60_000 : 15 * 60_000));
    void this.getCalendars().catch(() => {});
    this.pump();
  }
  private pump() {
    if (!this.active || this.disposed) return;
    while (this.running < 2 && this.queue.length) {
      const period = this.queue.shift()!;
      if (this.cache.isFresh(period.from, period.to)) continue;
      this.running++;
      void this.cache.load(period.from, period.to).catch(() => {}).finally(() => { this.running--; this.pump(); });
    }
    if (!this.running && !this.queue.length) {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = setTimeout(() => this.warm(), 60_000);
    }
  }
  invalidate() { this.cache.clear(); this.warm(); }
  private scheduleSave() {
    if (!this.ready || !this.owner) return;
    if (!this.active) { void this.flush(); return; }
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = setTimeout(() => { void this.flush(); }, 250);
  }
  flush(): Promise<void> {
    if (this.persistTimer) clearTimeout(this.persistTimer);
    this.persistTimer = undefined;
    if (!this.ready || !this.owner) return this.writing;
    const snapshot: AgendaWindowSnapshot = { version: 1, owner: this.owner, anchor: this.anchor, view: this.view, periods: this.cache.records(), calendars: this.calendars, calendarsLoaded: this.calendarsLoaded };
    this.writing = this.writing.catch(() => {}).then(() => this.deps.write(this.owner, snapshot)).catch(() => {});
    return this.writing;
  }
  dispose() {
    this.disposed = true; this.active = false; this.queue = [];
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    void this.flush(); this.unsubscribe(); this.cache.clear(); this.listeners.clear();
  }
}
