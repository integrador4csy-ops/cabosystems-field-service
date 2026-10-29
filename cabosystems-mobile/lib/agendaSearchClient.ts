import { assertSearchActive, searchDelay, searchCompanyAgenda, prepareCompanyAgendaSearch, getAgendaSearchDates } from './agendaSearchApi';
import { matchesAgendaSearch, normalizeAgendaQuery, sortAgendaSearch, type AgendaSearchHit, type AgendaSearchResponse } from './agendaSearch';

/** Owned by one signed-in calendar screen, never shared across accounts. */
export class AgendaSearchClient {
  private cache = new Map<string, { at: number; day: string; query: string; data: AgendaSearchResponse }>();
  private dates = new Map<string, { at: number; nextDate: string | null }>();
  private preparing: Promise<unknown> | undefined;
  private preparation: AbortController | undefined;
  private preparedAt = 0;
  private delayMs: number;
  constructor(delayMs = 100) { this.delayMs = delayMs; }
  private withDates(data: AgendaSearchResponse, today: string): AgendaSearchResponse {
    return { ...data, hits: data.hits.map(hit => {
      if (!hit.nextDatePending) return hit;
      const entry = this.dates.get(`${hit.event.id}/${hit.event.google?.etag}/${today}`);
      return entry && Date.now() - entry.at < 30_000 ? { ...hit, nextDate: entry.nextDate, nextDatePending: false } : hit;
    }) };
  }
  prepare(force = false) {
    if (this.preparing) return this.preparing;
    if (!force && Date.now() - this.preparedAt < 20_000) return Promise.resolve();
    const controller = new AbortController(); this.preparation = controller;
    const pending = prepareCompanyAgendaSearch(controller.signal).then(result => {
      if (!controller.signal.aborted && result.ready) this.preparedAt = Date.now();
    }).finally(() => { if (this.preparing === pending) this.preparing = undefined; });
    this.preparing = pending; return pending;
  }
  clear() {
    this.preparation?.abort(); this.preparing = undefined; this.preparedAt = 0;
    this.cache.clear(); this.dates.clear();
  }
  async search(query: string, today: string, signal: AbortSignal, onUpdate: (data: AgendaSearchResponse) => void) {
    assertSearchActive(signal);
    const normalized = normalizeAgendaQuery(query).trim();
    const cached = [...this.cache.values()].reverse().find(entry => entry.day === today && Date.now() - entry.at < 5000 && normalized.startsWith(entry.query));
    if (cached) {
      await Promise.resolve(); assertSearchActive(signal);
      onUpdate(this.withDates({ ...cached.data, hits: sortAgendaSearch(cached.data.hits.filter(hit => matchesAgendaSearch(hit.event, query)), today, query), pending: true }, today));
    }
    await searchDelay(this.delayMs, signal);
    let lastServerData: AgendaSearchResponse | undefined;
    try {
      const data = this.withDates(await searchCompanyAgenda(query, today, { signal, onUpdate: data => {
        lastServerData = data;
        const provisional = (cached?.data.hits || []).filter(hit => matchesAgendaSearch(hit.event, query) && (hit.event.google ? data.googlePending : data.localPending));
        const merged = [...new Map([...provisional, ...data.hits].map(hit => [hit.event.id, hit])).values()];
        onUpdate(this.withDates({ ...data, hits: sortAgendaSearch(merged, today, query) }, today));
      }, prepare: () => this.prepare(true) }), today);
      assertSearchActive(signal);
      this.cache.delete(normalized); this.cache.set(normalized, { at: Date.now(), day: today, query: normalized, data });
      let size = [...this.cache.values()].reduce((sum, entry) => sum + entry.data.hits.length, 0);
      while (this.cache.size > 8 || size > 5000) { const key = this.cache.keys().next().value!; size -= this.cache.get(key)!.data.hits.length; this.cache.delete(key); }
      return data;
    } catch (error) { if (!signal.aborted) { this.cache.clear(); if (lastServerData) onUpdate(lastServerData); } throw error; }
  }
  async completeDates(hits: AgendaSearchHit[], today: string, signal: AbortSignal) {
    const result: { id: string; nextDate: string | null }[] = [];
    const missing = [];
    for (const hit of hits.filter(hit => hit.nextDatePending)) {
      const key = `${hit.event.id}/${hit.event.google?.etag}/${today}`;
      const cached = this.dates.get(key);
      if (cached && Date.now() - cached.at < 30_000) result.push({ id: hit.event.id, nextDate: cached.nextDate });
      else missing.push({ hit, key });
    }
    for (let offset = 0; offset < missing.length; offset += 50) {
      const batch = missing.slice(offset, offset + 50);
      const dates = await getAgendaSearchDates(batch.map(item => item.hit.event.id), today, signal);
      assertSearchActive(signal);
      for (const date of dates) {
        const item = batch.find(item => item.hit.event.id === date.id);
        if (!item) continue;
        this.dates.set(item.key, { at: Date.now(), nextDate: date.nextDate }); result.push(date);
      }
      while (this.dates.size > 500) this.dates.delete(this.dates.keys().next().value!);
    }
    return result;
  }
}
