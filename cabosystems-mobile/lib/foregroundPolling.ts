import { AppState } from 'react-native';

/** Poll only while visible, with at most one request per subscription in flight. */
export function startForegroundPolling(task: () => Promise<unknown> | void, interval: number) {
  let disposed = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const clear = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const run = async () => {
    clear();
    if (disposed || running || AppState.currentState !== 'active') return;
    running = true;
    try { await task(); }
    catch { /* A failed refresh must not stop future attempts. Callers own error UI. */ }
    finally {
      running = false;
      if (!disposed && AppState.currentState === 'active') timer = setTimeout(run, interval);
    }
  };
  const subscription = AppState.addEventListener('change', state => {
    clear();
    if (state === 'active') void run();
  });
  void run();
  return () => { disposed = true; clear(); subscription.remove(); };
}
