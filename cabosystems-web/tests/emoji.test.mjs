import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import vm from 'node:vm';

async function loadSource(path) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2023 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const { emojiToCode, splitEmojiText, getEmojiOnlyCount, getEmojiMessageSize } = await loadSource('../src/lib/emoji.ts');
const { FLUENT_EMOJI_CODES, FLUENT_EMOJI_FILES } = await loadSource('../src/lib/fluentEmojiAssets.ts');
const { EMOJI_CATALOG } = await loadSource('../src/lib/emojiCatalog.ts');

function loadWithDependencies(path, dependencies) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => {
    if (!(name in dependencies)) throw Error(`Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

test('picker offers only bundled 3D artwork, excluding unsupported faces and split sequences', () => {
  const { EMOJI_PICKER_CATALOG } = loadWithDependencies('../src/lib/emojiPickerCatalog.ts', {
    './emojiCatalog': { EMOJI_CATALOG }, './fluentEmojiAssets': { FLUENT_EMOJI_FILES }, './emoji': { emojiToCode },
  });
  assert.ok(EMOJI_PICKER_CATALOG.length > 3000);
  for (const [emoji] of EMOJI_PICKER_CATALOG) {
    const code = FLUENT_EMOJI_FILES.get(emojiToCode(emoji));
    assert.ok(code, emoji);
    assert.ok(existsSync(new URL(`../public/emoji/fluent-3d/${code}.webp`, import.meta.url)), emoji);
  }
  for (const emoji of ['🙂‍↔️', '🙂‍↕️', '🫩', '🫪', '🫯']) assert.ok(!EMOJI_PICKER_CATALOG.some(entry => entry[0] === emoji));
  for (const emoji of ['😂', '❤️', '👍🏽']) assert.ok(EMOJI_PICKER_CATALOG.some(entry => entry[0] === emoji));
});

test('loading artwork never paints native Unicode underneath and picker fallback cannot show missing glyph boxes', () => {
  const jsx = (type, props) => ({ type, props });
  let source = '/emoji.webp';
  const { FluentEmoji } = loadWithDependencies('../src/components/chat/FluentEmoji.tsx', {
    react: { Fragment: 'fragment', useState: () => [null, () => {}] },
    'react/jsx-runtime': { jsx, jsxs: jsx }, '../../lib/emoji': { splitEmojiText },
    '../../lib/emojiPreload': { getFluentEmojiSource: () => source, isEmojiPrepared: () => false },
    './FluentEmoji.css': {},
  });
  const loading = FluentEmoji({ emoji: '😂' });
  assert.equal(loading.props.children[0].props.className, 'fluent-emoji-placeholder');
  assert.equal(loading.props.children[0].props.children, undefined);
  source = null;
  const unsupported = FluentEmoji({ emoji: '🫩', nativeFallback: false });
  assert.equal(unsupported.props.children, undefined);
  assert.equal(FluentEmoji({ emoji: '🫩' }).props.children, '🫩');
});

test('the complete picker includes every Unicode 17 emoji, all categories and skin tones', () => {
  assert.equal(EMOJI_CATALOG.length, 3953);
  assert.equal(new Set(EMOJI_CATALOG.map(([emoji]) => emoji)).size, 3953);
  assert.equal(new Set(EMOJI_CATALOG.map((entry) => entry[4])).size, 9);
  for (const emoji of ['🇲🇽', '👍🏽', '👩🏽‍🔧', '👨‍👩‍👧‍👦', '❤️', '1️⃣', '🏳️‍🌈']) {
    assert.ok(EMOJI_CATALOG.some((entry) => entry[0] === emoji), emoji);
  }
  assert.match(EMOJI_CATALOG.find(([emoji]) => emoji === '❤️')[1], /corazón/i);
  assert.ok(existsSync(new URL('../public/emoji/LICENSE-Unicode.txt', import.meta.url)));
});

test('emoji-only messages count complete sequences, not individual codepoints', () => {
  for (const value of ['😂', '❤️', '👍🏽', '👩🏽‍🔧', '👨‍👩‍👧‍👦', '🇲🇽', '1️⃣', '🏳️‍🌈']) assert.equal(getEmojiOnlyCount(value), 1, value);
  assert.equal(getEmojiOnlyCount('😂 ❤️ 👍🏽'), 3);
  assert.equal(getEmojiOnlyCount('  😂\n❤️  '), 2);
});

test('ordinary text and numbers never become enlarged emoji messages', () => {
  for (const value of ['', '  ', '123', '#', '*', 'Hola 😂', '© CaboSystems', '®', '™', '❤︎']) assert.equal(getEmojiOnlyCount(value), 0, value);
});

test('mixed text retains exact content and complete graphemes', () => {
  const value = 'Listo 👩🏽‍🔧, revisa 1️⃣ y ❤️';
  const parts = splitEmojiText(value);
  assert.equal(parts.map((part) => part.value).join(''), value);
  assert.deepEqual(parts.filter((part) => part.type === 'emoji').map((part) => part.value), ['👩🏽‍🔧', '1️⃣', '❤️']);
});

test('variation selectors normalize without losing skin tones or ZWJ', () => {
  assert.equal(emojiToCode('❤️'), '2764');
  assert.equal(emojiToCode('👍🏽'), '1f44d-1f3fd');
  assert.equal(emojiToCode('👩🏽‍🔧'), '1f469-1f3fd-200d-1f527');
});

test('every catalog entry has a locally hosted asset and every quick emoji is covered', () => {
  assert.ok(FLUENT_EMOJI_CODES.size > 3000);
  for (const code of FLUENT_EMOJI_CODES) assert.ok(existsSync(new URL(`../public/emoji/fluent-3d/${code}.webp`, import.meta.url)), code);
  for (const emoji of ['👍', '❤️', '🔥', '🛠️', '✅', '😂', '👏', '🙏', '⚡', '📍', '📦', '⚠️']) assert.ok(FLUENT_EMOJI_FILES.has(emojiToCode(emoji)), emoji);
  assert.ok(existsSync(new URL('../public/emoji/fluent-3d/LICENSE-Microsoft.txt', import.meta.url)));
});

test('emoji-only sizes stay bounded for long sequences', () => {
  assert.equal(getEmojiMessageSize(1), 72);
  assert.equal(getEmojiMessageSize(3), 52);
  assert.equal(getEmojiMessageSize(6), 36);
  assert.equal(getEmojiMessageSize(50), 24);
});
