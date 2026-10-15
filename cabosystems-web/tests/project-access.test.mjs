import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/projectAccessCopy.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { PROJECT_COPY, projectError } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('project interface has matching Spanish and English copy', () => {
  assert.deepEqual(Object.keys(PROJECT_COPY.es).sort(), Object.keys(PROJECT_COPY.en).sort());
  for (const language of ['es', 'en']) for (const value of Object.values(PROJECT_COPY[language])) assert.ok(value.trim());
});
test('project errors distinguish conflicts, denied permissions and duplicates', () => {
  for (const language of ['es', 'en']) {
    const c = PROJECT_COPY[language];
    assert.equal(projectError({ code: '40001' }, c), c.conflict);
    assert.equal(projectError({ code: '42501' }, c), c.permissions);
    assert.equal(projectError({ code: '23505' }, c), c.duplicate);
    assert.equal(projectError({ message: 'private SQL or internal details' }, c), c.failed);
    assert.equal(projectError(null, c), c.failed);
  }
});
