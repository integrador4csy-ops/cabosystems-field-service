import type { SQLiteDatabase } from 'expo-sqlite';
import type { PendingFieldRecord, OutboxEntry } from './fieldOutbox';
import type { Project } from '@/types/database';

let database: Promise<SQLiteDatabase> | undefined;
async function db() {
  if (!database) {
    database = (async () => {
      const { openDatabaseAsync } = await import('expo-sqlite');
      const connection = await openDatabaseAsync('field-outbox.db');
      await connection.execAsync(`PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS field_outbox (
          sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, owner TEXT NOT NULL,
          payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
          next_attempt INTEGER NOT NULL DEFAULT 0, last_error TEXT);
        CREATE INDEX IF NOT EXISTS field_outbox_owner_state ON field_outbox(owner, state, sequence);
        CREATE TABLE IF NOT EXISTS field_projects (owner TEXT PRIMARY KEY, payload TEXT NOT NULL);`);
      return connection;
    })().catch(error => { database = undefined; throw error; });
  }
  return database;
}
export async function savePendingFieldRecord(record: PendingFieldRecord) {
  await (await db()).runAsync('INSERT INTO field_outbox(id, owner, payload) VALUES (?, ?, ?)', record.id, record.owner, JSON.stringify(record));
}
export async function firstPendingFieldRecord(owner: string): Promise<OutboxEntry | null> {
  const row = await (await db()).getFirstAsync<{ payload: string; attempts: number; next_attempt: number; state: string }>(
    "SELECT payload, attempts, next_attempt, state FROM field_outbox WHERE owner = ? AND state != 'synced' ORDER BY sequence LIMIT 1", owner);
  return row ? { record: JSON.parse(row.payload), attempts: row.attempts, nextAttempt: row.next_attempt, blocked: row.state === 'blocked' } : null;
}
export async function saveFieldTask(record: PendingFieldRecord, taskId: string) {
  record.taskId = taskId;
  await (await db()).runAsync('UPDATE field_outbox SET payload = ? WHERE id = ? AND owner = ?', JSON.stringify(record), record.id, record.owner);
}
export async function markFieldComplete(record: PendingFieldRecord) {
  const connection = await db();
  await connection.runAsync("UPDATE field_outbox SET state = 'synced', payload = ?, last_error = NULL WHERE id = ? AND owner = ?", JSON.stringify(record), record.id, record.owner);
  // Keep the last confirmed local status across restarts, without unbounded history growth.
  await connection.runAsync("DELETE FROM field_outbox WHERE owner = ? AND state = 'synced' AND sequence < (SELECT MAX(sequence) FROM field_outbox WHERE owner = ? AND state = 'synced')", record.owner, record.owner);
}
export async function markFieldFailed(record: PendingFieldRecord, attempts: number, next: number, blocked: boolean, message: string) {
  await (await db()).runAsync('UPDATE field_outbox SET attempts = ?, next_attempt = ?, state = ?, last_error = ? WHERE id = ? AND owner = ?', attempts, next, blocked ? 'blocked' : 'pending', message, record.id, record.owner);
}
export async function latestLocalFieldRecord(owner: string): Promise<(PendingFieldRecord & { synced: boolean }) | null> {
  const row = await (await db()).getFirstAsync<{ payload: string; state: string }>('SELECT payload, state FROM field_outbox WHERE owner = ? ORDER BY sequence DESC LIMIT 1', owner);
  return row ? { ...JSON.parse(row.payload), synced: row.state === 'synced' } : null;
}
export async function fieldOutboxSummary(owner: string) {
  const row = await (await db()).getFirstAsync<{ count: number; blocked: number }>("SELECT COUNT(*) AS count, COALESCE(SUM(state = 'blocked'), 0) AS blocked FROM field_outbox WHERE owner = ? AND state != 'synced'", owner);
  const first = await (await db()).getFirstAsync<{ last_error: string | null }>("SELECT last_error FROM field_outbox WHERE owner = ? AND state != 'synced' ORDER BY sequence LIMIT 1", owner);
  return { ...(row || { count: 0, blocked: 0 }), error: first?.last_error || null };
}
export async function retryPendingFieldRecords(owner: string, includeBlocked = true) {
  await (await db()).runAsync(includeBlocked
    ? "UPDATE field_outbox SET state = 'pending', next_attempt = 0 WHERE owner = ? AND state != 'synced'"
    : "UPDATE field_outbox SET next_attempt = 0 WHERE owner = ? AND state = 'pending'", owner);
}
export async function cacheFieldProjects(owner: string, projects: Project[]) {
  await (await db()).runAsync('INSERT OR REPLACE INTO field_projects(owner, payload) VALUES (?, ?)', owner, JSON.stringify(projects));
}
export async function readFieldProjects(owner: string): Promise<Project[]> {
  const row = await (await db()).getFirstAsync<{ payload: string }>('SELECT payload FROM field_projects WHERE owner = ?', owner);
  const value = row ? JSON.parse(row.payload) : [];
  return Array.isArray(value) ? value : [];
}
