interface Entry { value: unknown; updated: number }

/** Per-session RAM cache: deduplicate reads, retain stale data and bound memory. */
export class SessionQueryCache {
  private entries = new Map<string, Entry>();
  private pending = new Map<string, Promise<unknown>>();
  private generation = 0;
  private now: () => number;
  constructor(now = Date.now) { this.now = now; }
  get busy() { return this.pending.size > 0; }
  read<T>(key: string): T | undefined { return this.entries.get(key)?.value as T | undefined; }
  load<T>(key: string, loader: () => Promise<T>, force = false, ttl = 30_000): Promise<T> {
    const pending = this.pending.get(key);
    if (!force && pending) return pending as Promise<T>;
    const cached = this.entries.get(key);
    if (!force && cached && this.now() - cached.updated < ttl) return Promise.resolve(cached.value as T);
    const generation = this.generation;
    const request = Promise.resolve().then(loader).then(value => {
      // A prefetch started before a mutation must not overwrite its newer refresh.
      if (generation === this.generation && this.pending.get(key) !== request) {
        return (this.pending.get(key) as Promise<T> | undefined) ?? (this.entries.get(key)?.value as T | undefined) ?? value;
      }
      if (generation === this.generation && this.pending.get(key) === request) {
        this.entries.delete(key);
        this.entries.set(key, { value, updated: this.now() });
        while (this.entries.size > 20) this.entries.delete(this.entries.keys().next().value!);
      }
      return value;
    }).finally(() => { if (this.pending.get(key) === request) this.pending.delete(key); });
    this.pending.set(key, request);
    return request;
  }
  invalidate(key: string) { this.entries.delete(key); this.pending.delete(key); }
  clear() { this.generation++; this.entries.clear(); this.pending.clear(); }
}
