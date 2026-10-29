import type { Profile, Task } from '@/types/database';

export interface TaskPermissions { user_id: string; can_progress: boolean; can_edit: boolean }

/** Progress follows villa/development/global access, never the task assignee. */
export function canUpdateTaskProgress(task: (Pick<Task, 'asignado_a'> & { permissions?: TaskPermissions }) | null, profile: Pick<Profile, 'id' | 'rol' | 'activo'> | null): boolean {
  if (!task || !profile?.activo) return false;
  if (task.permissions) return task.permissions.user_id === profile.id && task.permissions.can_progress === true;
  return false;
}
