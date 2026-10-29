import { AppState } from 'react-native';

/** Let the newly focused screen paint before starting its refresh work. */
export function afterTabPaint(task: () => void | (() => void)) {
  let cancelled = false;
  let cleanup: void | (() => void);
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      if (!cancelled) cleanup = task();
    });
  });
  return () => {
    cancelled = true;
    cancelAnimationFrame(frame);
    if (typeof cleanup === 'function') { cleanup(); cleanup = undefined; }
  };
}

/** Execute background preparation tasks during idle opportunities without blocking UI. */
export function prepareTabs(tasks: Array<() => void | Promise<void>>, concurrency = 1) {
  let stopped = false;
  let running = 0;
  const limit = Math.max(1, Math.floor(concurrency));
  let index = 0;
  let idle: ReturnType<typeof requestIdleCallback> | undefined;

  const cancel = () => {
    if (idle !== undefined) {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idle);
      } else {
        clearTimeout(idle as any);
      }
      idle = undefined;
    }
  };

  const schedule = () => {
    if (stopped || running >= limit || idle !== undefined || index >= tasks.length || AppState.currentState !== 'active') return;
    const runner = async () => {
      idle = undefined;
      if (stopped || AppState.currentState !== 'active') return;
      running++;
      const task = tasks[index++];
      schedule();
      try {
        if (task) await task();
      } catch (err) {
        console.warn('Tab preparation task failed:', err);
      } finally {
        running--;
        schedule();
      }
    };

    if (typeof requestIdleCallback === 'function') {
      idle = requestIdleCallback(runner, { timeout: 500 });
    } else {
      idle = setTimeout(runner, 24) as any;
    }
  };

  const listener = AppState.addEventListener('change', state => {
    cancel();
    if (state === 'active') schedule();
  });

  // Main data has settled; give it its first paint, with no fixed startup delay.
  const stopFirstPaint = afterTabPaint(schedule);

  return () => {
    stopped = true;
    stopFirstPaint();
    cancel();
    listener.remove();
  };
}
