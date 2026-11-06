import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = readFileSync(path.join(root, 'src/lib/projectTeamRoles.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { isEligibleProjectLead } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const person = (rol, activo = true) => ({ id: rol, rol, activo });

test('lead technician only includes active technician and installation roles', () => {
  for (const role of ['tecnico', 'instalador', 'aux_instalacion']) {
    assert.equal(isEligibleProjectLead(person(role), 'technician'), true, role);
  }
  for (const role of ['admin', 'integrador', 'aux_integracion', 'supervisor_instalacion']) {
    assert.equal(isEligibleProjectLead(person(role), 'technician'), false, role);
  }
  assert.equal(isEligibleProjectLead(person('instalador', false), 'technician'), false);
});

test('lead integrator only includes active integration roles', () => {
  assert.equal(isEligibleProjectLead(person('integrador'), 'integrator'), true);
  assert.equal(isEligibleProjectLead(person('aux_integracion'), 'integrator'), true);
  for (const role of ['admin', 'tecnico', 'instalador', 'aux_instalacion']) {
    assert.equal(isEligibleProjectLead(person(role), 'integrator'), false, role);
  }
  assert.equal(isEligibleProjectLead(person('aux_integracion', false), 'integrator'), false);
});
