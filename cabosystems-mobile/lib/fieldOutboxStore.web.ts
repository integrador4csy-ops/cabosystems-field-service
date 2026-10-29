// Native outbox storage must not pull SQLite/WASM into the web bundle.
import type { PendingFieldRecord, OutboxEntry } from './fieldOutbox';
import type { Project } from '@/types/database';
const unavailable = () => { throw new Error('La cola de registros sin conexión está disponible en la app móvil.'); };
export async function savePendingFieldRecord(_record: PendingFieldRecord): Promise<void> { unavailable(); }
export async function firstPendingFieldRecord(_owner: string): Promise<OutboxEntry | null> { return null; }
export async function saveFieldTask(_record: PendingFieldRecord, _taskId: string): Promise<void> { unavailable(); }
export async function markFieldComplete(_record: PendingFieldRecord): Promise<void> { unavailable(); }
export async function markFieldFailed(_record: PendingFieldRecord, _attempts: number, _next: number, _blocked: boolean, _message: string): Promise<void> { unavailable(); }
export async function latestLocalFieldRecord(_owner: string): Promise<PendingFieldRecord | null> { return null; }
export async function fieldOutboxSummary(_owner: string) { return { count: 0, blocked: 0, error: null as string | null }; }
export async function retryPendingFieldRecords(_owner: string, _includeBlocked = true): Promise<void> { unavailable(); }
export async function cacheFieldProjects(_owner: string, _projects: Project[]): Promise<void> { unavailable(); }
export async function readFieldProjects(_owner: string): Promise<Project[]> { return []; }
