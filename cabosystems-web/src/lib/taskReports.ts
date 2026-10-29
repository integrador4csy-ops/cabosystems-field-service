export type ReportPeriod = 'day' | 'week' | 'month' | 'custom';
export interface TaskActivity {
  id: number; fecha: string; actor_id: string; actor_name: string;
  proyecto_id: string; desarrollo: string; villa: string;
  tarea_id: string; tarea_titulo: string; subtarea_id: string | null; subtarea_titulo: string | null;
  accion: 'estado' | 'subtarea'; anterior: string | null; siguiente: string;
  estado_registrado: string; encargado_nombre: string | null; estado_actual: string | null;
  hasta_id: number;
}
export interface TaskReport {
  from: string; to: string; person: string; project: string; rows: TaskActivity[];
}
const key = (date: Date) => date.toISOString().slice(0, 10);
export function reportToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mazatlan', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-');
}
export function validReportDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-01-01' && value <= '9999-12-31' && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && key(new Date(`${value}T12:00:00Z`)) === value;
}
export function reportRange(period: Exclude<ReportPeriod, 'custom'>, anchor: string) {
  if (!validReportDate(anchor)) throw new Error('Fecha no válida');
  const from = new Date(`${anchor}T12:00:00Z`), to = new Date(from);
  if (period === 'week') { from.setUTCDate(from.getUTCDate() - (from.getUTCDay() + 6) % 7); to.setTime(from.getTime()); to.setUTCDate(to.getUTCDate() + 6); }
  if (period === 'month') { from.setUTCDate(1); to.setUTCMonth(to.getUTCMonth() + 1, 0); }
  return { from: key(from), to: key(to) };
}
export function reportSummary(rows: TaskActivity[]) {
  return { actions: rows.length, tasks: new Set(rows.map(row => row.tarea_id)).size,
    completed: new Set(rows.filter(row => row.accion === 'subtarea' && row.siguiente === 'true').map(row => row.subtarea_id)).size,
    reopened: rows.filter(row => row.accion === 'subtarea' && row.siguiente === 'false').length };
}
export function reportPeople(rows: TaskActivity[], locale = 'es-MX') {
  const groups = new Map<string, { id: string; name: string; lastId: number; rows: TaskActivity[] }>();
  for (const row of rows) {
    let group = groups.get(row.actor_id);
    if (!group) { group = { id: row.actor_id, name: row.actor_name, lastId: row.id, rows: [] }; groups.set(row.actor_id, group); }
    if (row.id >= group.lastId) { group.name = row.actor_name; group.lastId = row.id; }
    group.rows.push(row);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, locale) || a.id.localeCompare(b.id))
    .map(group => ({ ...group, rows: group.rows.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id - b.id) }));
}
export function reportStatus(value: string | null, en = false): string {
  return (en ? { pendiente: 'Pending', en_proceso: 'In progress', completada: 'Completed' } : { pendiente: 'Pendiente', en_proceso: 'En proceso', completada: 'Completada' })[value as 'pendiente'] || (en ? 'Deleted task' : 'Tarea eliminada');
}
export function reportAction(row: TaskActivity, en = false) {
  if (row.accion === 'subtarea') return row.siguiente === 'true' ? (en ? 'Subtask completed' : 'Subtarea completada') : (en ? 'Subtask reopened' : 'Subtarea reabierta');
  return `${row.anterior ? reportStatus(row.anterior, en) : (en ? 'Created' : 'Creada')} → ${reportStatus(row.siguiente, en)}`;
}
export function reportColumns(en = false) {
  return en ? ['Date', 'Performed by', 'Development', 'Villa', 'Task', 'Subtask', 'Action', 'Status at action', 'Current status', 'Assigned person at action'] : ['Fecha', 'Realizado por', 'Desarrollo', 'Villa', 'Tarea', 'Subtarea', 'Acción', 'Estado al registrar', 'Estado actual', 'Encargado al registrar'];
}
export function reportValues(row: TaskActivity, en = false): string[] {
  return [row.fecha, row.actor_name, row.desarrollo, row.villa, row.tarea_titulo, row.subtarea_titulo || '', reportAction(row, en), reportStatus(row.estado_registrado, en), reportStatus(row.estado_actual, en), row.encargado_nombre || (en ? 'Unassigned' : 'Sin asignar')];
}
