import type { ChatGroup, ChatMessage } from '@/types/database';
import { chatDatabase, type HistoryProgress } from './chatDatabase';
import { getChatPins, getGroupMessagePage } from './chatApi';
import { persistChatRoom, persistChatPage, loadChatRoom } from './chatRoomCache';

const pending = new Map<string, Promise<void>>();
const PAGE_SIZE = 100;
const cursor = (message: ChatMessage) => ({ id: message.id, created_at: message.created_at });

/** Downloads the entire history in bounded pages; interrupted scans resume on the next run. */
export async function syncChatRoom(userId: string, group: ChatGroup, active: () => boolean, reconcile = false, headOnly = false): Promise<void> {
  const key = `${userId}:${group.id}:${headOnly ? 'head' : 'history'}`;
  const existing = pending.get(key);
  if (existing) { await existing.catch(() => {}); if (active()) return syncChatRoom(userId, group, active, reconcile, headOnly); return; }
  const task = (async () => {
    const stored = (await chatDatabase.listRooms(userId)).find(room => room.group.id === group.id);
    const [head, pins] = await Promise.all([getGroupMessagePage(group.id), getChatPins(group.id)]);
    if (!active()) return;
    await persistChatRoom(userId, { group: { ...group, ultimo_mensaje: head[0] ?? null }, pins, messages: [...head].reverse() });
    if (headOnly) { if (active()) await loadChatRoom(userId, group.id); return; }
    let progress: HistoryProgress;
    if (stored?.progress && !stored.progress.complete) {
      progress = stored.progress;
    } else if (stored?.progress?.complete && !reconcile) {
      // Fetch all new messages after a long absence, even when there are more than one page.
      const newest = await chatDatabase.message(userId, stored.group.ultimo_mensaje?.id ?? '');
      let page = head;
      while (active() && page.length === PAGE_SIZE && (!newest || page.every(message =>
        message.created_at > newest.created_at || (message.created_at === newest.created_at && message.id > newest.id)))) {
        page = await getGroupMessagePage(group.id, cursor(page[page.length - 1]));
        if (!active()) return;
        await persistChatRoom(userId, { group: { ...group, ultimo_mensaje: head[0] ?? null }, pins, messages: [...page].reverse() });
      }
      await loadChatRoom(userId, group.id);
      return;
    } else {
      progress = { run: `${Date.now()}-${Math.random().toString(36).slice(2)}`, upper: head[0] ? cursor(head[0]) : undefined,
        before: head.length ? cursor(head[head.length - 1]) : undefined, complete: head.length < PAGE_SIZE };
      await persistChatPage(userId, group.id, head, progress);
    }
    while (active() && !progress.complete) {
      const page = await getGroupMessagePage(group.id, progress.before);
      if (!active()) return;
      progress = { ...progress, before: page.length ? cursor(page[page.length - 1]) : progress.before, complete: page.length < PAGE_SIZE };
      await persistChatPage(userId, group.id, page, progress);
    }
    if (active()) await loadChatRoom(userId, group.id);
  })();
  pending.set(key, task);
  try { await task; } finally { if (pending.get(key) === task) pending.delete(key); }
}
