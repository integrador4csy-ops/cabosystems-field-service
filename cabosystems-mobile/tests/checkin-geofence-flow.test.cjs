const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('check-in offers an optional geofence only when the villa has no coordinates', () => {
  const screen = read('app/checkin/[id].tsx');
  assert.match(screen, /!isCheckOut && !hasVillaCoordinates\(currentProject\)/);
  assert.match(screen, /setGeofenceStep\('prompt'\)/);
  assert.match(screen, /continueWithoutGeofence/);
  assert.match(screen, /completeSubmission\(location, geofenceDraft\)/);
});

test('the native editor presents a movable pin and visible radius circle', () => {
  const map = read('components/VillaGeofenceMap.native.tsx');
  const modal = read('components/VillaGeofenceRegistrationModal.tsx');
  assert.match(map, /<Circle/);
  assert.match(map, /<Marker/);
  assert.match(map, /draggable/);
  assert.match(modal, /Guardar geocerca y continuar/);
  assert.match(modal, /radiusMeters - 25/);
  assert.match(modal, /radiusMeters \+ 25/);
});

test('a completed check clears captured form state and keeps the compact action dock above navigation', () => {
  const screen = read('app/checkin/[id].tsx');
  assert.match(screen, /const resetCompletedCheck/);
  assert.match(screen, /setPhotoUri\(null\)/);
  assert.match(screen, /setNotes\(''\)/);
  assert.match(screen, /resetCompletedCheck\(\);\s*setFeedbackModal/);
  assert.match(screen, /styles\.embeddedActionDock/);
  assert.match(screen, /bottomInset \+ BOTTOM_BAR_HEIGHT \+ 8/);
  assert.match(screen, /minHeight: 360/);
  assert.match(screen, /minHeight: 82/);
  assert.match(screen, /currentProject\.desarrollo\} · \{currentProject\.villa/);
});
