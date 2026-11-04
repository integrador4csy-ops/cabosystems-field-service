const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadSampling() {
  const filePath = path.join(__dirname, '../lib/locationHistorySampling.ts');
  const code = fs.readFileSync(filePath, 'utf8');
  const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const fn = new Function('module', 'exports', js);
  fn(module, module.exports);
  return module.exports;
}

test('locationHistorySampling records first point and regulates interval by movement speed', () => {
  const { shouldRecordLocationHistory } = loadSampling();

  assert.equal(shouldRecordLocationHistory(undefined, 1000, 0), true, 'first reading is recorded');
  assert.equal(shouldRecordLocationHistory(1000, 1000, 0), false, 'same timestamp ignored');
  assert.equal(shouldRecordLocationHistory(1000, 999, 0), false, 'past timestamp ignored');

  // Moving (speed >= 2.5 km/h) -> 30s threshold
  assert.equal(shouldRecordLocationHistory(1000, 1000 + 10_000, 20), false, 'moving 10s too early');
  assert.equal(shouldRecordLocationHistory(1000, 1000 + 29_999, 20), false, 'moving 29.9s too early');
  assert.equal(shouldRecordLocationHistory(1000, 1000 + 30_000, 20), true, 'moving at 30s allowed');
  assert.equal(shouldRecordLocationHistory(1000, 1000 + 45_000, 20), true, 'moving after 30s allowed');

  // Stopped (speed < 2.5 km/h) -> 120s threshold
  assert.equal(shouldRecordLocationHistory(1000, 1000 + 30_000, 0), false, 'stopped at 30s ignored');
  assert.equal(shouldRecordLocationHistory(1000, 1000 + 119_999, 1.2), false, 'stopped at 119.9s ignored');
  assert.equal(shouldRecordLocationHistory(1000, 1000 + 120_000, 1.2), true, 'stopped at 120s allowed');
  assert.equal(shouldRecordLocationHistory(1000, 1000 + 150_000, 0), true, 'stopped after 120s allowed');
});
