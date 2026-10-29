import { AppState, Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';
import { getLatestFieldRecord } from './api';
import { createFieldOutboxWorker, type PendingFieldRecord } from './fieldOutbox';
import { firstPendingFieldRecord, savePendingFieldRecord, markFieldComplete, markFieldFailed, latestLocalFieldRecord, retryPendingFieldRecords, fieldOutboxSummary } from './fieldOutboxStore';
import { sendPendingFieldRecord } from './fieldOutboxRemote';
import { optimizeEvidencePhoto } from './evidencePhoto';
import type { FieldRecord } from '@/types/database';

let currentOwner = '';
let online = false;
let wake: (() => void) | undefined;
const listeners = new Set<() => void>();
export function subscribeFieldSync(callback: () => void) { listeners.add(callback); return () => { listeners.delete(callback); }; }
function notify() { listeners.forEach(listener => { try { listener(); } catch { /* UI listeners cannot invalidate a durable save. */ } }); }
export { fieldOutboxSummary };
const active = (owner: string) => currentOwner === owner && online && AppState.currentState === 'active';
const drain = createFieldOutboxWorker({
  first: firstPendingFieldRecord, active, now: Date.now,
  send: record => sendPendingFieldRecord(record, () => { if (!active(record.owner)) throw new Error('Sincronización pausada.'); }),
  complete: async record => {
    await markFieldComplete(record);
    // Only this app-owned outbox photo is removed, after server confirmation.
    const directory = `${FileSystem.documentDirectory}field-evidence/`;
    if (record.photoUri.startsWith(directory)) await FileSystem.deleteAsync(record.photoUri, { idempotent: true }).catch(() => {});
    notify();
  },
  fail: async (...args) => { await markFieldFailed(...args); notify(); },
});

/** Synchronizes on reconnect/resume and backs off when the server is unavailable. */
export function startFieldSync(owner: string) {
  if (Platform.OS === 'web' || !owner) return () => {};
  currentOwner = owner;
  online = false;
  let stopped = false;
  let running = false;
  let rerunRequested = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = async () => {
    if (running) { rerunRequested = true; return; }
    rerunRequested = false;
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (stopped || !active(owner)) return;
    running = true;
    try { await drain(owner); }
    catch { notify(); }
    finally {
      try {
        if (!stopped && active(owner)) {
          const next = await firstPendingFieldRecord(owner);
          if (!stopped && active(owner) && next && !next.blocked) timer = setTimeout(run, Math.max(1000, next.nextAttempt - Date.now()));
        }
      } catch {
        if (!stopped && active(owner)) timer = setTimeout(run, 30_000);
      }
      running = false;
      if (rerunRequested && !stopped) void run();
    }
  };
  wake = () => { void run(); };
  const resume = async () => {
    try { await retryPendingFieldRecords(owner, false); }
    catch { notify(); }
    if (!stopped) void run();
  };
  const unsubscribe = NetInfo.addEventListener(state => {
    if (stopped) return;
    const wasOnline = online;
    online = state.isConnected === true && state.isInternetReachable !== false;
    if (online && !wasOnline) void resume();
    else if (online) void run();
    else if (timer) { clearTimeout(timer); timer = undefined; }
  });
  const subscription = AppState.addEventListener('change', state => {
    if (state === 'active') void resume();
    else if (timer) { clearTimeout(timer); timer = undefined; }
  });
  return () => {
    stopped = true; unsubscribe(); subscription.remove();
    if (timer) clearTimeout(timer);
    if (currentOwner === owner) { currentOwner = ''; wake = undefined; }
  };
}

export async function queueFieldRecord(input: Omit<PendingFieldRecord, 'id' | 'taskId' | 'capturedAt'>) {
  if (!input.owner || !input.projectId || !input.photoUri || !Number.isFinite(input.latitude) || !Number.isFinite(input.longitude) || Math.abs(input.latitude) > 90 || Math.abs(input.longitude) > 180) throw new Error('Faltan la foto, el GPS o la villa del registro.');
  if (!FileSystem.documentDirectory) throw new Error('No se puede guardar el registro en este dispositivo.');
  const id = Crypto.randomUUID();
  const capturedAt = new Date().toISOString();
  const directory = `${FileSystem.documentDirectory}field-evidence/`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const photoUri = `${directory}${id}.jpg`;
  const optimized = await optimizeEvidencePhoto(input.photoUri);
  try {
    await FileSystem.copyAsync({ from: optimized, to: photoUri });
    await savePendingFieldRecord({ ...input, id, taskId: null, photoUri, capturedAt });
  } catch (error) {
    await FileSystem.deleteAsync(photoUri, { idempotent: true }).catch(() => {});
    throw error;
  } finally {
    if (optimized !== input.photoUri) await FileSystem.deleteAsync(optimized, { idempotent: true }).catch(() => {});
  }
  notify(); wake?.();
  return id;
}
export async function retryFieldSync(owner: string) { await retryPendingFieldRecords(owner); notify(); wake?.(); }
export async function getLatestOfflineFieldRecord(owner: string): Promise<FieldRecord | null> {
  let local = Platform.OS === 'web' ? null : await latestLocalFieldRecord(owner).catch(() => null);
  const asRecord = (saved: PendingFieldRecord): FieldRecord => ({ id: saved.id, tarea_id: saved.taskId || '', tecnico_id: owner, tipo: saved.tipo, latitud: saved.latitude, longitud: saved.longitude, foto_url: saved.remotePhotoUrl || saved.photoUri, comentarios: saved.comments, fecha_hora: saved.capturedAt });
  if (local && !local.synced) return asRecord(local);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let remote: FieldRecord | null;
  try {
    remote = await Promise.race([getLatestFieldRecord(owner).catch(() => null), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 2500); })]);
  } finally { if (timer) clearTimeout(timer); }
  // A new local arrival/departure may have been saved while the network read was in flight.
  if (Platform.OS !== 'web') local = await latestLocalFieldRecord(owner).catch(() => local);
  if (local && !local.synced) return asRecord(local);
  if (!local || remote && Date.parse(remote.fecha_hora) > Date.parse(local.capturedAt)) return remote;
  return asRecord(local);
}
