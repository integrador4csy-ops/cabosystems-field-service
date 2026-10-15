const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, imports = {}) {
  const compiled = ts.transpileModule(fs.readFileSync(path.resolve(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, Date, Map, Set, Intl, require: name => { if (name in imports) return imports[name]; throw Error(`Unexpected import ${name}`); } });
  return module.exports;
}
const agenda = load('lib/agenda.ts');
const webDates = load('../cabosystems-web/src/lib/taskDates.ts');
const { AGENDA_COPY } = load('lib/agendaCopy.ts');
const plain = value => JSON.parse(JSON.stringify(value));
const task = (id, date, status = 'pendiente', project = 'one') => ({ id, titulo: id === 'install' ? 'Instalación de cámara' : id, descripcion: null, fecha_programada: date, estatus: status, proyecto_id: project, asignado_a: 'technician', created_at: '2026-01-01T00:00:00Z', proyectos: { villa: project === 'one' ? 'Villa 01' : 'GE51', desarrollo: 'San José' }, profiles: { nombre: 'Técnico' } });
const tasks = [task('install', '2026-10-15'), task('network', '2026-10-16', 'en_proceso', 'two'), task('undated', null), task('done', '2026-10-15', 'completada'), task('saturday', '2026-10-17')];

test('local calendar dates preserve days across month/year changes and daylight saving boundaries', () => {
  assert.equal(agenda.dateKey(agenda.parseDateKey('2026-10-15')), '2026-10-15');
  assert.equal(agenda.shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(agenda.shiftDate('2026-03-08', 1), '2026-03-09');
  assert.equal(agenda.shiftDate('2026-11-01', -1), '2026-10-31');
  assert.equal(agenda.shiftMonth('2024-01-31', 1), '2024-02-29');
  assert.equal(agenda.shiftMonth('2026-01-31', 1), '2026-02-28');
  assert.equal(agenda.shiftMonth('2026-03-31', -1), '2026-02-28');
});

test('mobile workweek and month calendars match the web including leap years', () => {
  for (let year = 2024; year <= 2028; year++) for (let month = 1; month <= 12; month++) {
    const value = `${year}-${String(month).padStart(2, '0')}-15`;
    const weeks = agenda.monthWorkWeeks(value);
    assert.deepEqual(plain(weeks), plain(webDates.monthWorkWeeks(value)));
    assert.ok(weeks.length >= 4 && weeks.length <= 6);
    for (const week of weeks) assert.deepEqual(week.map(day => agenda.parseDateKey(day).getDay()).join(','), '1,2,3,4,5');
  }
  assert.equal(agenda.weekDates('2026-10-18').join(','), '2026-10-12,2026-10-13,2026-10-14,2026-10-15,2026-10-16,2026-10-17,2026-10-18');
});

test('agenda uses scheduled dates, keeps undated tasks accessible, and supports weekend day view', () => {
  assert.equal(agenda.periodTasks(tasks, 'day', '2026-10-15').map(t => t.id).join(','), 'install,done');
  assert.equal(agenda.periodTasks(tasks, 'month', '2026-10-15').length, 2);
  assert.equal(agenda.periodTasks(tasks, 'unscheduled', '2026-10-15')[0].id, 'undated');
  assert.equal(agenda.periodTasks(tasks, 'week', '2026-10-15').length, 3);
  assert.equal(agenda.periodTasks(tasks, 'day', '2026-10-17')[0].id, 'saturday');
  assert.equal(agenda.periodTasks(tasks, 'day', '2026-01-01').length, 0);
  const rows = agenda.agendaRows(tasks, 'week', '2026-10-15');
  assert.equal(rows.filter(row => row.kind === 'heading').length, 5);
  assert.equal(rows.filter(row => row.kind === 'task').length, 3);
  assert.equal(rows.filter(row => row.kind === 'empty').length, 3);
});

test('search, villa and status filters combine without modifying the source tasks', () => {
  const before = JSON.stringify(tasks);
  assert.equal(agenda.filterAgendaTasks(tasks, 'instalacion camara san jose', 'one', 'pendiente')[0].id, 'install');
  assert.equal(agenda.filterAgendaTasks(tasks, 'GE51')[0].id, 'network');
  assert.equal(agenda.filterAgendaTasks(tasks, '', 'one', 'completada')[0].id, 'done');
  assert.equal(agenda.filterAgendaTasks(tasks, '', 'missing').length, 0);
  assert.equal(agenda.filterAgendaTasks(tasks, 'does-not-exist').length, 0);
  assert.equal(JSON.stringify(tasks), before);
});

test('overdue status excludes completed tasks and both language dictionaries stay complete', () => {
  assert.equal(agenda.isOverdue(task('old', '2026-10-14'), '2026-10-15'), true);
  assert.equal(agenda.isOverdue(task('today', '2026-10-15'), '2026-10-15'), false);
  assert.equal(agenda.isOverdue(task('done', '2026-10-14', 'completada'), '2026-10-15'), false);
  assert.equal(agenda.isOverdue(task('none', null), '2026-10-15'), false);
  assert.deepEqual(Object.keys(AGENDA_COPY.es).sort(), Object.keys(AGENDA_COPY.en).sort());
});

test('assigned-task API preserves the scheduled date and keeps the account filter', async () => {
  const calls = [];
  const result = [task('install', '2026-10-15')];
  const query = { select: (...args) => { calls.push(['select', ...args]); return query; }, eq: (...args) => { calls.push(['eq', ...args]); return query; }, order: () => query,
    then: (resolve, reject) => Promise.resolve({ data: result, error: null }).then(resolve, reject) };
  const api = load('lib/api.ts', { './supabase': { supabase: { from: table => { calls.push(['table', table]); return query; } } } });
  const items = await api.getMyTasks('technician');
  assert.equal(items[0].fecha_programada, '2026-10-15');
  assert.deepEqual(calls.find(call => call[0] === 'eq'), ['eq', 'asignado_a', 'technician']);
});
