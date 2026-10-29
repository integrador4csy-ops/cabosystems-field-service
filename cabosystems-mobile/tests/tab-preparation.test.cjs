const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/tabPreparation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const flush = () => new Promise(resolve => setImmediate(resolve));
function setup() {
  const timers = new Map(), idle = new Map(), frames = new Map();
  let next = 0, listener;
  const app = { currentState: 'active', addEventListener: (_, fn) => { listener = fn; return { remove: () => { listener = undefined; } }; } };
  const exports = {};
  vm.runInNewContext(source, {
    exports, console: { warn() {} }, require: () => ({ AppState: app }),
    setTimeout: fn => { timers.set(++next, fn); return next; }, clearTimeout: id => timers.delete(id),
    requestIdleCallback: fn => { idle.set(++next, fn); return next; }, cancelIdleCallback: id => idle.delete(id),
    requestAnimationFrame: fn => { frames.set(++next, fn); return next; }, cancelAnimationFrame: id => frames.delete(id),
  });
  const run = queue => { const entry = queue.entries().next().value; assert.ok(entry); queue.delete(entry[0]); entry[1](); };
  return { ...exports, timers, idle, frames, run, change(state) { app.currentState = state; listener?.(state); } };
}
test('background preparation waits for each request and resumes without overlap', async () => {
  const env = setup(); const calls = []; let finish;
  const stop = env.prepareTabs([
    () => { calls.push('chat'); return new Promise(resolve => { finish = resolve; }); },
    async () => { calls.push('agenda'); },
  ]);
  env.run(env.frames); env.run(env.frames); env.run(env.idle);
  assert.deepEqual(calls, ['chat']); assert.equal(env.idle.size, 0);
  env.change('background'); env.change('active'); assert.equal(env.idle.size, 0);
  finish(); await flush(); assert.equal(env.idle.size, 1);
  env.run(env.idle); await flush(); assert.deepEqual(calls, ['chat', 'agenda']); stop();
});
test('a rejected preparation continues, while logout cancels pending work', async () => {
  const env = setup(); let calls = 0;
  const stop = env.prepareTabs([async () => { throw Error('offline'); }, async () => { calls++; }]);
  env.run(env.frames); env.run(env.frames); env.run(env.idle); await flush();
  assert.equal(env.idle.size, 1); stop(); assert.equal(env.idle.size, 0); assert.equal(calls, 0);
});
test('focus refresh waits for two frames, cancels on quick tab changes, and cleans up after start', () => {
  const env = setup(); let starts = 0, stops = 0;
  const task = () => { starts++; return () => { stops++; }; };
  const cancel = env.afterTabPaint(task);
  env.run(env.frames); assert.equal(starts, 0); cancel(); assert.equal(env.frames.size, 0);
  const stop = env.afterTabPaint(task);
  env.run(env.frames); env.run(env.frames); assert.equal(starts, 1);
  stop(); stop(); assert.equal(stops, 1);
});
test('finishing a request in the background waits until the app is active', async () => {
  const env = setup(); let finish; let calls = 0;
  const stop = env.prepareTabs([() => new Promise(resolve => { finish = resolve; }), async () => { calls++; }]);
  env.run(env.frames); env.run(env.frames); env.run(env.idle); env.change('background'); finish(); await flush();
  assert.equal(env.idle.size, 0); env.change('active'); env.run(env.idle); await flush();
  assert.equal(calls, 1); stop();
});

test('two warmups can progress without waiting for a slow tab, and never start a third concurrently', async () => {
  const env = setup(); const calls = []; const finish = [];
  const stop = env.prepareTabs([0, 1, 2].map(index => () => { calls.push(index); return new Promise(resolve => { finish[index] = resolve; }); }), 2);
  env.run(env.frames); env.run(env.frames);
  env.run(env.idle); env.run(env.idle);
  assert.deepEqual(calls, [0, 1]); assert.equal(env.idle.size, 0);
  finish[1](); await flush(); env.run(env.idle);
  assert.deepEqual(calls, [0, 1, 2]);
  stop(); finish[0](); finish[2](); await flush(); assert.equal(env.idle.size, 0);
});

test('chat uses groups prepared after mount and defers a stale-cache refresh', () => {
  const text = fs.readFileSync(path.join(__dirname, '../app/(tabs)/chat.tsx'), 'utf8');
  const ast = ts.createSourceFile('chat.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useFocusEffect') callback = node.arguments[0].arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const groups = [{ id: 'prepared-group' }]; let cached = groups, rendered, loading = true, scheduled = 0, fetches = 0, refresh;
  const env = {
    profile: { id: 'technician' }, Date, lastFetchRef: { current: 0 },
    getCachedMyChatGroups: (owner, maxAge) => { assert.equal(owner, 'technician'); assert.equal(maxAge, 20000); return cached; },
    setGroups: value => { rendered = value; }, setLoading: value => { loading = value; },
    afterTabPaint: task => { scheduled++; refresh = task; return () => {}; }, loadGroups: () => { fetches++; },
  };
  vm.runInNewContext(`effect = (${callback})`, env);
  env.effect(); assert.equal(rendered, groups); assert.equal(loading, false); assert.equal(scheduled, 0); assert.equal(fetches, 0);
  cached = null; env.effect(); assert.equal(scheduled, 1); assert.equal(fetches, 0);
  refresh(); assert.equal(fetches, 1);
});
