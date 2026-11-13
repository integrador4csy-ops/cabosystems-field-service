import type { Profile } from '../types/fleet';

const NON_ASSIGNABLE_TASK_ROLES = new Set([
  'admin',
  'supervisor_instalacion',
  'aux_operaciones',
]);

export function isEligibleTaskAssignee(profile: Pick<Profile, 'rol' | 'role' | 'activo'>): boolean {
  const role = profile.rol || profile.role || '';
  return profile.activo !== false && !NON_ASSIGNABLE_TASK_ROLES.has(role);
}
