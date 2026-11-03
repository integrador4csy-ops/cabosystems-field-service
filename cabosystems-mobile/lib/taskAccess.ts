import type { Profile, Task } from '@/types/database';

export interface TaskPermissions {
  user_id: string;
  can_view: boolean;
  can_view_all: boolean;
  can_progress: boolean;
  can_edit: boolean;
}

/** Trust the server capability matrix; assignment and full-scope access are resolved by RLS. */
export function canUpdateTaskProgress(task: (Pick<Task, 'asignado_a'> & { permissions?: TaskPermissions }) | null, profile: Pick<Profile, 'id' | 'rol' | 'activo'> | null): boolean {
  if (!task || !profile?.activo) return false;
  if (task.permissions) return task.permissions.user_id === profile.id && task.permissions.can_progress === true;
  return false;
}
