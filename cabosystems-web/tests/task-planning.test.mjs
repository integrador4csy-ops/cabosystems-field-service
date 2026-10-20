import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

async function loadModule(file) {
  const source = readFileSync(new URL(`../src/lib/${file}.ts`, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}

const { dateKey, parseDateKey, shiftDate, shiftMonth, weekDates, monthWorkWeeks, isOverdue } = await loadModule('taskDates');
const { countTaskStatuses, filterWorkspaceTasks } = await loadModule('taskFilters');

test('calendar days stay unchanged across timezones and daylight saving transitions', () => {
  const original = process.env.TZ;
  try {
    for (const timezone of ['America/Mazatlan', 'America/New_York', 'UTC', 'Pacific/Auckland']) {
      process.env.TZ = timezone;
      for (const day of ['2026-10-14', '2026-11-01', '2026-03-08', '2027-01-01']) assert.equal(dateKey(parseDateKey(day)), day, `${timezone}: ${day}`);
      assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
      assert.equal(shiftDate('2026-03-08', 1), '2026-03-09');
      assert.equal(shiftDate('2026-11-01', -1), '2026-10-31');
      assert.equal(shiftDate('2028-02-28', 1), '2028-02-29');
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});

test('weeks run Monday through Sunday, including across a year boundary', () => {
  assert.deepEqual(weekDates('2026-10-14'), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.deepEqual(weekDates('2027-01-03'), ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
});

test('only unfinished tasks scheduled before today are overdue', () => {
  assert.equal(isOverdue({ fecha_programada: '2026-10-13', estatus: 'pendiente' }, '2026-10-14'), true);
  assert.equal(isOverdue({ fecha_programada: '2026-10-13', estatus: 'completada' }, '2026-10-14'), false);
  assert.equal(isOverdue({ fecha_programada: '2026-10-14', estatus: 'en_proceso' }, '2026-10-14'), false);
  assert.equal(isOverdue({ fecha_programada: null, estatus: 'pendiente' }, '2026-10-14'), false);
});

test('monthly calendar includes every weekday exactly once and never includes weekends', () => {
  for (const month of ['2026-02-01', '2026-08-01', '2026-10-14', '2028-02-29', '2027-01-03']) {
    const weeks = monthWorkWeeks(month);
    const days = weeks.flat();
    assert.equal(new Set(days).size, days.length);
    for (const week of weeks) {
      assert.equal(week.length, 5);
      assert.deepEqual(week.map((day) => parseDateKey(day).getDay()), [1, 2, 3, 4, 5]);
    }
    const date = parseDateKey(month);
    const expected = [];
    for (let day = new Date(date.getFullYear(), date.getMonth(), 1, 12); day.getMonth() === date.getMonth(); day.setDate(day.getDate() + 1)) {
      if (day.getDay() > 0 && day.getDay() < 6) expected.push(dateKey(day));
    }
    assert.deepEqual(days.filter((day) => day.slice(0, 7) === month.slice(0, 7)), expected);
  }
});

test('month navigation clamps short months and crosses year boundaries', () => {
  assert.equal(shiftMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(shiftMonth('2028-01-31', 1), '2028-02-29');
  assert.equal(shiftMonth('2026-12-14', 1), '2027-01-14');
  assert.equal(shiftMonth('2027-01-14', -1), '2026-12-14');
});

const projects = [{ id: 'a', desarrollo: 'Querencia', villa: 'Villa 14' }, { id: 'b', desarrollo: 'Pedregal', villa: 'Casa 2' }];
const tasks = [
  { id: '1', proyecto_id: 'a', asignado_a: 'carlos', titulo: 'Instalar cámaras', estatus: 'pendiente', fecha_programada: '2026-10-14', profiles: { nombre: 'Carlos Fregoso' } },
  { id: '2', proyecto_id: 'a', asignado_a: null, titulo: 'Revisar red', estatus: 'en_proceso', fecha_programada: null },
  { id: '3', proyecto_id: 'b', asignado_a: 'gerardo', titulo: 'Certificar cableado', estatus: 'completada', fecha_programada: '2026-10-15', profiles: { nombre: 'Gerardo Sandoval' } },
];
const filters = { query: '', development: 'all', project: 'all', assignee: 'all', status: 'all' };

test('agenda status counts exclude undated tasks and count them only in the unscheduled view', () => {
  const mixed = [...tasks, { ...tasks[1], id: '4' }];
  assert.deepEqual(countTaskStatuses(mixed, 'scheduled'), { all: 2, pendiente: 1, en_proceso: 0, completada: 1 });
  assert.deepEqual(countTaskStatuses(mixed, 'unscheduled'), { all: 2, pendiente: 0, en_proceso: 2, completada: 0 });
  assert.deepEqual(countTaskStatuses(mixed), { all: 4, pendiente: 1, en_proceso: 2, completada: 1 });
  assert.deepEqual(countTaskStatuses([], 'scheduled'), { all: 0, pendiente: 0, en_proceso: 0, completada: 0 });
  const filtered = filterWorkspaceTasks(mixed, projects, { ...filters, project: 'b' });
  assert.deepEqual(countTaskStatuses(filtered, 'scheduled'), { all: 1, pendiente: 0, en_proceso: 0, completada: 1 });
});
const ids = (next = {}) => filterWorkspaceTasks(tasks, projects, { ...filters, ...next }).map((task) => task.id);

test('shared task filters compose without changing the underlying task objects', () => {
  assert.deepEqual(ids(), ['1', '2', '3']);
  assert.deepEqual(ids({ development: 'Querencia' }), ['1', '2']);
  assert.deepEqual(ids({ project: 'b' }), ['3']);
  assert.deepEqual(ids({ assignee: 'unassigned' }), ['2']);
  assert.deepEqual(ids({ assignee: 'carlos', status: 'pendiente' }), ['1']);
  assert.deepEqual(ids({ project: 'b', status: 'pendiente' }), []);
  assert.equal(filterWorkspaceTasks(tasks, projects, filters)[0], tasks[0]);
});

test('search finds task content, villas, developments and assignees', () => {
  assert.deepEqual(ids({ query: 'cámaras' }), ['1']);
  assert.deepEqual(ids({ query: ' CARLOS ' }), ['1']);
  assert.deepEqual(ids({ query: 'Villa 14' }), ['1', '2']);
  assert.deepEqual(ids({ query: 'pedregal' }), ['3']);
});

test('unscheduled tasks remain available when using day or week views of the same data', () => {
  const visible = filterWorkspaceTasks(tasks, projects, filters);
  assert.deepEqual(visible.filter((task) => !task.fecha_programada).map((task) => task.id), ['2']);
  const week = weekDates('2026-10-14');
  assert.deepEqual(visible.filter((task) => week.includes(task.fecha_programada)).map((task) => task.id), ['1', '3']);
});
