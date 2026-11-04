import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const code = readFileSync(new URL('../src/lib/locationHistoryAnalytics.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const module = { exports: {} };
vm.runInNewContext(js, { module, exports: module.exports, require, setTimeout, clearTimeout, Math, Date });
const {
  calculateHaversineDistance,
  formatDurationMs,
  formatTimeOfDay,
  analyzeLocationHistory,
} = module.exports;

test('calculateHaversineDistance accurately computes distance between coordinates', () => {
  // Cabo San Lucas Marina to San Jose del Cabo (~28-32 km)
  const dist = calculateHaversineDistance(22.8863, -109.9126, 23.0626, -109.7037);
  assert.ok(dist > 28000 && dist < 32000, `Expected ~30km, got ${dist}`);

  // Zero distance
  assert.equal(calculateHaversineDistance(23.0626, -109.7037, 23.0626, -109.7037), 0);
});

test('formatDurationMs formats minutes and hours properly', () => {
  assert.equal(formatDurationMs(30 * 1000), '1 min');
  assert.equal(formatDurationMs(25 * 60 * 1000), '25 min');
  assert.equal(formatDurationMs(60 * 60 * 1000), '1 h');
  assert.equal(formatDurationMs(75 * 60 * 1000), '1 h 15 min');
});

test('analyzeLocationHistory detects movement segments and prolonged stops >= 20 mins', () => {
  const baseTime = new Date('2026-11-03T08:00:00Z').getTime();

  // Create telemetry sequence:
  // 1. Initial stop at office: 08:00 to 08:10 (10 mins, short stop < 20m)
  // 2. Drive 08:10 to 08:35 (25 mins drive)
  // 3. Prolonged stop: 08:35 to 09:10 (35 mins stop >= 20m)
  const records = [
    // Stop 1: 08:00 - 08:10
    { id: '1', usuario_id: 'u1', latitud: 23.0626, longitud: -109.7037, velocidad: 0, bateria: 95, created_at: new Date(baseTime).toISOString() },
    { id: '2', usuario_id: 'u1', latitud: 23.0627, longitud: -109.7036, velocidad: 0, bateria: 95, created_at: new Date(baseTime + 3 * 60000).toISOString() },
    { id: '3', usuario_id: 'u1', latitud: 23.0626, longitud: -109.7037, velocidad: 0, bateria: 94, created_at: new Date(baseTime + 7 * 60000).toISOString() },
    { id: '4', usuario_id: 'u1', latitud: 23.0625, longitud: -109.7038, velocidad: 0, bateria: 94, created_at: new Date(baseTime + 10 * 60000).toISOString() },

    // Movement: 08:15 - 08:30 (moving along highway)
    { id: '5', usuario_id: 'u1', latitud: 23.0500, longitud: -109.7200, velocidad: 45, bateria: 93, created_at: new Date(baseTime + 15 * 60000).toISOString() },
    { id: '6', usuario_id: 'u1', latitud: 23.0200, longitud: -109.7600, velocidad: 65, bateria: 92, created_at: new Date(baseTime + 22 * 60000).toISOString() },
    { id: '7', usuario_id: 'u1', latitud: 22.9800, longitud: -109.8000, velocidad: 50, bateria: 91, created_at: new Date(baseTime + 30 * 60000).toISOString() },

    // Stop 2 (Prolonged >= 20 mins): 08:35 - 09:10 (35 mins)
    { id: '8', usuario_id: 'u1', latitud: 22.8860, longitud: -109.9120, velocidad: 0, bateria: 90, created_at: new Date(baseTime + 35 * 60000).toISOString() },
    { id: '9', usuario_id: 'u1', latitud: 22.8861, longitud: -109.9121, velocidad: 0, bateria: 89, created_at: new Date(baseTime + 45 * 60000).toISOString() },
    { id: '10', usuario_id: 'u1', latitud: 22.8860, longitud: -109.9119, velocidad: 0, bateria: 88, created_at: new Date(baseTime + 55 * 60000).toISOString() },
    { id: '11', usuario_id: 'u1', latitud: 22.8862, longitud: -109.9120, velocidad: 0, bateria: 87, created_at: new Date(baseTime + 70 * 60000).toISOString() },
  ];

  const analysis = analyzeLocationHistory(records);

  assert.equal(analysis.totalStops, 2, 'Should have 2 stops');
  assert.equal(analysis.prolongedStops, 1, 'Should have 1 prolonged stop >= 20 min');
  assert.ok(analysis.totalDistanceMeters > 15000, 'Should have recorded travel distance > 15km');
  assert.ok(analysis.events.length >= 3, 'Should have stop -> movement -> stop events');

  const stop1 = analysis.events.find(e => e.type === 'stop' && !e.isProlonged);
  assert.ok(stop1, 'Found regular stop < 20 min');
  assert.equal(stop1.durationMinutes, 10);

  const stop2 = analysis.events.find(e => e.type === 'stop' && e.isProlonged);
  assert.ok(stop2, 'Found prolonged stop >= 20 min');
  assert.equal(stop2.durationMinutes, 35);
  assert.equal(stop2.isProlonged, true);
});
