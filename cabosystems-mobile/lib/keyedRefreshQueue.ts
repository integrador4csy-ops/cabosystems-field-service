/** Coalesce event bursts and allow at most one pending refresh per key. */
export function createKeyedRefreshQueue(delay = 120) {
  type Slot = { task: () => Promise<void>; dirty: boolean; running: boolean; timer?: ReturnType<typeof setTimeout> };
  const slots = new Map<string, Slot>();
  let disposed = false;
  const schedule = (key: string, slot: Slot) => {
    if (disposed || slot.running || slot.timer) return;
    slot.timer = setTimeout(async () => {
      slot.timer = undefined;
      slot.running = true;
      slot.dirty = false;
      try { if (!disposed) await slot.task(); }
      catch { /* A transient failure must not block subsequent refreshes. */ }
      finally {
        slot.running = false;
        if (!disposed && slot.dirty) schedule(key, slot);
        else if (slots.get(key) === slot) slots.delete(key);
      }
    }, delay);
  };
  return {
    enqueue(key: string, task: () => Promise<void>) {
      if (disposed) return;
      let slot = slots.get(key);
      if (!slot) { slot = { task, dirty: true, running: false }; slots.set(key, slot); }
      else { slot.task = task; slot.dirty = true; }
      schedule(key, slot);
    },
    dispose() {
      disposed = true;
      for (const slot of slots.values()) if (slot.timer) clearTimeout(slot.timer);
      slots.clear();
    },
  };
}
