const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { databaseFixture, cacheFixture, group, message, snapshot } = require('./chat-test-helpers.cjs');

test('all chats and their entire history survive closing and reopening the SQLite database', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csy-chat-test-'));
  const filename = path.join(dir, 'chat.db');
  const first = databaseFixture(filename);
  try {
    for (let i = 0; i < 14; i++) {
      const room = `room-${i}`;
      await first.db.saveRoom('user', group(room), [], Array.from({ length: 325 }, (_, j) => message(j, room)), Date.now());
    }
    first.sqlite.close();
    const second = databaseFixture(filename);
    try {
      const cache = cacheFixture(second.db);
      await cache.restoreChatRooms('user');
      assert.equal(cache.getSavedChatGroups('user').length, 14);
      const local = await cache.loadChatRoom('user', 'room-0');
      assert.equal(local.messages.length, 100);
      let page = local.messages;
      const ids = new Set(page.map(row => row.id));
      while (page.length) {
        page = await cache.olderChatMessages('user', 'room-0', page[0]);
        for (const row of page) ids.add(row.id);
      }
      assert.equal(ids.size, 325);
    } finally { second.sqlite.close(); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('saving the current screen never truncates older history', async () => {
  const { db } = databaseFixture();
  await db.saveRoom('u', group('room'), [], Array.from({ length: 250 }, (_, i) => message(i)), 1);
  const cache = cacheFixture(db); await cache.restoreChatRooms('u');
  cache.saveChatRoom('u', 'room', snapshot('room', [message(250)]));
  assert.equal((await db.messages('u', 'room', undefined, 1000)).length, 251);
});

test('stable local pagination includes every message when timestamps are equal', async () => {
  const { db } = databaseFixture();
  const messages = Array.from({ length: 205 }, (_, i) => ({ ...message(i), created_at: '2026-01-01T00:00:00.000Z' }));
  await db.saveRoom('u', group('room'), [], messages, 0);
  const a = await db.messages('u', 'room');
  const b = await db.messages('u', 'room', a[0]);
  const c = await db.messages('u', 'room', b[0]);
  assert.equal(new Set([...a, ...b, ...c].map(row => row.id)).size, 205);
});

test('accounts remain isolated in SQLite, including after switching and logout', async () => {
  const { db } = databaseFixture();
  await db.saveRoom('a', group('room'), [], [message(1)], 1);
  await db.saveRoom('b', group('room'), [], [message(2)], 1);
  const cache = cacheFixture(db);
  assert.equal((await cache.loadChatRoom('a', 'room')).messages[0].id, message(1).id);
  assert.equal((await cache.loadChatRoom('b', 'room')).messages[0].id, message(2).id);
  await cache.restoreChatRooms('');
  assert.equal(cache.getCachedChatRoom('', 'room'), null);
  assert.equal((await cache.loadChatRoom('a', 'room')).messages[0].id, message(1).id);
});

test('legacy snapshots migrate once without erasing newer SQLite messages', async () => {
  const { db } = databaseFixture();
  const legacy = JSON.stringify({ version: 1, userId: 'u', rooms: [{ savedAt: 1, snapshot: snapshot('room', [message(1)]) }] });
  const cache = cacheFixture(db, legacy); await cache.restoreChatRooms('u');
  assert.equal((await cache.loadChatRoom('u', 'room')).messages.length, 1);
  await db.removeMessage('u', message(1).id);
  const restarted = cacheFixture(db, legacy); await restarted.restoreChatRooms('u');
  assert.equal((await restarted.loadChatRoom('u', 'room')).messages.length, 0);
});

test('invalid legacy data and other-account files do not enter SQLite', async () => {
  for (const legacy of ['{broken', JSON.stringify({ version: 1, userId: 'other', rooms: [{ snapshot: snapshot('room', [message(1)]) }] })]) {
    const { db } = databaseFixture(); const cache = cacheFixture(db, legacy);
    await cache.restoreChatRooms('u'); assert.equal(cache.getSavedChatGroups('u').length, 0);
  }
});

test('partial synchronization preserves old messages; successful reconciliation removes server deletions', async () => {
  const { db } = databaseFixture();
  await db.saveRoom('u', group('room'), [], [message(1), message(2), message(3)], 1);
  const progress = { run: 'scan', upper: message(3), before: message(3), complete: false };
  await db.savePage('u', 'room', [message(3)], progress);
  assert.equal((await db.messages('u', 'room')).length, 3);
  await db.saveRoom('u', group('room'), [], [message(4)], 1);
  await db.savePage('u', 'room', [message(1)], { ...progress, complete: true });
  assert.deepEqual(Array.from((await db.messages('u', 'room')).map(row => row.id)), [message(1).id, message(3).id, message(4).id]);
});

test('deletions also clear pinned copies and quoted message content', async () => {
  const { db } = databaseFixture();
  const original = message(1);
  const reply = { ...message(2), reply_to_id: original.id, reply: original };
  await db.saveRoom('u', group('room'), [{ mensaje_id: original.id, grupo_id: 'room', message: original }], [original, reply], 1);
  const cache = cacheFixture(db); await cache.loadChatRoom('u', 'room');
  await cache.removeStoredChatMessage('u', original.id);
  assert.equal(await db.message('u', original.id), null);
  assert.equal((await db.message('u', reply.id)).reply, null);
  assert.equal((await db.listRooms('u'))[0].pins.length, 0);
});

test('revoked groups are removed locally without affecting other accounts', async () => {
  const { db } = databaseFixture();
  for (const user of ['a', 'b']) await db.saveRoom(user, group('room'), [], [message(1)], 1);
  const cache = cacheFixture(db); await cache.restoreChatRooms('a');
  await cache.forgetChatRoom('a', 'room');
  assert.equal(await cache.loadChatRoom('a', 'room'), null);
  assert.equal((await db.listRooms('b')).length, 1);
});
