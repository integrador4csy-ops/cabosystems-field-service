import type { CheckInType } from '@/types/database';

export interface PendingFieldRecord {
  id: string;
  owner: string;
  projectId: string;
  taskId: string | null;
  photoUri: string;
  remotePhotoUrl?: string;
  capturedAt: string;
  tipo: CheckInType;
  latitude: number;
  longitude: number;
  comments: string | null;
}
export interface OutboxEntry {
  record: PendingFieldRecord;
  attempts: number;
  nextAttempt: number;
  blocked: boolean;
}
export interface FieldOutboxDependencies {
  first(owner: string): Promise<OutboxEntry | null>;
  send(record: PendingFieldRecord): Promise<void>;
  complete(record: PendingFieldRecord): Promise<void>;
  fail(record: PendingFieldRecord, attempts: number, nextAttempt: number, blocked: boolean, message: string): Promise<void>;
  active(owner: string): boolean;
  now(): number;
}
export function isPermanentFieldError(error: unknown) {
  const value = error as { code?: string; status?: number; statusCode?: string | number };
  const status = Number(value?.status ?? value?.statusCode);
  return ['42501', '23503', '23514', '22P02', 'PGRST116', 'LOCAL_PHOTO_MISSING'].includes(value?.code || '') || [400, 403, 404, 413, 415].includes(status);
}
/** One worker, FIFO, bounded backoff. A rejected arrival must not be overtaken by a departure. */
export function createFieldOutboxWorker(deps: FieldOutboxDependencies) {
  let running: Promise<void> | undefined;
  return (owner: string): Promise<void> => {
    if (running) return running;
    const drain = async () => {
      while (deps.active(owner)) {
        const entry = await deps.first(owner);
        if (!entry || entry.blocked || entry.nextAttempt > deps.now() || !deps.active(owner)) return;
        try {
          await deps.send(entry.record);
          await deps.complete(entry.record);
        } catch (error) {
          const attempts = entry.attempts + 1;
          const message = (error as { code?: string })?.code === '42501'
            ? 'No tienes permiso para enviar este registro. Solicita que revisen tu acceso y la tarea asignada en esta villa; después pulsa Reintentar.'
            : error instanceof Error ? error.message : (error as { message?: string })?.message || 'No se pudo sincronizar el registro.';
          await deps.fail(entry.record, attempts, deps.now() + Math.min(300_000, 5000 * 2 ** Math.min(attempts - 1, 6)), isPermanentFieldError(error), message);
          return;
        }
      }
    };
    running = drain().finally(() => { running = undefined; });
    return running;
  };
}
