const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('unchanged focus refreshes preserve palette identity without loading flashes', async () => {
  const source = ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname, '../lib/useCalendarColors.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {}; let next = { local: '#f78c26' }, fail = false;
  vm.runInNewContext(source, { exports, require: name => name === 'react' ? React : {
    getCalendarColors: async () => { if (fail) throw Error('offline'); return { ...next }; },
    saveCalendarColor: async () => {},
  } });
  let value, renderer; const snapshots = [];
  function Probe() { value = exports.useCalendarColors('technician'); snapshots.push(value); return null; }
  try {
    await React.act(async () => { renderer = Renderer.create(React.createElement(Probe)); });
    const original = value.colors; snapshots.length = 0;
    await React.act(async () => { await value.reload(); });
    assert.equal(value.colors, original);
    assert.ok(snapshots.every(snapshot => !snapshot.loading));
    next = { local: '#343e48' };
    await React.act(async () => { await value.reload(); });
    assert.notEqual(value.colors, original); assert.equal(value.colors.local, '#343e48');
    fail = true;
    await React.act(async () => { await value.reload(); });
    assert.equal(value.failed, true); assert.equal(value.colors.local, '#343e48');
  } finally { if (renderer) await React.act(async () => renderer.unmount()); }
});
