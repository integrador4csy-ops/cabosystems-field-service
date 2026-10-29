export interface TaskTemplateStage { number: number; title: string; subtasks: string[] }
export interface TaskTemplate { id: string; nombre: string; version: number; etapas: TaskTemplateStage[] }
export interface TaskTemplateApplication { version: number; contenido: TaskTemplateStage[]; tareas_creadas: number; subtareas_creadas: number; created_at: string }
export interface ApplyTemplateResult { alreadyApplied: boolean; tasks: number; subtasks: number }

export function templateSelectionCounts(stages: TaskTemplateStage[], selected: number[]) {
  const numbers = new Set(selected);
  return stages.reduce((counts, stage) => numbers.has(stage.number) ? { tasks: counts.tasks + 1, subtasks: counts.subtasks + stage.subtasks.length } : counts, { tasks: 0, subtasks: 0 });
}

export function validTaskTemplate(template: TaskTemplate) {
  return template.nombre.trim().length > 0 && template.nombre.trim().length <= 200 && template.etapas.length > 0 && template.etapas.length <= 100
    && new Set(template.etapas.map(stage => stage.number)).size === template.etapas.length
    && template.etapas.every(stage => Number.isInteger(stage.number) && stage.number > 0 && stage.number < 1000 && stage.title.trim().length > 0 && stage.title.trim().length <= 400 && stage.subtasks.length <= 100 && stage.subtasks.every(title => title.trim().length > 0 && title.trim().length <= 500))
    && template.etapas.reduce((total, stage) => total + stage.subtasks.length, 0) <= 2000;
}
