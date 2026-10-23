import { SessionQueryCache } from './sessionQueryCache';
import { AgendaRangeCache } from './agendaRangeCache';
import type { CompanyEvent } from '../types/agenda';

export class SectionResources {
  queries = new SessionQueryCache();
  private agenda: AgendaRangeCache | undefined;
  private resolveReady!: () => void;
  ready = new Promise<void>(resolve => { this.resolveReady = resolve; });
  markReady = () => this.resolveReady();
  private queue = Promise.resolve();
  private disposed = false;
  private owners = 0;
  retain() {
    this.owners++;
    return () => { this.owners--; queueMicrotask(() => { if (this.owners === 0) this.clear(); }); };
  }
  private intent = '';
  setIntent(id: string) { this.intent = id; }
  getAgenda(loader: (from: string, to: string) => Promise<CompanyEvent[]>) {
    return this.agenda ??= new AgendaRangeCache(loader);
  }
  prefetch(loader: () => Promise<unknown>, intent?: string) {
    this.queue = this.queue.then(async () => {
      await this.ready;
      if (this.disposed || (intent && intent !== this.intent) || this.queries.busy || !canSpeculate()) return;
      await loader();
    }).catch(() => { /* Speculation must never block navigation or show an error. */ });
    return this.queue;
  }
  clear() { this.disposed = true; this.markReady(); this.queries.clear(); this.agenda?.clear(); }
}

export function canSpeculate() {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return document.visibilityState === 'visible' && navigator.onLine !== false && !connection?.saveData && !['slow-2g', '2g'].includes(connection?.effectiveType || '');
}
