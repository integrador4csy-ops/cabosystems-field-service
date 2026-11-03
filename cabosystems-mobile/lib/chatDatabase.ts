import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { ChatGroup, ChatMessage, ChatPin } from '@/types/database';

export type MessageCursor = { created_at: string; id: string };
export type HistoryProgress = { before?: MessageCursor; upper?: MessageCursor; run: string; complete: boolean };
export type StoredRoom = { group: ChatGroup; pins: ChatPin[]; savedAt: number; progress: HistoryProgress | null };
let opening: Promise<SQLiteDatabase> | undefined;
let writes: Promise<unknown> = Promise.resolve();

async function database() {
  if (!opening) opening = (async () => {
    const db = await openDatabaseAsync('csy-chat-v2.db');
    await db.execAsync(`PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS chat_rooms (
        owner TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, pins TEXT NOT NULL DEFAULT '[]',
        saved_at INTEGER NOT NULL, progress TEXT, PRIMARY KEY (owner, id));
      CREATE TABLE IF NOT EXISTS chat_messages (
        owner TEXT NOT NULL, room TEXT NOT NULL, id TEXT NOT NULL, created_at TEXT NOT NULL,
        data TEXT NOT NULL, seen_run TEXT NOT NULL DEFAULT '', PRIMARY KEY (owner, id));
      CREATE INDEX IF NOT EXISTS chat_message_history ON chat_messages(owner, room, created_at DESC, id DESC);
      CREATE TABLE IF NOT EXISTS chat_meta (owner TEXT PRIMARY KEY, migrated INTEGER NOT NULL);`);
    return db;
  })().catch(error => { opening = undefined; throw error; });
  return opening;
}

function write(task: (db: SQLiteDatabase) => Promise<void>): Promise<void> {
  const result = writes.then(async () => {
    const db = await database();
    await db.withExclusiveTransactionAsync(task);
  });
  writes = result.catch(() => {});
  return result;
}

async function putMessages(db: SQLiteDatabase, owner: string, room: string, messages: ChatMessage[], run?: string) {
  for (const message of messages) {
    if (message.grupo_id !== room) continue;
    await db.runAsync(`INSERT INTO chat_messages(owner, room, id, created_at, data, seen_run) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(owner, id) DO UPDATE SET data=excluded.data, created_at=excluded.created_at,
      seen_run=CASE WHEN excluded.seen_run='' THEN chat_messages.seen_run ELSE excluded.seen_run END`,
    owner, room, message.id, message.created_at, JSON.stringify(message), run ?? '');
  }
}

export const chatDatabase = {
  async listRooms(owner: string): Promise<StoredRoom[]> {
    await writes;
    const rows = await (await database()).getAllAsync<{ data: string; pins: string; saved_at: number; progress: string | null }>(
      'SELECT data, pins, saved_at, progress FROM chat_rooms WHERE owner=? ORDER BY saved_at DESC', owner);
    return rows.flatMap(row => {
      try { return [{ group: JSON.parse(row.data), pins: JSON.parse(row.pins), savedAt: row.saved_at, progress: row.progress ? JSON.parse(row.progress) : null }]; }
      catch { return []; }
    });
  },
  async messages(owner: string, room: string, before?: MessageCursor, limit = 100): Promise<ChatMessage[]> {
    await writes;
    const db = await database();
    const rows = before
      ? await db.getAllAsync<{ data: string }>('SELECT data FROM chat_messages WHERE owner=? AND room=? AND (created_at<? OR (created_at=? AND id<?)) ORDER BY created_at DESC, id DESC LIMIT ?', owner, room, before.created_at, before.created_at, before.id, limit)
      : await db.getAllAsync<{ data: string }>('SELECT data FROM chat_messages WHERE owner=? AND room=? ORDER BY created_at DESC, id DESC LIMIT ?', owner, room, limit);
    return rows.reverse().flatMap(row => { try { return [JSON.parse(row.data) as ChatMessage]; } catch { return []; } });
  },
  async message(owner: string, id: string): Promise<ChatMessage | null> {
    await writes;
    const row = await (await database()).getFirstAsync<{ data: string }>('SELECT data FROM chat_messages WHERE owner=? AND id=?', owner, id);
    return row ? JSON.parse(row.data) : null;
  },
  saveRoom(owner: string, group: ChatGroup, pins: ChatPin[], messages: ChatMessage[], savedAt: number) {
    return write(async db => {
      await db.runAsync(`INSERT INTO chat_rooms(owner,id,data,pins,saved_at) VALUES (?,?,?,?,?)
        ON CONFLICT(owner,id) DO UPDATE SET data=excluded.data,pins=excluded.pins,saved_at=excluded.saved_at`, owner, group.id, JSON.stringify(group), JSON.stringify(pins), savedAt);
      await putMessages(db, owner, group.id, messages);
    });
  },
  savePage(owner: string, room: string, messages: ChatMessage[], progress: HistoryProgress) {
    return write(async db => {
      await putMessages(db, owner, room, messages, progress.run);
      // Prune only after the entire server scan succeeds, never after a partial download.
      if (progress.complete) {
        if (progress.upper) {
          await db.runAsync(`DELETE FROM chat_messages WHERE owner=? AND room=? AND seen_run<>?
            AND (created_at<? OR (created_at=? AND id<=?))`, owner, room, progress.run, progress.upper.created_at, progress.upper.created_at, progress.upper.id);
        } else {
          await db.runAsync('DELETE FROM chat_messages WHERE owner=? AND room=?', owner, room);
        }
      }
      await db.runAsync('UPDATE chat_rooms SET progress=? WHERE owner=? AND id=?', JSON.stringify(progress), owner, room);
    });
  },
  removeMessage(owner: string, id: string) {
    return write(async db => {
      await db.runAsync('DELETE FROM chat_messages WHERE owner=? AND id=?', owner, id);
      await db.runAsync(`UPDATE chat_messages SET data=json_set(data,'$.reply',NULL,'$.reply_to_id',NULL)
        WHERE owner=? AND json_extract(data,'$.reply_to_id')=?`, owner, id);
      const rooms = await db.getAllAsync<{ id: string; pins: string }>('SELECT id,pins FROM chat_rooms WHERE owner=?', owner);
      for (const room of rooms) {
        const pins = (JSON.parse(room.pins) as ChatPin[]).filter(pin => pin.mensaje_id !== id);
        await db.runAsync('UPDATE chat_rooms SET pins=? WHERE owner=? AND id=?', JSON.stringify(pins), owner, room.id);
      }
    });
  },
  removeRoom(owner: string, room: string) {
    return write(async db => {
      await db.runAsync('DELETE FROM chat_messages WHERE owner=? AND room=?', owner, room);
      await db.runAsync('DELETE FROM chat_rooms WHERE owner=? AND id=?', owner, room);
    });
  },
  async migrated(owner: string) {
    return Boolean(await (await database()).getFirstAsync('SELECT owner FROM chat_meta WHERE owner=?', owner));
  },
  markMigrated(owner: string) {
    return write(async db => { await db.runAsync('INSERT OR REPLACE INTO chat_meta(owner,migrated) VALUES (?,1)', owner); });
  },
};
