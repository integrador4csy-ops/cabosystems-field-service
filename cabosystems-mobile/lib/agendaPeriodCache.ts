import type { CompanyEvent } from '../types/companyAgenda';

export interface AgendaPeriodRange { from: string; to: string }
export interface AgendaPeriodRecord extends AgendaPeriodRange { items: CompanyEvent[]; loaded: number }

/** One instance per account; keep only a small window around the visible page. */
export class AgendaPeriodCache {
  private entries = new Map<string, { items: CompanyEvent[]; loaded: number }>();
  private derived = new Map<string, { source: CompanyEvent[]; items: CompanyEvent[] }>();
  private pending = new Map<string, Promise<CompanyEvent[]>>();
  private epoch = 0;
  private window: Set<string> | null = null;
  private listeners = new Set<() => void>();
  constructor(private fetch: (from: string, to: string) => Promise<CompanyEvent[]>, private now = Date.now, private capacity = 7) {}
  read(from: string, to: string): CompanyEvent[] | null {
    const key = `${from}:${to}`;
    const exact = this.entries.get(key);
    if (exact) return exact.items;
    // Serve week/day immediately, before the view-selection effect runs.
    const covering = this.records().find(entry => entry.from <= from && entry.to >= to);
    if (!covering) return null;
    const cached = this.derived.get(key);
    if (cached?.source === covering.items) return cached.items;
    const items = covering.items.filter(event => { const date = event.occurrence_date || event.fecha; return date >= from && date <= to; });
    this.derived.set(key, { source: covering.items, items });
    while (this.derived.size > 7) this.derived.delete(this.derived.keys().next().value!);
    return items;
  }
  isFresh(from: string, to: string, maxAge = 60_000) { const entry = this.entries.get(`${from}:${to}`); return Boolean(entry && this.now() - entry.loaded < maxAge); }
  subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private emit() { for (const listener of this.listeners) listener(); }
  setWindow(periods: AgendaPeriodRange[]) {
    // A cached month already contains its weeks/days. Reuse that data before
    // pruning the old view rather than fetching it again during a view switch.
    this.derived.clear();
    const previous = this.records();
    this.window = new Set(periods.map(period => `${period.from}:${period.to}`));
    for (const period of periods) {
      const key = `${period.from}:${period.to}`;
      if (this.entries.has(key)) continue;
      const covering = previous.find(entry => entry.from <= period.from && entry.to >= period.to);
      if (covering) this.entries.set(key, { loaded: covering.loaded, items: covering.items.filter(event => { const date = event.occurrence_date || event.fecha; return date >= period.from && date <= period.to; }) });
    }
    for (const key of this.entries.keys()) if (!this.window.has(key)) this.entries.delete(key);
  }
  records(): AgendaPeriodRecord[] { return [...this.entries].map(([key, entry]) => { const [from, to] = key.split(':'); return { from, to, ...entry }; }); }
  restore(records: AgendaPeriodRecord[]) {
    for (const record of records.slice(0, this.capacity)) {
      const key = `${record.from}:${record.to}`;
      if (this.window && !this.window.has(key)) continue;
      if (!this.entries.has(key) || this.entries.get(key)!.loaded < record.loaded) this.entries.set(key, { items: record.items, loaded: Math.min(record.loaded, this.now()) });
    }
    this.emit();
  }
  load(from: string, to: string, refresh = false): Promise<CompanyEvent[]> {
    const key = `${from}:${to}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const cached = this.entries.get(key);
    if (!refresh && cached && this.now() - cached.loaded < 60_000) return Promise.resolve(cached.items);
    const epoch = this.epoch;
    const request = Promise.resolve().then(() => this.fetch(from, to)).then(items => {
      if (epoch === this.epoch && (!this.window || this.window.has(key))) {
        this.entries.delete(key); this.entries.set(key, { items, loaded: this.now() });
        while (this.entries.size > this.capacity) this.entries.delete(this.entries.keys().next().value!);
        this.emit();
      }
      return items;
    }).finally(() => { if (this.pending.get(key) === request) this.pending.delete(key); });
    this.pending.set(key, request);
    return request;
  }
  clear() { this.derived.clear(); this.epoch++; this.entries.clear(); this.pending.clear(); this.emit(); }
}
