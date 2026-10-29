const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function setup(task, state = 'active') {
  const timers = new Map(); let listener; let next = 0;
  const app = { currentState: state, addEventListener: (_, callback) => { listener = callback; return { remove: () => { listener = null; } }; } };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/foregroundPolling.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: () => ({ AppState: app }), setTimeout: fn => { timers.set(++next, fn); return next; }, clearTimeout: id => timers.delete(id) });
  const stop = module.exports.startForegroundPolling(task, 10000);
  return { timers, stop, change(state) { app.currentState = state; listener?.(state); }, tick() { const [id, fn] = timers.entries().next().value; timers.delete(id); fn(); } };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('pauses while backgrounded, refreshes on resume, and cleans up', async () => {
  let calls = 0; const poll = setup(() => { calls++; });
  await flush(); assert.equal(calls, 1); assert.equal(poll.timers.size, 1);
  poll.change('background'); assert.equal(poll.timers.size, 0);
  poll.change('active'); await flush(); assert.equal(calls, 2);
  poll.stop(); assert.equal(poll.timers.size, 0);
  poll.change('active'); assert.equal(calls, 2);
});
test('never overlaps a slow request, including rapid resume, or schedules after disposal', async () => {
  let resolve; let calls = 0;
  const poll = setup(() => { calls++; return new Promise(done => { resolve = done; }); });
  poll.change('background'); poll.change('active');
  assert.equal(calls, 1); assert.equal(poll.timers.size, 0);
  poll.stop(); resolve(); await flush(); assert.equal(poll.timers.size, 0);
});
test('starts idle in background and retries after failures', async () => {
  let calls = 0; const poll = setup(async () => { calls++; throw Error('offline'); }, 'background');
  assert.equal(calls, 0); poll.change('active'); await flush();
  assert.equal(poll.timers.size, 1); poll.tick(); await flush(); assert.equal(calls, 2); poll.stop();
});
