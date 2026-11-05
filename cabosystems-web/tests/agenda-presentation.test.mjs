import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/lib/agendaPresentation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { birthdaysForMonth, calendarAppearance, eventSchedule, formatShortName, resolveCalendarDisplayName } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('calendar backgrounds follow Google color and use dark text only on very light colors', () => {
  assert.deepEqual(calendarAppearance({ google: { calendarColor: '#ffff00' } }), { backgroundColor: '#ffff00', color: '#000000' });
  assert.deepEqual(calendarAppearance({ google: { calendarColor: '#000000' } }), { backgroundColor: '#000000', color: '#FFFFFF' });
  assert.deepEqual(calendarAppearance({ google: { calendarColor: '#a47ae2' } }), { backgroundColor: '#a47ae2', color: '#FFFFFF' });
  assert.deepEqual(calendarAppearance({ google: { calendarColor: '#9fe1e7' } }), { backgroundColor: '#9fe1e7', color: '#000000' });
  assert.equal(calendarAppearance({ google: { calendarColor: 'url(unsafe)' } }).backgroundColor, '#343e48');
  assert.equal(calendarAppearance({}), undefined);
});
test('cards show all-day or the full time range without inventing legacy end times', () => {
  const event = { fecha: '2026-10-20', hora: '09:00:00', hora_fin: '10:30:00' };
  assert.equal(eventSchedule({ ...event, hora: null }, 'es-MX'), 'Todo el día');
  assert.match(eventSchedule(event, 'es-MX'), /9:00.*–.*10:30/);
  assert.match(eventSchedule({ ...event, hora_fin: null }, 'es-MX'), /Fin sin definir/);
  assert.match(eventSchedule({ ...event, google: { endDate: '2026-10-21', endTime: '02:00:00' } }, 'es-MX'), /21.*2:00/);
});

test('formatShortName extracts first name and first surname', () => {
  assert.equal(formatShortName('Carlos Jesús Fregoso Zapata'), 'Carlos Fregoso');
  assert.equal(formatShortName('Carlos Fregoso'), 'Carlos Fregoso');
  assert.equal(formatShortName('Juan Pérez Gómez'), 'Juan Pérez');
  assert.equal(formatShortName('Carlos'), 'Carlos');
  assert.equal(formatShortName(''), '');
  assert.equal(formatShortName(null), '');
});

test('resolveCalendarDisplayName uses short name when calendar name is email and matches user', () => {
  const cal = { id: 'carlosjesusfregosozapata@gmail.com', name: 'carlosjesusfregosozapata@gmail.com' };
  assert.equal(resolveCalendarDisplayName(cal, 'carlosjesusfregosozapata@gmail.com', 'Carlos Jesús Fregoso Zapata'), 'Carlos Fregoso');

  // Retains custom calendar names if not email format
  const customCal = { id: 'carlosjesusfregosozapata@gmail.com', name: 'Instalaciones Cabo' };
  assert.equal(resolveCalendarDisplayName(customCal, 'carlosjesusfregosozapata@gmail.com', 'Carlos Jesús Fregoso Zapata'), 'Instalaciones Cabo');

  // Fallback to calendar name if no user name
  assert.equal(resolveCalendarDisplayName(cal, 'carlosjesusfregosozapata@gmail.com', null), 'carlosjesusfregosozapata@gmail.com');
});

test('monthly birthdays include only valid dates from the selected month and sort by day then name', () => {
  const profiles = [
    { id: 'late', nombre: 'Zoé', fecha_nacimiento: '1990-11-28' },
    { id: 'alpha', nombre: 'Álvaro', fecha_nacimiento: '1994-11-03' },
    { id: 'beta', nombre: 'Beatriz', fecha_nacimiento: '1988-11-03' },
    { id: 'other', nombre: 'Octavio', fecha_nacimiento: '1991-10-20' },
    { id: 'invalid', nombre: 'Fecha inválida', fecha_nacimiento: '1991-11-31' },
    { id: 'blank', nombre: '   ', fecha_nacimiento: '1991-11-10' },
  ];
  assert.deepEqual(birthdaysForMonth(profiles, '2026-11-04', 'es-MX').map(({ id, day }) => [id, day]), [
    ['alpha', 3], ['beta', 3], ['late', 28],
  ]);
  assert.deepEqual(birthdaysForMonth(profiles, 'fecha-invalida', 'es-MX'), []);
});
