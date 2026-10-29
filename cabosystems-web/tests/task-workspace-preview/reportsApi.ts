import { reportToday, type TaskActivity } from '../../src/lib/taskReports';
export async function getTaskReportPeople() { return [{ id: 'preview', nombre: 'Integrador Cuatro' }]; }
export async function getTaskReport(from: string, to: string, person: string, project: string, signal: AbortSignal): Promise<TaskActivity[]> {
  signal.throwIfAborted();
  const rows: TaskActivity[] = [
    { id: 1, fecha: reportToday(), actor_id: 'preview', actor_name: 'Integrador Cuatro', proyecto_id: 'sol-1', desarrollo: 'Cabo del Sol', villa: 'Villa 01', tarea_id: '3', tarea_titulo: 'Levantamiento general de proyecto', subtarea_id: null, subtarea_titulo: null, accion: 'estado', anterior: 'pendiente', siguiente: 'en_proceso', estado_registrado: 'en_proceso', encargado_nombre: 'Supervisor de instalación', estado_actual: 'en_proceso', hasta_id: 3 },
    { id: 2, fecha: reportToday(), actor_id: 'preview', actor_name: 'Integrador Cuatro', proyecto_id: 'sol-1', desarrollo: 'Cabo del Sol', villa: 'Villa 01', tarea_id: '3', tarea_titulo: 'Levantamiento general de proyecto', subtarea_id: 'step-1', subtarea_titulo: 'Revisar planos', accion: 'subtarea', anterior: 'false', siguiente: 'true', estado_registrado: 'en_proceso', encargado_nombre: 'Supervisor de instalación', estado_actual: 'en_proceso', hasta_id: 3 },
    { id: 3, fecha: reportToday(), actor_id: 'preview', actor_name: 'Integrador Cuatro', proyecto_id: 'sol-1', desarrollo: 'Cabo del Sol', villa: 'Villa 01', tarea_id: '2', tarea_titulo: 'Instalación Savant lighting control', subtarea_id: null, subtarea_titulo: null, accion: 'estado', anterior: 'en_proceso', siguiente: 'completada', estado_registrado: 'completada', encargado_nombre: 'Supervisor de instalación', estado_actual: 'completada', hasta_id: 3 },
  ];
  return rows.filter(row => row.fecha >= from && row.fecha <= to && (!person || row.actor_id === person) && (!project || row.proyecto_id === project));
}
