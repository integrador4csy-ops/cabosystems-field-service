const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const screen = fs.readFileSync(path.join(__dirname, '../app/locations.tsx'), 'utf8');
const api = fs.readFileSync(path.join(__dirname, '../lib/api.ts'), 'utf8');

test('villa locations render an independent expandable list without the global villa selector', () => {
  assert.match(screen, /<FlashList/);
  assert.match(screen, /<HeaderCaboSystems seamless showProjectSelector=\{false\}/);
  assert.doesNotMatch(screen, /locations\.back|ArrowLeft/);
  assert.match(screen, /paddingTop: headerHeight \+ Spacing\.sm/);
  assert.match(screen, /accessibilityState=\{\{ expanded \}\}/);
  assert.doesNotMatch(screen, /selectedProject|useProjects/);
});

test('villa locations use the restricted location-only RPC', () => {
  assert.match(api, /supabase\.rpc\('list_villa_locations'\)/);
  assert.match(api, /export type VillaLocation/);
});
