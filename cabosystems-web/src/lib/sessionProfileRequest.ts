/** Deduplicate profile reads and reject completions belonging to an old session. */
export class SessionProfileRequest<T> {
  private userId: string | null = null;
  private version = 0;
  private pending: Promise<T | null> | undefined;

  select(userId: string | null) {
    if (this.userId === userId) return;
    this.reset();
    this.userId = userId;
  }

  reset() {
    this.version++;
    this.userId = null;
    this.pending = undefined;
  }

  load(userId: string, loader: () => Promise<T>, publish: (value: T) => void): Promise<T | null> {
    if (this.userId !== userId) return Promise.resolve(null);
    if (this.pending) return this.pending;
    const version = this.version;
    const request = Promise.resolve().then(loader).then(value => {
      if (version !== this.version || userId !== this.userId) return null;
      publish(value);
      return value;
    }).finally(() => { if (this.pending === request) this.pending = undefined; });
    this.pending = request;
    return request;
  }
}
