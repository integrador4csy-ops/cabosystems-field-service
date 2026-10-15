const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const root = path.join(__dirname, '..');
function load(file, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, require: (name) => { if (name in imports) return imports[name]; throw new Error(`Unexpected import ${name}`); }, console, Intl, URL, Date, Map, Set }, { filename: file });
  return module.exports;
}
const emoji = load('lib/chatEmoji.ts');
const { EMOJI_CATALOG } = load('lib/emojiCatalog.ts');
const { CHAT_COPY } = load('lib/chatCopy.ts');
const gesture = load('lib/chatGestures.ts');
const reactionLayout = load('lib/chatReactionLayout.ts');

test('quick reactions anchor above the selected bubble and stay inside the conversation', () => {
  const viewport = { x: 0, y: 100, width: 390, height: 620 };
  const root = { x: 0, y: 20, width: 390, height: 800 };
  const incoming = reactionLayout.getReactionBarLayout({ x: 16, y: 480, width: 130, height: 60 }, viewport, root, false);
  assert.equal(incoming.top, 400);
  assert.equal(incoming.left, 16);
  const outgoing = reactionLayout.getReactionBarLayout({ x: 200, y: 480, width: 174, height: 60 }, viewport, root, true);
  assert.equal(outgoing.left + outgoing.width, 374);
  const topmost = reactionLayout.getReactionBarLayout({ x: 10, y: 105, width: 140, height: 60 }, viewport, root, false);
  assert.ok(topmost.top + root.y >= viewport.y);
  assert.equal(reactionLayout.getReactionBarLayout({ x: 10, y: -100, width: 140, height: 60 }, viewport, root, false), null);
  const narrow = reactionLayout.getReactionBarLayout({ x: 10, y: 500, width: 140, height: 60 }, { ...viewport, width: 320 }, root, false);
  assert.ok(narrow.left >= 8 && narrow.left + narrow.width <= 312);
});

test('complete sequences survive insertion and rendering, without Intl.Segmenter', () => {
  for (const value of ['😂', '❤️', '👍🏽', '👩🏽‍🔧', '👨‍👩‍👧‍👦', '🇲🇽', '1️⃣', '🏳️‍🌈']) {
    assert.equal(emoji.getEmojiOnlyCount(value), 1, value);
    assert.equal(emoji.splitEmojiText(`Hola ${value}`).map((part) => part.value).join(''), `Hola ${value}`);
  }
  for (const value of ['123', '© CaboSystems', '®', '™', '❤︎', 'Hola 😂', '']) assert.equal(emoji.getEmojiOnlyCount(value), 0, value);
  assert.equal(emoji.getEmojiOnlyCount('😂 ❤️ 👍🏽'), 3);
  for (const [value] of EMOJI_CATALOG) assert.equal(emoji.getEmojiOnlyCount(value), 1, value);
  const inserted = emoji.insertEmoji('Hola equipo', '👩🏽‍🔧', { start: 5, end: 11 });
  assert.equal(inserted.text, 'Hola 👩🏽‍🔧');
  assert.equal(inserted.cursor, inserted.text.length);
});

test('swipe right replies after the threshold and never hijacks vertical scrolling', () => {
  assert.equal(gesture.shouldStartReplyGesture(24, 3), true);
  for (const [dx, dy] of [[3, 24], [22, 30], [-70, 0], [5, 0], [18, 13]]) assert.equal(gesture.shouldStartReplyGesture(dx, dy), false);
  assert.equal(gesture.shouldCompleteReplyGesture(60, 0), true);
  for (const [dx, dy] of [[59, 0], [-80, 0], [90, 50]]) assert.equal(gesture.shouldCompleteReplyGesture(dx, dy), false);
});

test('mobile and web use the same full catalog and the mobile artwork is bundled offline', () => {
  assert.equal(EMOJI_CATALOG.length, 3953);
  assert.equal(new Set(EMOJI_CATALOG.map((entry) => entry[0])).size, 3953);
  assert.equal(fs.readFileSync(path.join(root, 'lib/emojiCatalog.ts'), 'utf8'), fs.readFileSync(path.join(root, '../cabosystems-web/src/lib/emojiCatalog.ts'), 'utf8'));
  const manifest = fs.readFileSync(path.join(root, 'lib/fluentEmojiAssets.ts'), 'utf8');
  const keys = new Set();
  for (const match of manifest.matchAll(/'([^']+)': require\('([^']+)'\)/g)) {
    assert.equal(keys.has(match[1]), false, `Duplicate ${match[1]}`); keys.add(match[1]);
    assert.equal(fs.existsSync(path.resolve(root, 'lib', match[2])), true, match[2]);
  }
  assert.ok(keys.size > 3300);
  for (const value of ['👍', '❤️', '😂', '😮', '😢', '🙏', '🇲🇽']) assert.ok(keys.has(emoji.emojiToCode(value)), value);
  assert.deepEqual(Object.keys(CHAT_COPY.es).sort(), Object.keys(CHAT_COPY.en).sort());
});

