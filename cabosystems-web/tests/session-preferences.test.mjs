import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/sessionPreferences.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { readSessionPreference, writeSessionPreference, isNavigationItem, isStringPreference } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('reload restores every supported section and the agenda preferences', () => {
  const storage = new Map();
  globalThis.sessionStorage = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  try {
    assert.equal(readSessionPreference('section', 'radar', isNavigationItem), 'radar');
    for (const section of ['agenda', 'proyectos', 'directorio-proyectos', 'chat', 'colaboradores', 'invitaciones', 'radar']) {
      writeSessionPreference('section', section);
      assert.equal(readSessionPreference('section', 'radar', isNavigationItem), section);
    }
    for (const [key, value] of [['date', '2026-10-23'], ['view', 'week'], ['status', 'en_proceso'], ['project', 'villa-14']]) {
      writeSessionPreference(key, value);
      assert.equal(readSessionPreference(key, '', isStringPreference), value);
    }
    storage.set('section', JSON.stringify('unknown-section'));
    assert.equal(readSessionPreference('section', 'radar', isNavigationItem), 'radar');
    storage.set('section', '{broken');
    assert.equal(readSessionPreference('section', 'radar', isNavigationItem), 'radar');
    storage.set('section', '42');
    assert.equal(readSessionPreference('section', 'radar', isNavigationItem), 'radar');
  } finally { delete globalThis.sessionStorage; }
});

test('unavailable browser storage leaves navigation usable', () => {
  globalThis.sessionStorage = { getItem() { throw new Error('Storage blocked'); }, setItem() { throw new Error('Storage blocked'); } };
  try {
    assert.equal(readSessionPreference('section', 'radar', isNavigationItem), 'radar');
    assert.doesNotThrow(() => writeSessionPreference('section', 'agenda'));
  } finally { delete globalThis.sessionStorage; }
});
