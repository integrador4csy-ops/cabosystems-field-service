import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from './supabase';
import { getMyChatGroups, getChatMessage } from './chatApi';
import { chatDatabase } from './chatDatabase';
import { prepareChatRooms } from './chatRoomPreload';
import { restoreChatRooms, getSavedChatGroups, forgetChatRoom, persistChatRoom, removeStoredChatMessage } from './chatRoomCache';
import { syncChatRoom } from './chatRoomSync';
import { createKeyedRefreshQueue } from './keyedRefreshQueue';

type ChatBackgroundSyncLease = {
  consumers: number;
  stop: () => void;
};

const activeChatSyncs = new Map<string, ChatBackgroundSyncLease>();
let chatSyncInstance = 0;

/** Account-scoped sync survives navigation and resumes after connection interruptions. */
function createChatBackgroundSync(userId: string) {
  let active = true;
  let online = false;
  let running = false;
  let queued = false;
  let reconciliationRequested = false;
  let allowedRooms: Set<string> | null = null;
  let stopRooms: (() => void) | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const refreshes = createKeyedRefreshQueue();
  const isActive = () => active && online && AppState.currentState === 'active';
  const run = async (reconcile = false) => {
    reconciliationRequested ||= reconcile;
    if (!isActive()) return;
    if (running) { queued = true; return; }
    if (retry) { clearTimeout(retry); retry = undefined; }
    running = true;
    const fullHistory = reconciliationRequested;
    reconciliationRequested = false;
    try {
      await restoreChatRooms(userId);
      const groups = await getMyChatGroups(userId);
      if (!isActive()) return;
      const allowed = new Set(groups.map(group => group.id));
      allowedRooms = allowed;
      stopRooms?.();
      for (const old of getSavedChatGroups(userId)) {
        if (!allowed.has(old.id)) await forgetChatRoom(userId, old.id);
      }
      const stored = await chatDatabase.listRooms(userId);
      for (const group of groups) {
        if (!isActive()) return;
        await persistChatRoom(userId, { group, pins: stored.find(room => room.group.id === group.id)?.pins ?? [], messages: [] });
      }
      stopRooms = prepareChatRooms(userId, groups, fullHistory);
    } catch {
      reconciliationRequested ||= fullHistory;
      if (active) retry = setTimeout(() => { void run(); }, 30_000);
    } finally {
      running = false;
      if (queued) { queued = false; void run(); }
    }
  };
  const refreshRoom = (roomId?: string) => {
    if (!isActive()) return;
    for (const group of getSavedChatGroups(userId).filter(group => !roomId || group.id === roomId)) {
      if (!allowedRooms?.has(group.id)) continue;
      refreshes.enqueue(`room:${group.id}`, async () => {
        if (isActive() && allowedRooms?.has(group.id)) await syncChatRoom(userId, group, () => isActive() && Boolean(allowedRooms?.has(group.id)), false, true);
      });
    }
  };
  const channel = supabase.channel(`chat_local_sync_${userId}_${++chatSyncInstance}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_mensajes' }, payload => {
      if (!isActive()) return;
      if (payload.eventType === 'DELETE') {
        void chatDatabase.message(userId, payload.old.id).then(async message => {
          if (!isActive()) return;
          await removeStoredChatMessage(userId, payload.old.id);
          if (message) refreshRoom(message.grupo_id);
        }).catch(() => {});
      } else refreshRoom(payload.new.grupo_id);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_reacciones' }, payload => {
      if (!isActive()) return;
      const messageId = 'mensaje_id' in payload.new ? payload.new.mensaje_id : 'mensaje_id' in payload.old ? payload.old.mensaje_id : undefined;
      if (!messageId) { void run(); return; }
      refreshes.enqueue(`message:${messageId}`, async () => {
        if (!isActive()) return;
        const message = await getChatMessage(messageId);
        if (!message || !isActive()) return;
        const room = (await chatDatabase.listRooms(userId)).find(room => room.group.id === message.grupo_id);
        if (room && isActive() && allowedRooms?.has(room.group.id)) await persistChatRoom(userId, { group: room.group, pins: room.pins, messages: [message] });
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_pins' }, payload => {
      const roomId = 'grupo_id' in payload.new ? payload.new.grupo_id : 'grupo_id' in payload.old ? payload.old.grupo_id : undefined;
      refreshRoom(roomId);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_grupos' }, () => { void run(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_miembros', filter: `profile_id=eq.${userId}` }, () => { void run(); })
    .subscribe(status => { if (status === 'SUBSCRIBED') void run(true); });
  const network = NetInfo.addEventListener(state => {
    const connected = state.isConnected === true && state.isInternetReachable !== false;
    const changed = connected !== online;
    online = connected;
    if (!online) stopRooms?.();
    if (changed && online) void run(true);
  });
  const app = AppState.addEventListener('change', state => {
    if (state === 'active') void run(); else stopRooms?.();
  });
  return () => {
    active = false; stopRooms?.(); refreshes.dispose(); network(); app.remove();
    if (retry) clearTimeout(retry);
    void supabase.removeChannel(channel);
  };
}

/**
 * Shares one Realtime subscription per account.
 *
 * Concurrent consumers reuse the active account sync. A later lifecycle receives a
 * new channel topic so it cannot collide with an asynchronous Realtime teardown.
 */
export function startChatBackgroundSync(userId: string) {
  let lease = activeChatSyncs.get(userId);
  if (!lease) {
    lease = { consumers: 0, stop: createChatBackgroundSync(userId) };
    activeChatSyncs.set(userId, lease);
  }
  lease.consumers += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;

    const current = activeChatSyncs.get(userId);
    if (current !== lease) return;
    current.consumers = Math.max(0, current.consumers - 1);
    if (current.consumers > 0) return;
    activeChatSyncs.delete(userId);
    current.stop();
  };
}
