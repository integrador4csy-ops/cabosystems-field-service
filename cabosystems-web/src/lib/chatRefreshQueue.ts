/** Combine event bursts and serialize reads so older responses never win. */
export function createChatRefreshQueue(refresh: (messageIds: string[]) => Promise<void>, delay = 80) {
  const queued = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<void> | undefined;
  let stopped = false;
  let waiters: { resolve: () => void; reject: (error: unknown) => void }[] = [];
  const flush = () => {
    timer = undefined;
    if (stopped || running || !queued.size) return;
    const ids = [...queued];
    queued.clear();
    const batch = waiters;
    waiters = [];
    running = Promise.resolve().then(() => refresh(ids)).then(
      () => batch.forEach(waiter => waiter.resolve()),
      error => batch.forEach(waiter => waiter.reject(error)),
    ).finally(() => {
      running = undefined;
      if (!stopped && queued.size) timer = setTimeout(flush, delay);
    });
  };
  return {
    request(id: string) {
      if (stopped) return Promise.resolve();
      queued.add(id);
      const promise = new Promise<void>((resolve, reject) => waiters.push({ resolve, reject }));
      if (!timer && !running) timer = setTimeout(flush, delay);
      return promise;
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
      queued.clear();
      waiters.forEach(waiter => waiter.resolve());
      waiters = [];
    },
  };
}
