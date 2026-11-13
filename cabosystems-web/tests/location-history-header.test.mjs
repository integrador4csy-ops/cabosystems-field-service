import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const header = readFileSync(path.join(root, 'src/components/layout/AppHeader.tsx'), 'utf8');
const history = readFileSync(path.join(root, 'src/components/history/LocationHistoryView.tsx'), 'utf8');

test('route history title and date controls live in the global header', () => {
  assert.match(header, /isHistory \? t\('sidebar\.history'\)/);
  assert.match(header, /className="history-header-controls"/);
  assert.match(header, /history-header-worker/);
  assert.match(header, /history-header-presets/);
  assert.match(header, /history-header-date/);
  assert.doesNotMatch(header, /className="history-header-worker">\s*<span>/);
});

test('route history avoids duplicate loading and re-entry flicker', () => {
  assert.match(history, /Promise\.all\(\[historyRequest, villasRequest\.current\]\)/);
  assert.match(history, /if \(!force && loadedKey === nextKey\) return/);
  assert.match(history, /version !== requestVersion\.current/);
});

test('route history content does not repeat its heading or filters', () => {
  assert.doesNotMatch(history, /location-history-header/);
  assert.doesNotMatch(history, /<h1>\{t\('Historial de rutas'\)\}<\/h1>/);
  assert.doesNotMatch(history, /location-history-filters/);
});

test('route history map configures light mode and roadmap', () => {
  const mapCode = readFileSync(path.join(root, 'src/components/history/LocationHistoryMap.tsx'), 'utf8');
  assert.match(mapCode, /mapTypeId:\s*google\.maps\.MapTypeId\.ROADMAP/);
  assert.match(mapCode, /colorScheme:\s*google\.maps\.ColorScheme\.LIGHT/);
});
