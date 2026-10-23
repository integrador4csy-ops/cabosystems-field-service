export function sharedModule<T>(loader: () => Promise<T>) {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending) pending = loader().catch(error => { pending = undefined; throw error; });
    return pending;
  };
}

type IdleScheduler = (task: () => void) => () => void;

const scheduleIdle: IdleScheduler = task => {
  let idle: number | undefined;
  const timer = window.setTimeout(() => {
    if ('requestIdleCallback' in window) idle = window.requestIdleCallback(task, { timeout: 2000 });
    else task();
  }, 300);
  return () => {
    window.clearTimeout(timer);
    if (idle !== undefined) window.cancelIdleCallback(idle);
  };
};

/** Download code sequentially without mounting views or querying their private data. */
export function preloadModules(loaders: Array<() => Promise<unknown>>, schedule: IdleScheduler = scheduleIdle) {
  let cancelled = false;
  let position = 0;
  let cancelQueued = () => {};
  const next = () => {
    if (cancelled || position >= loaders.length) return;
    cancelQueued = schedule(() => {
      if (cancelled) return;
      const loader = loaders[position++];
      void Promise.resolve().then(loader).catch(() => {
        // A speculative download failure must not block login or the next module.
      }).finally(next);
    });
  };
  next();
  return () => { cancelled = true; cancelQueued(); };
}
