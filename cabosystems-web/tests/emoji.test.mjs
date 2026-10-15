import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function loadSource(path) {
  const compiled = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2023 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const { emojiToCode, splitEmojiText, getEmojiOnlyCount, getEmojiMessageSize } = await loadSource('../src/lib/emoji.ts');
const { FLUENT_EMOJI_CODES, FLUENT_EMOJI_FILES } = await loadSource('../src/lib/fluentEmojiAssets.ts');
const { EMOJI_CATALOG } = await loadSource('../src/lib/emojiCatalog.ts');

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
