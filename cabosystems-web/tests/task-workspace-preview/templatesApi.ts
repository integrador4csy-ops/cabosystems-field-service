import stages from '../../../supabase/seeds/villa-task-template.json';
import type { ApplyTemplateResult, TaskTemplate, TaskTemplateApplication } from '../../src/lib/taskTemplates';
import type { Tarea } from '../../src/types/projects';
let template: TaskTemplate = { id: 'csy-general', nombre: 'Plantilla general CaboSystems', version: 1, etapas: structuredClone(stages) };
const applications = new Map<string, TaskTemplateApplication>();
const created: Tarea[] = [];
export async function getVillaTaskTemplate(projectId: string, signal: AbortSignal) {
  signal.throwIfAborted();
  return { template: structuredClone(template), application: structuredClone(applications.get(projectId) ?? null) };
}
export async function saveTaskTemplate(draft: TaskTemplate) {
  if (draft.version !== template.version) throw { code: 'PGRST116' };
  template = { ...structuredClone(draft), version: template.version + 1 }; return structuredClone(template);
}
export async function applyVillaTaskTemplate(projectId: string, definition: TaskTemplate, selected: number[]): Promise<ApplyTemplateResult> {
  const previous = applications.get(projectId);
  if (previous) return { alreadyApplied: true, tasks: previous.tareas_creadas, subtasks: previous.subtareas_creadas };
  if (definition.version !== template.version) throw { code: '40001' };
  const contents = template.etapas.filter(stage => selected.includes(stage.number));
  for (const stage of contents) {
    const id = crypto.randomUUID();
    created.push({ id, proyecto_id: projectId, titulo: `${stage.number}. ${stage.title}`, descripcion: null, estatus: 'pendiente', asignado_a: null, fecha_programada: null, orden_plantilla: stage.number, subtareas: stage.subtasks.map((title, index) => ({ id: crypto.randomUUID(), tarea_id: id, titulo: `${stage.number}.${index + 1} ${title}`, completada: false, orden_plantilla: index + 1 })) });
  }
  const result = { alreadyApplied: false, tasks: contents.length, subtasks: contents.reduce((n, stage) => n + stage.subtasks.length, 0) };
  applications.set(projectId, { version: template.version, contenido: structuredClone(contents), tareas_creadas: result.tasks, subtareas_creadas: result.subtasks, created_at: new Date().toISOString() });
  return result;
}
export function readTemplatePreviewTasks() { return structuredClone(created); }
