const test = require('node:test');
const assert = require('node:assert/strict');
const { load, group } = require('./chat-test-helpers.cjs');
const settle = () => new Promise(resolve => setImmediate(resolve));

function fixture() {
  let network, app, queryResolve;
  const calls = { persisted: [], removed: [], prepared: [], stopped: 0, channels: 0, removedChannels: 0, topics: [] };
  let groups = [group('keep'), group('new')];
  const local = [group('keep'), group('revoked')];
  const handlers = [];
  const chain = { on(...args) { handlers.push(args); return chain; }, subscribe() { return chain; } };
  const { startChatBackgroundSync } = load('chatBackgroundSync.ts', {
    'react-native': { AppState: { currentState: 'active', addEventListener: (_, fn) => { app = fn; return { remove() {} }; } } },
    '@react-native-community/netinfo': { __esModule: true, default: { addEventListener: fn => { network = fn; return () => {}; } } },
    './supabase': { supabase: {
      channel: topic => { calls.channels++; calls.topics.push(topic); return chain; },
      removeChannel: async () => { calls.removedChannels++; },
    } },
    './chatApi': { getMyChatGroups: () => groups === null ? new Promise(resolve => { queryResolve = resolve; }) : Promise.resolve(groups), getChatMessage: async () => null },
    './chatDatabase': { chatDatabase: { listRooms: async () => [], message: async () => null } },
    './chatRoomPreload': { prepareChatRooms: (user, groups, reconcile) => { calls.prepared.push({ user, groups, reconcile }); return () => { calls.stopped++; }; } },
    './chatRoomCache': {
      restoreChatRooms: async () => {}, getSavedChatGroups: () => local,
      forgetChatRoom: async (user, id) => { calls.removed.push(id); },
      persistChatRoom: async (_, snapshot) => { calls.persisted.push(snapshot); }, removeStoredChatMessage: async () => {},
    },
    './chatRoomSync': { syncChatRoom: async () => {} },
    './keyedRefreshQueue': load('keyedRefreshQueue.ts'),
  });
  return { start: () => startChatBackgroundSync('u'), calls,
    connect: () => network({ isConnected: true, isInternetReachable: true }),
    disconnect: () => network({ isConnected: false }),
    resume: () => app('active'),
    pending: () => { groups = null; }, finish: () => queryResolve([group('keep')]),
  };
}

test('account-wide sync persists every group and removes revoked groups only after a valid list', async () => {
  const f = fixture(); const stop = f.start(); f.connect(); await settle();
  assert.deepEqual(f.calls.removed, ['revoked']);
  assert.equal(f.calls.persisted.length, 2);
  assert.equal(f.calls.prepared[0].groups.length, 2);
  assert.equal(f.calls.prepared[0].reconcile, true);
  stop();
});

test('a late server response after logout cannot write or restart downloads', async () => {
  const f = fixture(); f.pending(); const stop = f.start(); f.connect(); await settle();
  stop(); f.finish(); await settle();
  assert.equal(f.calls.persisted.length, 0);
  assert.equal(f.calls.removed.length, 0);
  assert.equal(f.calls.prepared.length, 0);
});

test('connection loss pauses downloads and reconnection schedules reconciliation', async () => {
  const f = fixture(); const stop = f.start(); f.connect(); await settle();
  f.disconnect(); assert.ok(f.calls.stopped >= 1);
  f.connect(); await settle(); assert.equal(f.calls.prepared.length, 2);
  stop();
});

test('normal app resume prepares incremental history; reconnection retains full reconciliation', async () => {
 const f = fixture(); const stop = f.start(); f.connect(); await settle();
 assert.equal(f.calls.prepared[0].reconcile, true);
 f.resume(); await settle();
 assert.equal(f.calls.prepared.at(-1).reconcile, false);
 f.disconnect(); f.connect(); await settle();
 assert.equal(f.calls.prepared.at(-1).reconcile, true);
 stop();
});

test('double mount shares one realtime channel and releases it after the final consumer', async () => {
  const f = fixture();
  const stopFirst = f.start();
  const stopSecond = f.start();

  assert.equal(f.calls.channels, 1);
  stopFirst();
  await settle();
  assert.equal(f.calls.removedChannels, 0);

  stopSecond();
  await settle();
  assert.equal(f.calls.removedChannels, 1);
});

test('development remount starts a fresh channel while the previous teardown finishes', async () => {
  const f = fixture();
  const stopFirst = f.start();
  stopFirst();
  const stopRemount = f.start();

  assert.equal(f.calls.channels, 2);
  assert.notEqual(f.calls.topics[0], f.calls.topics[1]);
  assert.equal(f.calls.removedChannels, 1);

  stopRemount();
  assert.equal(f.calls.removedChannels, 2);
});
