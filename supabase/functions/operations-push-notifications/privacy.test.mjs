import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8');

test('push payloads stay generic and route details remain inside the authenticated app', () => {
  assert.match(source, /Tienes una nueva tarea\. Abre la app/);
  assert.match(source, /Se registró un nuevo check\. Abre la app/);
  assert.doesNotMatch(source, /message = .*technician/);
  assert.doesNotMatch(source, /data = \{ target: 'checks', recordId/);
  assert.match(source, /record\.tecnico_id !== authData\.user\.id/);
  assert.match(source, /\['admin', 'supervisor_instalacion', 'aux_operaciones'\]/);
});
