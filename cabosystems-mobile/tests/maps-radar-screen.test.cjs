const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('admin Maps tab renders the live fleet on a standard street map', () => {
  const screen = read('app/(tabs)/maps.tsx');
  const source = read('lib/fleetMap.ts');
  const nativeMap = read('components/LiveFleetMap.native.tsx');
  assert.match(screen, /getFleetMapWorkers/);
  assert.match(screen, /mobile-radar-ubicaciones-en-vivo/);
  assert.match(source, /from\('ubicaciones_usuarios'\)/);
  assert.match(source, /from\('profiles'\)/);
  assert.match(nativeMap, /mapType="standard"/);
  assert.match(nativeMap, /workers\.map/);
  assert.match(nativeMap, /fitToCoordinates/);
});
