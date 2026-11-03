import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
for (const path of ['../src/lib/chatDay.ts', '../../cabosystems-mobile/lib/chatDay.ts']) {
 const module = { exports: {} };
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports, require, setTimeout, clearTimeout });
 const { chatDayKey, chatDayLabel } = module.exports;
 test(path + ': today, yesterday, older dates and midnight/month rollover', () => {
  const now = new Date(2026, 10, 1, 0, 1);
  const today = new Date(2026, 10, 1, 0, 0).toISOString();
  const yesterday = new Date(2026, 9, 31, 23, 59).toISOString();
  const older = new Date(2026, 9, 30, 12).toISOString();
  assert.equal(chatDayLabel(today, 'es', now), 'Hoy');
  assert.equal(chatDayLabel(yesterday, 'es', now), 'Ayer');
  assert.equal(chatDayLabel(yesterday, 'en', now), 'Yesterday');
  assert.match(chatDayLabel(older, 'es', now), /30.*octubre.*2026/);
  assert.notEqual(chatDayKey(today), chatDayKey(yesterday));
  assert.equal(chatDayKey(yesterday), chatDayKey(new Date(2026, 9, 31, 1)));
 });
}
