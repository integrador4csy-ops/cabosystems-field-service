import type { ChatSticker } from '@/types/database';

type Snapshot = { items: ChatSticker[] | null; error: boolean };
type Dependencies = {
  read: (userId: string) => Promise<string | null>;
  write: (userId: string, value: string) => Promise<void>;
  fetch: (userId: string) => Promise<ChatSticker[]>;
  warm: (items: ChatSticker[]) => void;
  now?: () => number;
};

function validItems(value: unknown, userId: string): ChatSticker[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((item): item is ChatSticker => {
    if (!item || typeof item.id !== 'string' || seen.has(item.id) || item.profile_id !== userId || typeof item.url !== 'string' || !/^https?:\/\//.test(item.url) || typeof item.pack_name !== 'string' || typeof item.created_at !== 'string' || !(item.nombre === null || typeof item.nombre === 'string')) return false;
    seen.add(item.id); return true;
  });
}

/** Shared per-account snapshots: local first, one background refresh, no emptying on failure. */
export function createStickerLibraryCache(deps: Dependencies) {
  const accounts = new Map<string, {
    snapshot: Snapshot; listeners: Set<() => void>; hydrated?: Promise<void>;
    request?: Promise<void>; writes: Promise<void>; refreshed: number;
    revision: number; additions: Map<string, { item: ChatSticker; revision: number }>;
  }>();
  const now = deps.now || Date.now;
  const account = (userId: string) => {
    let state = accounts.get(userId);
    if (!state) {
      state = { snapshot: { items: null, error: false }, listeners: new Set(), writes: Promise.resolve(), refreshed: -Infinity, revision: 0, additions: new Map() };
      accounts.set(userId, state);
    }
    return state;
  };
  const publish = (userId: string, items: ChatSticker[] | null, error = false) => {
    const state = account(userId);
    state.snapshot = { items, error };
    state.listeners.forEach((listener) => listener());
    if (items) deps.warm(items);
  };
  const persist = (userId: string) => {
    const state = account(userId);
    const value = JSON.stringify({ version: 1, items: state.snapshot.items?.slice(0, 500) || [] });
    state.writes = state.writes.then(() => deps.write(userId, value)).catch(() => {});
    return state.writes;
  };
  const hydrate = (userId: string) => {
    const state = account(userId);
    return state.hydrated ||= (async () => {
      try {
        const raw = await deps.read(userId);
        if (raw && raw.length < 2_000_000 && state.snapshot.items === null) {
          const cached = JSON.parse(raw);
          if (cached.version === 1 && Array.isArray(cached.items)) publish(userId, validItems(cached.items, userId));
        }
      } catch { /* Missing/corrupt cache must not prevent a network refresh. */ }
    })();
  };
  return {
    snapshot: (userId: string) => account(userId).snapshot,
    subscribe(userId: string, listener: () => void) {
      const state = account(userId); state.listeners.add(listener);
      return () => { state.listeners.delete(listener); };
    },
    prepare(userId: string): Promise<void> {
      if (!userId) return Promise.resolve();
      const state = account(userId);
      if (state.request) return state.request;
      if (now() - state.refreshed < 60_000) return Promise.resolve();
      state.request = (async () => {
        await hydrate(userId);
        const revision = state.revision;
        try {
          const remote = validItems(await deps.fetch(userId), userId);
          const additions = [...state.additions.values()].filter((entry) => entry.revision > revision).map((entry) => entry.item);
          const ids = new Set(additions.map((item) => item.id));
          publish(userId, [...additions, ...remote.filter((item) => !ids.has(item.id))]);
          state.refreshed = now();
          state.additions.forEach((entry, id) => { if (entry.revision <= revision) state.additions.delete(id); });
          await persist(userId);
        } catch { publish(userId, state.snapshot.items, true); }
      })().finally(() => { state.request = undefined; });
      return state.request;
    },
    async add(userId: string, item: ChatSticker) {
      await hydrate(userId);
      if (!validItems([item], userId).length) return;
      const state = account(userId);
      state.additions.set(item.id, { item, revision: ++state.revision });
      publish(userId, [item, ...(state.snapshot.items || []).filter((value) => value.id !== item.id)]);
      await persist(userId);
    },
  };
}
