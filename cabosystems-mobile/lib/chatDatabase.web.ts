import type { ChatGroup, ChatMessage, ChatPin } from '@/types/database';
import type { MessageCursor, HistoryProgress, StoredRoom } from './chatDatabase';

type RoomRow = StoredRoom & { owner: string; id: string };
type MessageRow = { owner: string; room: string; id: string; message: ChatMessage; run: string };
let opening: Promise<IDBDatabase> | undefined;
function database() {
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open('csy-chat-v2', 1);
    request.onupgradeneeded = () => {
      const rooms = request.result.createObjectStore('rooms', { keyPath: ['owner', 'id'] });
      rooms.createIndex('owner', 'owner');
      const messages = request.result.createObjectStore('messages', { keyPath: ['owner', 'id'] });
      messages.createIndex('room', ['owner', 'room']);
      request.result.createObjectStore('meta');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = undefined; reject(request.error); };
  });
  return opening;
}
function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
}
async function transaction<T>(mode: IDBTransactionMode, task: (tx: IDBTransaction) => Promise<T>) {
  const tx = (await database()).transaction(['rooms', 'messages', 'meta'], mode);
  const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error); });
  try { const result = await task(tx); await done; return result; }
  catch (error) { try { tx.abort(); } catch {} await done.catch(() => {}); throw error; }
}
const roomRows = (tx: IDBTransaction, owner: string) => request<RoomRow[]>(tx.objectStore('rooms').index('owner').getAll(owner));
const messageRows = (tx: IDBTransaction, owner: string, room: string) => request<MessageRow[]>(tx.objectStore('messages').index('room').getAll([owner, room]));
async function putMessages(tx: IDBTransaction, owner: string, room: string, messages: ChatMessage[], run?: string) {
  const store = tx.objectStore('messages');
  for (const message of messages) {
    if (message.grupo_id !== room) continue;
    const previous: MessageRow | undefined = await request(store.get([owner, message.id]));
    await request(store.put({ owner, room, id: message.id, message, run: run ?? previous?.run ?? '' }));
  }
}
export const chatDatabase = {
  listRooms: (owner: string): Promise<StoredRoom[]> => transaction('readonly', tx => roomRows(tx, owner)),
  messages: (owner: string, room: string, before?: MessageCursor, limit = 100): Promise<ChatMessage[]> => transaction('readonly', async tx => {
    const rows = await messageRows(tx, owner, room);
    return rows.map(row => row.message).filter(message => !before || message.created_at < before.created_at || (message.created_at === before.created_at && message.id < before.id))
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id)).slice(0, limit).reverse();
  }),
  message: (owner: string, id: string): Promise<ChatMessage | null> => transaction('readonly', async tx => {
    const row: MessageRow | undefined = await request(tx.objectStore('messages').get([owner, id])); return row?.message ?? null;
  }),
  saveRoom: (owner: string, group: ChatGroup, pins: ChatPin[], messages: ChatMessage[], savedAt: number) => transaction('readwrite', async tx => {
    const previous: RoomRow | undefined = await request(tx.objectStore('rooms').get([owner, group.id]));
    await request(tx.objectStore('rooms').put({ owner, id: group.id, group, pins, savedAt, progress: previous?.progress ?? null }));
    await putMessages(tx, owner, group.id, messages);
  }),
  savePage: (owner: string, room: string, messages: ChatMessage[], progress: HistoryProgress) => transaction('readwrite', async tx => {
    await putMessages(tx, owner, room, messages, progress.run);
    if (progress.complete) for (const row of await messageRows(tx, owner, room)) {
      const older = !progress.upper || row.message.created_at < progress.upper.created_at || (row.message.created_at === progress.upper.created_at && row.id <= progress.upper.id);
      if (row.run !== progress.run && older) await request(tx.objectStore('messages').delete([owner, row.id]));
    }
    const entry: RoomRow | undefined = await request(tx.objectStore('rooms').get([owner, room]));
    if (entry) await request(tx.objectStore('rooms').put({ ...entry, progress }));
  }),
  removeMessage: (owner: string, id: string) => transaction('readwrite', async tx => {
    await request(tx.objectStore('messages').delete([owner, id]));
    for (const room of await roomRows(tx, owner)) {
      await request(tx.objectStore('rooms').put({ ...room, pins: room.pins.filter(pin => pin.mensaje_id !== id) }));
      for (const row of await messageRows(tx, owner, room.id)) if (row.message.reply_to_id === id) {
        await request(tx.objectStore('messages').put({ ...row, message: { ...row.message, reply: null, reply_to_id: null } }));
      }
    }
  }),
  removeRoom: (owner: string, room: string) => transaction('readwrite', async tx => {
    for (const row of await messageRows(tx, owner, room)) await request(tx.objectStore('messages').delete([owner, row.id]));
    await request(tx.objectStore('rooms').delete([owner, room]));
  }),
  migrated: (owner: string): Promise<boolean> => transaction('readonly', async tx => Boolean(await request(tx.objectStore('meta').get(owner)))),
  markMigrated: (owner: string) => transaction('readwrite', async tx => { await request(tx.objectStore('meta').put(true, owner)); }),
};
