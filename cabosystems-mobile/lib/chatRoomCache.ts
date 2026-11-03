import type { ChatGroup, ChatMessage, ChatPin } from '@/types/database';
import { chatDatabase, type MessageCursor, type HistoryProgress } from './chatDatabase';
import { chatRoomStorage } from './chatRoomStorage';

export type RoomSnapshot = { group: ChatGroup; messages: ChatMessage[]; pins: ChatPin[] };
const rooms = new Map<string, { snapshot: RoomSnapshot; savedAt: number; loaded: boolean }>();
const listeners = new Set<(owner: string, room: string) => void>();
let owner = '';
let generation = 0;
let restoration: Promise<void> | null = null;

function selectOwner(userId: string) {
  if (owner !== userId) { rooms.clear(); owner = userId; generation++; restoration = null; }
}
const notify = (userId: string, room: string) => { for (const listener of listeners) listener(userId, room); };
const reportStorageError = () => console.warn('No se pudo actualizar la copia local del chat.');

// Only the hot message windows are bounded; SQLite retains every room and message.
function trimLoadedRooms() {
  const loaded = [...rooms.entries()].filter(([, entry]) => entry.loaded);
  for (const [, entry] of loaded.slice(0, Math.max(0, loaded.length - 12))) {
    entry.snapshot = { ...entry.snapshot, messages: [] };
    entry.loaded = false;
  }
}

export function subscribeChatRooms(userId: string, listener: (room: string) => void) {
  const callback = (account: string, room: string) => { if (account === userId) listener(room); };
  listeners.add(callback);
  return () => { listeners.delete(callback); };
}

export function getCachedChatRoom(userId: string, groupId: string, maxAge = Infinity): RoomSnapshot | null {
  selectOwner(userId);
  const entry = rooms.get(groupId);
  return userId && entry?.loaded && Date.now() - entry.savedAt < maxAge ? entry.snapshot : null;
}

export function restoreChatRooms(userId: string): Promise<void> {
  selectOwner(userId);
  if (!userId) return Promise.resolve();
  if (restoration) return restoration;
  const ticket = generation;
  restoration = (async () => {
    // One-time import preserves conversations saved by the previous app version.
    if (!await chatDatabase.migrated(userId)) {
      let raw: string | null = null;
      try { raw = await chatRoomStorage.read(userId); } catch { /* The database remains usable without the old file. */ }
      if (ticket !== generation) return;
      if (raw && raw.length < 8_000_000) {
        let legacy;
        try { legacy = JSON.parse(raw); } catch { /* Ignore a damaged old file. */ }
        if (legacy?.version === 1 && legacy.userId === userId && Array.isArray(legacy.rooms)) {
          for (const entry of legacy.rooms) {
            const snapshot = entry?.snapshot;
            if (!snapshot?.group || typeof snapshot.group.id !== 'string' || !Array.isArray(snapshot.messages) || !Array.isArray(snapshot.pins)) continue;
            if (!snapshot.messages.every((message: ChatMessage) => message && typeof message.id === 'string' && message.grupo_id === snapshot.group.id)) continue;
            if (!snapshot.pins.every((pin: ChatPin) => pin && typeof pin.mensaje_id === 'string' && pin.grupo_id === snapshot.group.id)) continue;
            await chatDatabase.saveRoom(userId, snapshot.group, snapshot.pins, snapshot.messages, entry.savedAt || 0);
          }
        }
      }
      await chatDatabase.markMigrated(userId);
    }
    const stored = await chatDatabase.listRooms(userId);
    if (ticket !== generation) return;
    for (const entry of stored) {
      if (!rooms.has(entry.group.id)) rooms.set(entry.group.id, {
        snapshot: { group: entry.group, pins: entry.pins, messages: [] }, savedAt: entry.savedAt, loaded: false,
      });
    }
  })().catch(() => { if (ticket === generation) restoration = null; reportStorageError(); });
  return restoration;
}

export async function loadChatRoom(userId: string, groupId: string, limit = 100): Promise<RoomSnapshot | null> {
  await restoreChatRooms(userId);
  const ticket = generation;
  const entry = rooms.get(groupId);
  if (!entry) return null;
  let messages: ChatMessage[];
  try { messages = await chatDatabase.messages(userId, groupId, undefined, limit); }
  catch { return owner === userId && entry.loaded ? entry.snapshot : null; }
  if (owner !== userId || ticket !== generation) return null;
  const snapshot = { ...entry.snapshot, messages };
  rooms.delete(groupId);
  rooms.set(groupId, { snapshot, savedAt: entry.savedAt, loaded: true });
  trimLoadedRooms();
  return snapshot;
}

export async function olderChatMessages(userId: string, groupId: string, before: MessageCursor, limit = 100) {
  return chatDatabase.messages(userId, groupId, before, limit);
}
export const getStoredChatMessage = (userId: string, id: string) => chatDatabase.message(userId, id);

export function getSavedChatGroups(userId: string): ChatGroup[] {
  selectOwner(userId);
  return [...rooms.values()].map(entry => entry.snapshot.group).sort((a, b) =>
    (b.ultimo_mensaje?.created_at || b.created_at || '').localeCompare(a.ultimo_mensaje?.created_at || a.created_at || ''));
}

export function saveChatRoom(userId: string, groupId: string, snapshot: RoomSnapshot) {
  selectOwner(userId);
  if (!userId || snapshot.group.id !== groupId) return;
  const savedAt = Date.now();
  rooms.set(groupId, { snapshot, savedAt, loaded: true });
  trimLoadedRooms();
  void chatDatabase.saveRoom(userId, snapshot.group, snapshot.pins, snapshot.messages, savedAt).catch(reportStorageError);
}

export async function persistChatRoom(userId: string, snapshot: RoomSnapshot) {
  const savedAt = Date.now();
  await chatDatabase.saveRoom(userId, snapshot.group, snapshot.pins, snapshot.messages, savedAt);
  if (owner === userId) {
    const previous = rooms.get(snapshot.group.id);
    rooms.set(snapshot.group.id, { snapshot: { ...snapshot, messages: previous?.snapshot.messages ?? snapshot.messages }, savedAt, loaded: previous?.loaded ?? true });
    notify(userId, snapshot.group.id);
  }
}

export async function persistChatPage(userId: string, groupId: string, messages: ChatMessage[], progress: HistoryProgress) {
  await chatDatabase.savePage(userId, groupId, messages, progress);
  if (owner === userId) notify(userId, groupId);
}

export async function forgetChatRoom(userId: string, groupId: string) {
  await chatDatabase.removeRoom(userId, groupId);
  if (owner === userId) { rooms.delete(groupId); notify(userId, groupId); }
}

export async function removeStoredChatMessage(userId: string, messageId: string) {
  await chatDatabase.removeMessage(userId, messageId);
  if (owner === userId) {
    for (const [id, entry] of rooms) {
      if (entry.snapshot.messages.some(message => message.id === messageId || message.reply_to_id === messageId) || entry.snapshot.pins.some(pin => pin.mensaje_id === messageId)) {
        entry.snapshot = { ...entry.snapshot, messages: entry.snapshot.messages.filter(message => message.id !== messageId).map(message => message.reply_to_id === messageId ? { ...message, reply_to_id: null, reply: null } : message), pins: entry.snapshot.pins.filter(pin => pin.mensaje_id !== messageId) };
        notify(userId, id);
      }
    }
  }
}
