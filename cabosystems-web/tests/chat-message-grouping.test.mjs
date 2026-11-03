import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const module = { exports: {} };
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/chatMessageGrouping.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module, exports: module.exports });
const { startsSenderGroup } = module.exports;
test('only sender changes start a block, including consecutive messages on different dates', () => {
 const messages = [
  {remitente_id:'me', created_at:'2026-10-29'},
  {remitente_id:'me', created_at:'2026-10-30'},
  {remitente_id:'other'}, {remitente_id:'other'}, {remitente_id:'me'},
 ];
 assert.deepEqual(messages.map((_, i) => startsSenderGroup(messages, i)), [true,false,true,false,true]);
});
