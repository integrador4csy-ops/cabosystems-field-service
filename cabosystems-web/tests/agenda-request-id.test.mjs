import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

test('agenda request keys work without randomUUID on LAN HTTP and retain random 32-hex format', () => {
  const source = ts.transpileModule(readFileSync(new URL('../src/lib/agendaRequestId.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const sandbox = { exports: {}, crypto: { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) } };
  runInNewContext(source, sandbox);
  const keys = Array.from({ length: 100 }, () => sandbox.exports.agendaRequestId());
  assert.ok(keys.every(key => /^[0-9a-f]{32}$/.test(key)));
  assert.equal(new Set(keys).size, keys.length);
});
