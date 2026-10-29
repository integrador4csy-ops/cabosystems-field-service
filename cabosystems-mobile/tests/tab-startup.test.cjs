const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
function load(file) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { exports, require, Map, Object });
  return exports;
}
test('warmup waits for main readiness and resets for another account', async () => {
  const { TabStartupProvider, useTabStartup } = load('tabStartup.tsx');
  let startup, renderer;
  function Probe() { startup = useTabStartup(); return null; }
  const render = owner => React.createElement(TabStartupProvider, { key: owner }, React.createElement(Probe));
  try {
    await React.act(async () => { renderer = Renderer.create(render('a')); });
    assert.equal(startup.mainReady, false);
    await React.act(async () => { startup.markMainReady(); }); assert.equal(startup.mainReady, true);
    await React.act(async () => { renderer.update(render('b')); }); assert.equal(startup.mainReady, false);
  } finally { if (renderer) await React.act(async () => renderer.unmount()); }
});
test('agenda preparation rebuilds only changed pages and bounds retained trees', () => {
  const { AgendaPreviewCache } = load('agendaPreviewCache.ts');
  const cache = new AgendaPreviewCache(); let builds = 0; const events = [];
  const render = () => ({ id: ++builds });
  const first = cache.get('month-a', [events, 'es'], render);
  assert.equal(cache.get('month-a', [events, 'es'], render), first);
  cache.get('month-b', [[], 'es'], render);
  assert.equal(cache.get('month-a', [events, 'es'], render), first);
  assert.notEqual(cache.get('month-a', [events, 'en'], render), first);
  for (let i = 0; i < 7; i++) cache.get(`month-${i}`, [events], render);
  const before = builds; cache.get('month-a', [events, 'en'], render); assert.equal(builds, before + 1);
});

test('sliding the preview window builds only its two new pages on consecutive moves', () => {
  const { AgendaPreviewCache } = load('agendaPreviewCache.ts');
  const cache = new AgendaPreviewCache(); let builds = 0; const events = [];
  function windowAt(center) {
    const keys = [-1, -2, -3, 1, 2, 3].map(offset => String(center + offset));
    cache.retain(keys);
    return keys.map(key => cache.get(key, [events], () => ({ key, build: ++builds })));
  }
  const first = windowAt(0); assert.equal(builds, 6);
  const second = windowAt(1); assert.equal(builds, 8);
  assert.equal(second.find(page => page.key === '2'), first.find(page => page.key === '2'));
  windowAt(2); assert.equal(builds, 10);
  windowAt(3); assert.equal(builds, 12);
});

test('layout starts no preloads before Main and cancels late route preparation on logout', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../app/(tabs)/_layout.tsx'), 'utf8');
  const ast = ts.createSourceFile('tabs.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0].getText(ast).includes('prepareTabs(')) callback = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert.ok(callback);
  const prepared = []; let queued, stopped = false, finish;
  const env = {
    mainReady: false, profile: { id: 'a', activo: true }, isAdmin: true,
    router: { prefetch: route => prepared.push(route) },
    prepareTabs: (tasks, concurrency) => { queued = tasks; assert.equal(concurrency, 2); return () => { stopped = true; }; },
    preloadAgendaData: () => new Promise(resolve => { finish = resolve; }),
    preloadMyChatGroups: async () => [], preloadUsersData: async () => {},
  };
  vm.runInNewContext(ts.transpileModule(`globalThis.start = (${callback});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, env);
  assert.equal(env.start(), undefined); assert.equal(queued, undefined);
  env.mainReady = true; const stop = env.start();
  const pending = queued[0](); stop(); finish(); await pending;
  assert.equal(stopped, true); assert.equal(prepared.length, 0);
});
