export function matchesTaskAssignee(task: { asignado_a?: string | null }, assignee: string): boolean {
  return assignee === 'all' || (assignee === 'unassigned' ? !task.asignado_a : task.asignado_a === assignee);
}

export function sortTaskTitles<T extends { id: string; titulo: string }>(tasks: readonly T[], direction: 'asc' | 'desc', locale: string): T[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const multiplier = direction === 'desc' ? -1 : 1;
  return [...tasks].sort((a, b) => multiplier * (collator.compare(a.titulo, b.titulo) || collator.compare(a.id, b.id)));
}

export function sortTasksByPriority<T extends { id: string; titulo: string; prioridad?: 'alta' | 'media' | 'baja'; prioridad_orden?: number }>(tasks: readonly T[], direction: 'asc' | 'desc', locale: string): T[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const multiplier = direction === 'desc' ? -1 : 1;
  const rank = (task: T) => task.prioridad_orden ?? ({ alta: 1, media: 2, baja: 3 }[task.prioridad || 'media']);
  return [...tasks].sort((a, b) => rank(a) - rank(b) || multiplier * collator.compare(a.titulo, b.titulo) || collator.compare(a.id, b.id));
}
