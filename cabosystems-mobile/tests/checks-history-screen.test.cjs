const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('check history remains notification-accessible but is hidden from the tab bar', () => {
  const screen = read('app/(tabs)/checks.tsx');
  const layout = read('app/(tabs)/_layout.tsx');
  assert.match(screen, /getAdminCheckHistory\(dayKey\(day\)\)/);
  assert.match(screen, /groups = new Map/);
  assert.match(screen, /item\.technician_id === selectedUser/);
  assert.match(screen, /<Image source=\{\{ uri: item\.photo_url \}\}/);
  assert.match(layout, /name="checks"[\s\S]*?options=\{\{ href: null \}\}/);
  assert.match(layout, /\['index', 'maps', 'schedule', 'users', 'chat'\]/);
});

test('operational pushes open authenticated task or check destinations without exposing evidence', () => {
  const notifications = read('lib/notifications.ts');
  assert.match(notifications, /data\.target === 'checks'/);
  assert.match(notifications, /data\.target === 'tasks'/);
  assert.match(notifications, /setNotificationChannelAsync\('operations'/);
});
