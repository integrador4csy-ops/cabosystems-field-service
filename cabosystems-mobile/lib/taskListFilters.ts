export function matchesTaskAssignee(task: { asignado_a?: string | null }, assignee: string): boolean {
  return assignee === 'all' || (assignee === 'unassigned' ? !task.asignado_a : task.asignado_a === assignee);
}

export function sortTaskTitles<T extends { id: string; titulo: string }>(tasks: readonly T[], direction: 'asc' | 'desc', locale: string): T[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });
  const multiplier = direction === 'desc' ? -1 : 1;
  return [...tasks].sort((a, b) => multiplier * (collator.compare(a.titulo, b.titulo) || collator.compare(a.id, b.id)));
}
