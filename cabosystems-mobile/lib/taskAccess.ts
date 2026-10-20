import type { Profile, Task } from '@/types/database';

/** Read access to a villa does not grant permission to report others' progress. */
export function canUpdateTaskProgress(task: Pick<Task, 'asignado_a'> | null, profile: Pick<Profile, 'id' | 'rol' | 'activo'> | null): boolean {
  return Boolean(task && profile?.activo && (profile.rol === 'admin' || task.asignado_a === profile.id));
}
