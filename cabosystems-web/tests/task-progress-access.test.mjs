import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const accessSource = readFileSync(new URL('../src/lib/taskProgressAccess.ts', import.meta.url), 'utf8');
const compiledAccess = ts.transpileModule(accessSource, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const {
  buildTaskProgressScope,
  canProgressTask,
  resolveFullTaskProjectIds,
} = await import(`data:text/javascript;base64,${Buffer.from(compiledAccess).toString('base64')}`);

test('resolveFullTaskProjectIds includes All villa tasks participants, villa leads, and development grants', () => {
  const projects = [
    { id: 'v-participant-all', desarrollo_id: 'd1', integrador_id: 'lead-1', tecnico_id: 'tech-1' },
    { id: 'v-participant-mine', desarrollo_id: 'd1', integrador_id: 'lead-1', tecnico_id: 'tech-1' },
    { id: 'v-integrator', desarrollo_id: 'd2', integrador_id: 'user-1', tecnico_id: 'tech-1' },
    { id: 'v-tech', desarrollo_id: 'd2', integrador_id: 'lead-1', tecnico_id: 'user-1' },
    { id: 'v-dev', desarrollo_id: 'd3', integrador_id: 'lead-1', tecnico_id: 'tech-1' },
  ];

  const resolved = resolveFullTaskProjectIds(projects, {
    userId: 'user-1',
    allTaskProjectIds: ['v-participant-all'],
    developmentIds: ['d3'],
  });

  assert.deepEqual(resolved, ['v-participant-all', 'v-integrator', 'v-tech', 'v-dev']);
});

test('canProgressTask matches RLS progress rules for All villa tasks, assignees, roles, and inactive accounts', () => {
  const scope = buildTaskProgressScope(
    'assistant-1',
    { rol: 'asistente_integracion', activo: true },
    new Set(['villa-all-tasks']),
  );

  // All villa tasks participant can complete unassigned tasks or tasks assigned to someone else in that villa.
  assert.equal(canProgressTask({ proyecto_id: 'villa-all-tasks', asignado_a: null }, scope), true);
  assert.equal(canProgressTask({ proyecto_id: 'villa-all-tasks', asignado_a: 'other-user' }, scope), true);

  // Outside villas with full access, only directly assigned tasks can be progressed.
  assert.equal(canProgressTask({ proyecto_id: 'villa-limited', asignado_a: 'assistant-1' }, scope), true);
  assert.equal(canProgressTask({ proyecto_id: 'villa-limited', asignado_a: 'other-user' }, scope), false);
  assert.equal(canProgressTask({ proyecto_id: 'villa-limited', asignado_a: null }, scope), false);

  // Admins and installation supervisors retain global progress access; inactive users are blocked everywhere.
  assert.equal(
    canProgressTask({ proyecto_id: 'any-villa', asignado_a: null }, buildTaskProgressScope('sup-1', { rol: 'supervisor_instalacion', activo: true })),
    true,
  );
  assert.equal(
    canProgressTask({ proyecto_id: 'villa-all-tasks', asignado_a: 'inactive-1' }, buildTaskProgressScope('inactive-1', { rol: 'admin', activo: false }, new Set(['villa-all-tasks']))),
    false,
  );
});

test('task workspace UI delegates progress permissions through taskProgressAccess instead of hardcoded admin-only checks', () => {
  const card = readFileSync(new URL('../src/components/projects/TaskCard.tsx', import.meta.url), 'utf8');
  const board = readFileSync(new URL('../src/components/projects/TaskBoard.tsx', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../src/components/projects/ProjectsManagementView.tsx', import.meta.url), 'utf8');

  assert.match(card, /canProgressTask/);
  assert.match(board, /canProgressTask/);
  assert.doesNotMatch(card, /isAdmin \|\| task\.asignado_a === user\?\.id/);
  assert.doesNotMatch(board, /isAdmin \|\| task\.asignado_a === user\?\.id/);
  assert.match(view, /getUserTaskAccessGrants/);
  assert.match(view, /resolveFullTaskProjectIds/);
});
