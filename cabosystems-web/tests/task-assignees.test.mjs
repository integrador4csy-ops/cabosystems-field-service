import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/taskAssignees.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { isEligibleTaskAssignee } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const profile = (rol, activo = true) => ({ rol, activo });

test('task assignment excludes administrators and coordination roles', () => {
  for (const role of ['admin', 'supervisor_instalacion', 'aux_operaciones']) {
    assert.equal(isEligibleTaskAssignee(profile(role)), false, role);
  }
});

test('task assignment keeps active field roles available', () => {
  for (const role of ['instalador', 'aux_instalacion', 'integrador', 'aux_integracion', 'infraestructura', 'aux_infraestructura', 'servicios', 'aux_servicios', 'tecnico']) {
    assert.equal(isEligibleTaskAssignee(profile(role)), true, role);
  }
  assert.equal(isEligibleTaskAssignee(profile('instalador', false)), false);
});
