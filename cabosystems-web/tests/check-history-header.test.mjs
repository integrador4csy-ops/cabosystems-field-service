import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const header = readFileSync(path.join(root, 'src/components/layout/AppHeader.tsx'), 'utf8');
const checksView = readFileSync(path.join(root, 'src/components/tracking/CheckHistoryView.tsx'), 'utf8');
const app = readFileSync(path.join(root, 'src/App.tsx'), 'utf8');

test('check history filters and date controls live in the global header', () => {
  assert.match(header, /isChecks \? t\('Historial de checks'\)/);
  assert.match(header, /\{isChecks && <div className="history-header-controls"/);
  assert.match(header, /<option value="">\{t\('Todos los técnicos'\)\}<\/option>/);
  assert.match(header, /aria-label=\{t\('Día anterior'\)\}/);
  assert.match(header, /aria-label=\{t\('Día siguiente'\)\}/);
  assert.match(header, /aria-label=\{t\('Actualizar checks'\)\}/);
});

test('check history view provides an accordion list expanded by default', () => {
  assert.match(checksView, /showInlineHeader\s*=\s*false/);
  assert.match(checksView, /toggleTechnician/);
  assert.match(checksView, /aria-expanded=\{isExpanded\}/);
  assert.match(checksView, /ChevronDown/);
  assert.match(checksView, /isExpanded \? t\('Ocultar'\) : t\('Ver registros'\)/);
});

test('app connects checks controls between header and checks view', () => {
  assert.match(app, /checkTechnicianId=\{checkTechnicianId\}/);
  assert.match(app, /checkDate=\{checkDate\}/);
  assert.match(app, /onRefreshChecks=\{handleRefreshChecks\}/);
  assert.match(app, /checks=\{<CheckHistoryView/);
});