function apiWith(responses) {
  const calls = [];
  const queue = responses.slice();
  class Query {
    constructor(table) { this.table = table; }
    then(resolve, reject) { if (!queue.length) throw new Error('Missing mock response'); return Promise.resolve(queue.shift()).then(resolve, reject); }
    single() { return this; } maybeSingle() { return this; }
  }
  for (const name of ['select', 'eq', 'order', 'limit', 'in', 'delete', 'insert']) Query.prototype[name] = function (...args) { calls.push([this.table, name, ...args]); return this; };
  const supabase = { from: (table) => new Query(table), functions: { invoke: async () => ({ data: null, error: null }) } };
  return { api: load('lib/chatApi.ts', { './supabase': { supabase } }), calls };
}
test('sending a reply preserves the original message ID and Unicode content', async () => {
  const { api, calls } = apiWith([{ data: { id: 'sent' }, error: null }]);
  await api.sendChatMessage({ grupo_id: 'group', remitente_id: 'sender', tipo: 'texto', contenido: 'Listo 👩🏽‍🔧', reply_to_id: 'original' });
  const payload = calls.find((call) => call[1] === 'insert')[2];
  assert.equal(payload.reply_to_id, 'original');
  assert.equal(payload.contenido, 'Listo 👩🏽‍🔧');
});
test('quoted originals are loaded together, even outside the latest message window', async () => {
  const { api, calls } = apiWith([{ data: [{ id: 'reply', reply_to_id: 'original' }], error: null }, { data: [{ id: 'original', contenido: 'Original' }], error: null }]);
  const messages = await api.getGroupMessages('group');
  assert.equal(messages[0].reply.contenido, 'Original');
  assert.equal(calls.filter((call) => call[1] === 'in').length, 1);
});
test('failed or unauthorized mutations are reported rather than removed locally', async () => {
  await assert.rejects(apiWith([{ data: [], error: null }]).api.deleteChatMessage('id'), /permission/);
  await assert.rejects(apiWith([{ data: [], error: null }]).api.unpinChatMessage('id'), /permission/);
  const dbError = { message: 'Network unavailable' };
  await assert.rejects(apiWith([{ data: null, error: dbError }]).api.toggleChatReaction('id', 'user', '👍'), (error) => error === dbError);
  const { api, calls } = apiWith([{ data: null, error: null }]);
  await api.pinChatMessage({ id: 'message', grupo_id: 'group' }, 'user');
  assert.equal(calls.find((call) => call[1] === 'insert')[2].grupo_id, 'group');
  await assert.rejects(apiWith([{ data: null, error: dbError }]).api.getMyStickers('user'), (error) => error === dbError);
});

const { createStickerLibraryCache } = load('lib/stickerLibraryCache.ts');
const sticker = (id, user = 'user') => ({ id, profile_id: user, nombre: id, url: `https://example.test/${id}.webp`, pack_name: 'Pack', created_at: '2026-10-15T00:00:00Z' });

test('stickers appear from disk before network finishes, and remain available offline', async () => {
  let rejectNetwork, started;
  const networkStarted = new Promise(resolve => { started = resolve; });
  let writes = 0;
  const cache = createStickerLibraryCache({
    read: async () => JSON.stringify({ version: 1, items: [sticker('saved')] }),
    write: async () => { writes++; }, warm: () => {},
    fetch: () => { started(); return new Promise((_, reject) => { rejectNetwork = reject; }); },
  });
  const pending = cache.prepare('user');
  await networkStarted;
  assert.equal(cache.snapshot('user').items[0].id, 'saved');
  rejectNetwork(Error('offline'));
  await pending;
  assert.equal(cache.snapshot('user').items[0].id, 'saved');
  assert.equal(writes, 0);
  assert.equal(cache.snapshot('other').items, null);
});

