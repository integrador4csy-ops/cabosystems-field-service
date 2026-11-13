const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('admin Tracking tab combines a light street map with check history', () => {
  const screen = read('app/(tabs)/maps.tsx');
  const layout = read('app/(tabs)/_layout.tsx');
  const source = read('lib/fleetMap.ts');
  const nativeMap = read('components/LiveFleetMap.native.tsx');
  const routeHistory = read('components/MobileRouteHistory.tsx');
  assert.match(screen, /getFleetMapWorkers/);
  assert.match(screen, /mobile-radar-ubicaciones-en-vivo/);
  assert.match(screen, /export const TrackingSurface = React\.memo/);
  assert.match(screen, /<FleetMapPanel query=\{query\}/);
  assert.match(screen, /export default function TrackingTab\(\)/);
  assert.doesNotMatch(screen, /useFocusEffect/);
  assert.match(layout, /collapsable=\{false\}/);
  assert.match(screen, /<TrackingSurface \/>/);
  assert.match(screen, /ChecksHistoryContent embedded/);
  assert.match(screen, /tracking\.liveMap/);
  assert.match(screen, /tracking\.checks/);
  assert.match(screen, /tracking\.routeHistory/);
  assert.match(layout, /title: t\('nav\.tracking'\)/);
  assert.match(source, /from\('ubicaciones_usuarios'\)/);
  assert.match(source, /from\('profiles'\)/);
  assert.match(nativeMap, /mapType="standard"/);
  assert.match(nativeMap, /userInterfaceStyle="light"/);
  assert.match(nativeMap, /workers\.map/);
  assert.match(nativeMap, /tracksViewChanges=\{trackMarkerViews\}/);
  assert.match(nativeMap, /fitToCoordinates/);
  assert.match(routeHistory, /mapType="standard"/);
  assert.match(routeHistory, /userInterfaceStyle="light"/);
});
