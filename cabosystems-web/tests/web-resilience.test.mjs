import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { Component } from 'react';

function load(path, dependencies, globals = {}) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll('import.meta.env.BASE_URL', "'/app/'");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, console, require: name => {
    if (!(name in dependencies)) throw Error(`Unexpected import ${name}`);
    return dependencies[name];
  }, ...globals });
  return exports;
}

test('startup warms all artwork while limiting retained decoded images to 12 MiB', async () => {
  let requests = 0; let decodes = 0; let active = 0; let maxActive = 0;
  class Image {
    naturalWidth = 512; naturalHeight = 512;
    set src(source) {
      requests++; active++; maxActive = Math.max(maxActive, active);
      queueMicrotask(() => {
        active--;
        if (source.endsWith('/0.webp')) this.onerror();
        else this.onload();
      });
    }
    async decode() { decodes++; }
  }
  const catalog = Array.from({ length: 200 }, (_, i) => [String(i), '', '', '', 'smileys']);
  const api = load('../src/lib/emojiPreload.ts', {
    './emojiCatalog': { EMOJI_CATALOG: catalog }, './emoji': { emojiToCode: value => value },
    './fluentEmojiAssets': { FLUENT_EMOJI_FILES: new Map(catalog.map(([value]) => [value, value])) },
  }, { Image, localStorage: { getItem: () => '[]' } });
  const first = api.prepareChatEmojis();
  assert.equal(api.prepareChatEmojis(), first);
  await first;
  assert.equal(requests, 200);
  assert.ok(maxActive <= 4);
  assert.equal(decodes, 95);
  const retained = catalog.filter(([emoji]) => api.isEmojiPrepared(api.getFluentEmojiSource(emoji)));
  assert.equal(retained.length, 12);
  assert.equal(api.isEmojiPrepared('/app/emoji/fluent-3d/0.webp'), false);
  assert.equal(api.isEmojiPrepared('/app/emoji/fluent-3d/199.webp'), false);
});

test('view errors render a recovery action and healthy views keep their content', () => {
  let reloads = 0;
  const jsx = (type, props) => ({ type, props });
  const { ViewErrorBoundary, ViewErrorFallback } = load('../src/components/layout/ViewErrorBoundary.tsx', {
    react: { Component }, 'react/jsx-runtime': { jsx, jsxs: jsx },
    '../../context/LanguageContext': { useTranslation: () => ({ t: text => text }) },
  }, { window: { location: { reload: () => reloads++ } } });
  const fallback = ViewErrorFallback();
  const boundary = new ViewErrorBoundary({ children: 'healthy-section', fallback });
  assert.equal(boundary.render(), 'healthy-section');
  boundary.state = ViewErrorBoundary.getDerivedStateFromError(new Error('chunk unavailable'));
  assert.equal(boundary.render().props.role, 'alert');
  boundary.render().props.children[1].props.onClick();
  assert.equal(reloads, 1);
});
