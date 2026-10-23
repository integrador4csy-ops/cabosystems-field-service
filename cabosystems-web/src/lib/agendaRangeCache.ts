import type { CompanyEvent } from '../types/agenda';

interface Entry { from: string; to: string; events: CompanyEvent[]; updated: number }

/** Session memory only. Covering ranges also serve week and day views. */
export class AgendaRangeCache {
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Promise<CompanyEvent[]>>();
  private generation = 0;
  private visibleKey = '';
  private fetchEvents: (from: string, to: string) => Promise<CompanyEvent[]>;
  private now: () => number;

  constructor(fetchEvents: (from: string, to: string) => Promise<CompanyEvent[]>, now = Date.now) {
    this.fetchEvents = fetchEvents;
    this.now = now;
  }

  read(from: string, to: string) {
    const entry = [...this.entries.values()].reverse().find(item => item.from <= from && item.to >= to);
    if (!entry) return null;
    return {
      events: entry.events.filter(event => (event.occurrence_date || event.fecha) >= from && (event.occurrence_date || event.fecha) <= to),
      fresh: this.now() - entry.updated < 120_000,
    };
  }

  load(from: string, to: string): Promise<CompanyEvent[]> {
    const cached = this.read(from, to);
    if (cached?.fresh) {
      const match = [...this.entries].reverse().find(([, entry]) => entry.from <= from && entry.to >= to);
      if (match) { this.entries.delete(match[0]); this.entries.set(match[0], match[1]); }
      return Promise.resolve(cached.events);
    }
    const key = `${from}/${to}`;
    const existing = this.pending.get(key);
    if (existing) return existing;
    const generation = this.generation;
    const request = this.fetchEvents(from, to).then(events => {
      if (generation === this.generation && events.length <= 20_000) {
        this.entries.delete(key);
        this.entries.set(key, { from, to, events, updated: this.now() });
        // Bound both the number of months and the number of event occurrences.
        while (this.entries.size > 5 || [...this.entries.values()].reduce((sum, entry) => sum + entry.events.length, 0) > 20_000) {
          const oldest = [...this.entries.keys()].find(entryKey => entryKey !== this.visibleKey);
          if (!oldest) break;
          this.entries.delete(oldest);
        }
      }
      return events;
    }).finally(() => { if (this.pending.get(key) === request) this.pending.delete(key); });
    this.pending.set(key, request);
    return request;
  }

  clear() {
    this.generation++;
    this.entries.clear();
    this.pending.clear();
  }

  setVisibleRange(from: string, to: string) { this.visibleKey = `${from}/${to}`; }
}
