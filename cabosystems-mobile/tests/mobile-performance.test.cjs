const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./chat-test-helpers.cjs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const tick = () => new Promise(resolve => setImmediate(resolve));

test('event bursts become one read plus at most one follow-up while a read is pending', async () => {
  const { createKeyedRefreshQueue } = load('keyedRefreshQueue.ts');
  const queue = createKeyedRefreshQueue(1);
  let calls = 0, release;
  const task = async () => { calls++; if (calls === 1) await new Promise(resolve => { release = resolve; }); };
  for (let i = 0; i < 50; i++) queue.enqueue('room', task);
  await sleep(20); assert.equal(calls, 1);
  for (let i = 0; i < 50; i++) queue.enqueue('room', task);
  await sleep(20); assert.equal(calls, 1);
  release(); await sleep(20); assert.equal(calls, 2);
  queue.enqueue('room', task); queue.dispose(); await sleep(20);
  assert.equal(calls, 2);
});

test('poster generation bounds resolution and releases native resources after success or failure', async () => {
  for (const fail of [false, true]) {
    const released = [];
    const player = { replaceAsync: async () => {}, generateThumbnailsAsync: async (_, options) => {
      assert.equal(options.maxWidth, 480);
      if (fail) throw Error('decode failed');
      return [{ release: () => released.push('thumbnail') }];
    }, release: () => released.push('player') };
    const { createChatVideoPoster } = load('chatVideoPoster.ts', {
      'expo-video': { createVideoPlayer: () => player },
      'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({
        release: () => released.push('context'), renderAsync: async () => ({
          saveAsync: async () => ({ uri: 'file:///poster.jpg' }), release: () => released.push('image'),
        }),
      }) } },
    });
    if (fail) { await assert.rejects(createChatVideoPoster('clip'), /decode/); assert.deepEqual(released, ['player']); }
    else { assert.equal(await createChatVideoPoster('clip'), 'file:///poster.jpg'); assert.deepEqual(released, ['image', 'context', 'thumbnail', 'player']); }
  }
});

test('concurrent location callbacks cannot overlap network writes, and a failed send unlocks the next one', async () => {
  let callback, release, writes = 0;
  load('liveTrackingService.ts', {
    './localization': { translateCurrent: x => x },
    'react-native': { Platform: { OS: 'web' } },
    'expo-location': {},
    'expo-battery': { getBatteryLevelAsync: async () => 0.5, getBatteryStateAsync: async () => 1, BatteryState: { CHARGING: 2, FULL: 3 } },
    'expo-task-manager': { defineTask: (_, handler) => { callback = handler; } },
    'expo-secure-store': { getItemAsync: async () => 'u' },
    './supabase': { supabase: { from: () => ({ upsert: () => { writes++; return new Promise(resolve => { release = resolve; }); }, insert: async () => ({}) }) } },
    './activityRecognitionService': { classifyActivity: () => 'still' },
    './locationHistorySampling': { shouldRecordLocationHistory: () => true },
    './kalmanLocationFilter': { globalKalmanFilter: { filter: (latitude, longitude, accuracy) => ({ latitude, longitude, accuracy }) } },
    '@/components/BackgroundLocationModal': {},
  });
  const event = { data: { locations: [{ coords: { latitude: 1, longitude: 2, accuracy: 5, speed: 0 } }] } };
  const first = callback(event); await tick();
  const second = callback(event); await tick();
  assert.equal(writes, 1);
  release({ error: { message: 'test offline' } }); await Promise.all([first, second]);
  const next = callback(event); await tick(); assert.equal(writes, 2);
  release({ error: null }); await next;
});
