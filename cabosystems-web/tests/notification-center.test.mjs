import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(root, 'src/components/layout/NotificationCenter.tsx'), 'utf8');

test('opening the notification panel marks every current notification as read', () => {
  assert.match(source, /const toggleNotifications = \(\) => \{[\s\S]*?if \(open\)[\s\S]*?setOpen\(true\);[\s\S]*?void markAllRead\(\);[\s\S]*?\};/);
  assert.match(source, /aria-expanded=\{open\} onClick=\{toggleNotifications\}/);
  assert.match(source, /update\(\{ read_at: readAt \}\)\.eq\('user_id', user\.id\)\.is\('read_at', null\)/);
});
