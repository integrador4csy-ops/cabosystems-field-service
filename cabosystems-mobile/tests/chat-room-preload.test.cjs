const test = require('node:test');
const assert = require('node:assert/strict');
const { load, databaseFixture, cacheFixture, group, message } = require('./chat-test-helpers.cjs');

test('preparation schedules all chats, prioritizes recent messages, and uses two workers', async () => {
  let tasks, stopped = false; const calls = [];
  const { prepareChatRooms } = load('chatRoomPreload.ts', {
    './chatRoomSync': { syncChatRoom: async (...args) => { calls.push(args); } },
    './tabPreparation': { prepareTabs: (jobs, concurrency) => { tasks = jobs; assert.equal(concurrency, 2); return () => { stopped = true; }; } },
  });
  const groups = Array.from({ length: 14 }, (_, i) => group(String(i)));
  const stop = prepareChatRooms('u', groups);
  assert.equal(tasks.length, 28);
  for (const task of tasks.slice(0, 14)) await task();
  assert.ok(calls.every(args => args[4] === true));
  await tasks[14](); assert.equal(calls[14][4], false);
  stop(); await tasks[15](); assert.equal(calls.length, 15); assert.ok(stopped);
});

function syncFixture() {
  const { db } = databaseFixture(); const cache = cacheFixture(db);
  let remote = Array.from({ length: 325 }, (_, i) => message(i)).reverse();
  let active = true, cancelAt = Infinity, calls = 0;
  const cursors = [];
  const api = {
    getGroupMessagePage: async (_, before, size = 100) => {
      calls++; cursors.push(before?.id);
      const page = remote.filter(row => !before || row.created_at < before.created_at || (row.created_at === before.created_at && row.id < before.id)).slice(0, size);
      if (calls === cancelAt) active = false;
      return page;
    },
    getChatPins: async () => [],
  };
  const { syncChatRoom } = load('chatRoomSync.ts', { './chatDatabase': { chatDatabase: db }, './chatApi': api, './chatRoomCache': cache });
  return { db, cache, sync: reconcile => syncChatRoom('u', group('room'), () => active, reconcile),
    stopAt: count => { cancelAt = count; }, resume: () => { active = true; cancelAt = Infinity; },
    setRemote: value => { remote = value; }, cursors };
}

test('full sync downloads every page and retains all 325 messages locally', async () => {
  const f = syncFixture(); await f.cache.restoreChatRooms('u'); await f.sync();
  assert.equal((await f.db.messages('u', 'room', undefined, 1000)).length, 325);
  assert.equal((await f.db.listRooms('u'))[0].progress.complete, true);
});

test('interrupted downloads resume from the last committed history cursor', async () => {
  const f = syncFixture(); await f.cache.restoreChatRooms('u'); f.stopAt(2); await f.sync();
  const progress = (await f.db.listRooms('u'))[0].progress;
  assert.equal(progress.complete, false);
  assert.equal((await f.db.messages('u', 'room', undefined, 1000)).length, 100);
  f.resume(); const count = f.cursors.length; await f.sync();
  assert.equal(f.cursors[count], undefined);
  assert.equal(f.cursors[count + 1], progress.before.id);
  assert.equal((await f.db.messages('u', 'room', undefined, 1000)).length, 325);
});

test('reconciliation removes messages deleted remotely while the device was offline', async () => {
  const f = syncFixture(); await f.cache.restoreChatRooms('u'); await f.sync();
  f.setRemote([message(500), message(1)]); await f.sync(true);
  assert.deepEqual(Array.from((await f.db.messages('u', 'room', undefined, 1000)).map(row => row.id)), [message(1).id, message(500).id]);
});

test('incremental synchronization fills a gap of more than 100 new messages', async () => {
  const f = syncFixture(); await f.cache.restoreChatRooms('u'); await f.sync();
  f.setRemote(Array.from({ length: 650 }, (_, i) => message(i)).reverse()); await f.sync();
  assert.equal((await f.db.messages('u', 'room', undefined, 1000)).length, 650);
});