test('sticker refreshes are shared, throttled, and persisted for the next app session', async () => {
  let calls = 0, clock = 0;
  let disk = null;
  const deps = { read: async () => disk, write: async (_, value) => { disk = value; }, warm: () => {}, now: () => clock,
    fetch: async () => { calls++; return [sticker('remote')]; } };
  const cache = createStickerLibraryCache(deps);
  const first = cache.prepare('user');
  assert.equal(cache.prepare('user'), first);
  await first;
  await cache.prepare('user');
  assert.equal(calls, 1);
  clock = 61_000;
  await cache.prepare('user');
  assert.equal(calls, 2);
  const restarted = createStickerLibraryCache({ ...deps, fetch: async () => { throw Error('offline'); } });
  await restarted.prepare('user');
  assert.equal(restarted.snapshot('user').items[0].id, 'remote');
});

test('a delayed refresh cannot remove a sticker imported while the request was running', async () => {
  let finishNetwork, started;
  const networkStarted = new Promise(resolve => { started = resolve; });
  const disk = [];
  const cache = createStickerLibraryCache({ read: async () => null, write: async (_, value) => { disk.push(value); }, warm: () => {},
    fetch: () => { started(); return new Promise(resolve => { finishNetwork = resolve; }); } });
  const pending = cache.prepare('user');
  await networkStarted;
  await cache.add('user', sticker('imported'));
  finishNetwork([sticker('old')]);
  await pending;
  assert.equal(cache.snapshot('user').items.map(item => item.id).join(','), 'imported,old');
  assert.equal(JSON.parse(disk.at(-1)).items[0].id, 'imported');
});

test('invalid local data and other accounts never leak into a sticker library', async () => {
  const cache = createStickerLibraryCache({
    read: async () => JSON.stringify({ version: 1, items: [sticker('mine'), sticker('other', 'someone-else'), sticker('mine'), { id: 'bad' }] }),
    write: async () => {}, warm: () => {}, fetch: async () => { throw Error('offline'); },
  });
  await cache.prepare('user');
  assert.equal(cache.snapshot('user').items.length, 1);
  assert.equal(cache.snapshot('user').items[0].id, 'mine');
  const corrupt = createStickerLibraryCache({ read: async () => '{broken', write: async () => {}, warm: () => {}, fetch: async () => [sticker('fresh')] });
  await corrupt.prepare('user');
  assert.equal(corrupt.snapshot('user').items[0].id, 'fresh');
});

test('image warmup is bounded to the initial screen, deduplicated and tolerant of failures', async () => {
  const initial = [...new Set(['👍', '❤️', '😂', '😮', '😢', '🙏', ...EMOJI_CATALOG.filter(entry => entry[4] === 'smileys').slice(0, 32).map(entry => entry[0])])];
  const assets = Object.fromEntries(initial.map((value, index) => [emoji.emojiToCode(value), index + 1]));
  let active = 0, peak = 0, decoded = 0, downloaded = 0;
  let decodeFailed = false, downloadFailed = false;
  const warmup = load('lib/chatMediaWarmup.ts', {
    './emojiCatalog': { EMOJI_CATALOG }, './fluentEmojiAssets': { FLUENT_EMOJI_ASSETS: assets }, './chatEmoji': emoji,
    'expo-image': { Image: {
      async loadAsync(source) { active++; peak = Math.max(peak, active); decoded++; await new Promise(setImmediate); active--; if (source === 1 && !decodeFailed) { decodeFailed = true; throw Error('decode failed'); } return { source }; },
      async prefetch(url) { downloaded++; if (url.endsWith('/0.webp') && !downloadFailed) { downloadFailed = true; return false; } return true; },
    } },
  });
  await Promise.all([warmup.prepareChatEmojis(), warmup.prepareChatEmojis()]);
  assert.equal(decoded, initial.length);
  assert.ok(peak <= 4, `Decoding concurrency was ${peak}`);
  assert.ok(decoded <= 38);
  assert.equal(warmup.getPreparedEmoji(initial[0]), undefined);
  await warmup.prepareChatEmojis();
  assert.equal(decoded, initial.length + 1);
  assert.ok(warmup.getPreparedEmoji(initial[0]));
  const images = Array.from({ length: 100 }, (_, index) => sticker(String(index)));
  await warmup.warmStickerImages(images);
  await warmup.warmStickerImages(images);
  assert.equal(downloaded, 25);
  await warmup.warmStickerImages(images);
  assert.equal(downloaded, 25);
});
