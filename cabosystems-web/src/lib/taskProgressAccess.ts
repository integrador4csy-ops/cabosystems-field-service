export interface TaskProgressScope {
  userId?: string | null;
  role?: string | null;
  active?: boolean | null;
  fullTaskProjectIds?: ReadonlySet<string> | readonly string[];
}

export interface ProjectScopeCandidate {
  id: string;
  desarrollo_id?: string | null;
  integrador_id?: string | null;
  tecnico_id?: string | null;
}

export interface UserTaskAccessGrants {
  userId: string | null;
  allTaskProjectIds: readonly string[];
  developmentIds: readonly string[];
}

/** Resolve project IDs where the user holds villa-wide progress access (lead, All villa tasks participant, or development grant). */
export function resolveFullTaskProjectIds(
  projects: readonly ProjectScopeCandidate[],
  grants: UserTaskAccessGrants,
): string[] {
  if (!grants.userId) return [];
  const participantProjects = new Set(grants.allTaskProjectIds);
  const developments = new Set(grants.developmentIds);
  return projects
    .filter((project) =>
      project.integrador_id === grants.userId
      || project.tecnico_id === grants.userId
      || participantProjects.has(project.id)
      || Boolean(project.desarrollo_id && developments.has(project.desarrollo_id))
    )
    .map((project) => project.id);
}

/** Build a normalized TaskProgressScope from auth user/profile state and resolved villa-wide IDs. */
export function buildTaskProgressScope(
  userId?: string | null,
  profile?: { rol?: string | null; activo?: boolean | null } | null,
  fullTaskProjectIds?: ReadonlySet<string> | readonly string[],
): TaskProgressScope {
  return {
    userId,
    role: profile?.rol,
    active: profile ? profile.activo === true : undefined,
    fullTaskProjectIds,
  };
}

/** Mirror private.task_progress_allowed: direct assignees, admin/supervisor roles, and villa-wide members may update task progress. */
export function canProgressTask(
  task: { proyecto_id: string; asignado_a: string | null },
  scope: TaskProgressScope,
): boolean {
  if (!scope.userId || scope.active === false) return false;
  if (scope.role === 'admin' || scope.role === 'supervisor_instalacion') return true;
  if (task.asignado_a === scope.userId) return true;
  const allowed = scope.fullTaskProjectIds;
  if (!allowed) return false;
  return Array.isArray(allowed) ? allowed.includes(task.proyecto_id) : (allowed as ReadonlySet<string>).has(task.proyecto_id);
}
