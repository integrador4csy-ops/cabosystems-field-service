const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise the actual synchronization effect with controlled focus and API
// responses, without mounting the native camera or a navigation container.
const source = fs.readFileSync(path.join(__dirname, '../app/checkin/[id].tsx'), 'utf8');
const ast = ts.createSourceFile('checkin.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let effect;
function visit(node) {
  if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('async function determineTypeAndVilla')) effect = node.arguments[0].getText(ast);
  ts.forEachChild(node, visit);
}
visit(ast);
assert.ok(effect, 'Check-in project synchronization effect exists');
function run(overrides = {}) {
  const writes = [];
  const sandbox = {
    cameraActive: true, user: { id: 'person' }, id: 'old', type: 'check_in',
    projects: [{ id: 'old' }, { id: 'new' }], selectedProject: { id: 'new' },
    manualVillaRef: { current: null }, villaSelectionKey: 'route',
    setProjectLoading() {}, setIsCheckOut() {},
    setCurrentProject: project => writes.push(['current', project?.id]),
    setSelectedProject: project => writes.push(['global', project.id]),
    getLatestFieldRecord: async () => null, getTaskById: async () => null,
    console, ...overrides,
  };
  const code = ts.transpileModule(`globalThis.effect = (${effect});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, sandbox);
  const cleanup = sandbox.effect();
  return { writes, cleanup };
}
test('inactive Checks cannot overwrite a villa selected in Tasks', () => {
  const { writes } = run({ cameraActive: false });
  assert.deepEqual(writes, []);
});
test('visible Checks still resolves an explicitly opened villa', () => {
  const { writes } = run();
  assert.deepEqual(writes, [['current', 'old'], ['global', 'old']]);
});
test('a pending lookup cannot overwrite the villa after leaving Checks', async () => {
  let resolve;
  const pending = new Promise(value => { resolve = value; });
  const { writes, cleanup } = run({ id: 'task-id', getTaskById: () => pending });
  cleanup();
  resolve({ proyecto_id: 'old' });
  await pending;
  await Promise.resolve();
  assert.deepEqual(writes, []);
});

test('choosing another villa survives synchronization with the original route', () => {
  const { writes } = run({ manualVillaRef: { current: { key: 'route', projectId: 'new' } } });
  assert.deepEqual(writes, [['current', 'new'], ['global', 'new']]);
});

test('a new route does not reuse a manual selection from the previous route', () => {
  const { writes } = run({ manualVillaRef: { current: { key: 'previous-route', projectId: 'new' } } });
  assert.deepEqual(writes, [['current', 'old'], ['global', 'old']]);
});

test('a delayed task lookup respects a villa selected while it was in flight', async () => {
  let resolve;
  const pending = new Promise(value => { resolve = value; });
  const manualVillaRef = { current: null };
  const { writes } = run({ id: 'task-id', manualVillaRef, getTaskById: () => pending });
  manualVillaRef.current = { key: 'route', projectId: 'new' };
  resolve({ proyecto_id: 'old' });
  await pending; await new Promise(done => setImmediate(done));
  assert.deepEqual(writes, [['current', 'new'], ['global', 'new']]);
});
