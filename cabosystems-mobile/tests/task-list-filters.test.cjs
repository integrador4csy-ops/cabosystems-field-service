const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../lib/taskListFilters.ts'), 'utf8');
const moduleValue = { exports: {} };
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { module: moduleValue, exports: moduleValue.exports, Intl });
const { matchesTaskAssignee, sortTaskTitles } = moduleValue.exports;
const tasks = [
  { id: 'ten', titulo: 'Tarea 10', asignado_a: 'ana', villa: 'one', status: 'pending' },
  { id: 'two', titulo: 'Tarea 2', asignado_a: null, villa: 'one', status: 'pending' },
  { id: 'one', titulo: 'Tarea 1', asignado_a: 'ana', villa: 'two', status: 'done' },
];
test('assignee filters distinguish everyone, unassigned and a specific person', () => {
  assert.equal(tasks.filter(task => matchesTaskAssignee(task, 'all')).length, 3);
  assert.deepEqual(tasks.filter(task => matchesTaskAssignee(task, 'unassigned')).map(task => task.id), ['two']);
  assert.deepEqual(tasks.filter(task => matchesTaskAssignee(task, 'ana')).map(task => task.id), ['ten', 'one']);
  assert.equal(matchesTaskAssignee({}, 'unassigned'), true);
});
test('title ordering is numeric in both directions without changing source tasks', () => {
  const original = tasks.map(task => task.id);
  assert.deepEqual(Array.from(sortTaskTitles(tasks, 'asc', 'es'), task => task.id), ['one', 'two', 'ten']);
  assert.deepEqual(Array.from(sortTaskTitles(tasks, 'desc', 'en'), task => task.id), ['ten', 'two', 'one']);
  assert.deepEqual(tasks.map(task => task.id), original);
});
test('responsible, villa and status conditions intersect', () => {
  const result = tasks.filter(task => task.villa === 'one' && task.status === 'pending' && matchesTaskAssignee(task, 'ana'));
  assert.deepEqual(result.map(task => task.id), ['ten']);
});
