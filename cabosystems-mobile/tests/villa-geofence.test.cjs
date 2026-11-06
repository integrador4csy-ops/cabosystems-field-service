const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const exportsObject = {};
const source = fs.readFileSync(path.join(__dirname, '../lib/villaGeofence.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
vm.runInNewContext(compiled, { exports: exportsObject, Math, Number, Boolean });

const {
  distanceBetweenCoordinatesMeters,
  hasVillaCoordinates,
  isInsideVillaGeofence,
  villaGeofenceRadius,
} = exportsObject;

test('villa coordinates require a complete valid latitude and longitude pair', () => {
  assert.equal(hasVillaCoordinates({ latitud: 22.89, longitud: -109.91 }), true);
  assert.equal(hasVillaCoordinates({ latitud: 22.89, longitud: null }), false);
  assert.equal(hasVillaCoordinates({ latitud: 91, longitud: -109.91 }), false);
});

test('distance and configured radius determine geofence membership', () => {
  const villa = { radio_geocerca_m: 150 };
  const nearby = distanceBetweenCoordinatesMeters(
    { latitude: 22.8905, longitude: -109.9167 },
    { latitude: 22.891, longitude: -109.9167 },
  );
  assert.ok(nearby > 50 && nearby < 60);
  assert.equal(villaGeofenceRadius(villa), 150);
  assert.equal(isInsideVillaGeofence(villa, nearby), true);
  assert.equal(isInsideVillaGeofence(villa, 151), false);
  assert.equal(villaGeofenceRadius({}), 150);
});
