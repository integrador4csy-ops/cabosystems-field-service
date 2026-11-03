const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { DatabaseSync } = require('node:sqlite');

function load(file, imports = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../lib', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, require: name => { if (name in imports) return imports[name]; throw Error(`Unexpected import ${name}`); }, Map, Set, Date, Math, JSON, console, setTimeout, clearTimeout });
  return exports;
}
function databaseFixture(filename = ':memory:') {
  const sqlite = new DatabaseSync(filename);
  const adapter = {
    execAsync: async sql => { sqlite.exec(sql); },
    runAsync: async (sql, ...params) => sqlite.prepare(sql).run(...params),
    getAllAsync: async (sql, ...params) => sqlite.prepare(sql).all(...params),
    getFirstAsync: async (sql, ...params) => sqlite.prepare(sql).get(...params) ?? null,
    withExclusiveTransactionAsync: async task => {
      sqlite.exec('BEGIN IMMEDIATE');
      try { await task(adapter); sqlite.exec('COMMIT'); }
      catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
  const { chatDatabase } = load('chatDatabase.ts', { 'expo-sqlite': { openDatabaseAsync: async () => adapter } });
  return { db: chatDatabase, sqlite };
}
function cacheFixture(db, legacy = null) {
  return load('chatRoomCache.ts', { './chatDatabase': { chatDatabase: db }, './chatRoomStorage': { chatRoomStorage: { read: async () => legacy } } });
}
const group = id => ({ id, nombre: id, created_at: '2026-01-01T00:00:00.000Z' });
const message = (i, room = 'room') => ({ id: String(i).padStart(6, '0'), grupo_id: room, created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(), contenido: `message ${i}`, reacciones: [] });
const snapshot = (room, messages = []) => ({ group: group(room), messages, pins: [] });
module.exports = { load, databaseFixture, cacheFixture, group, message, snapshot };
