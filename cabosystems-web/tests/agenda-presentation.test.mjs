import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../src/lib/agendaPresentation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022 } }).outputText;
const { calendarAppearance, eventSchedule } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('calendar backgrounds follow Google color and maintain contrasting text', () => {
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
