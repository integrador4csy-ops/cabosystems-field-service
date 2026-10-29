import { supabase } from './supabase';
import type { ApplyTemplateResult, TaskTemplate, TaskTemplateApplication } from './taskTemplates';

export async function getVillaTaskTemplate(projectId: string, signal: AbortSignal) {
  const [definition, application] = await Promise.all([
    supabase.from('project_task_templates').select('id,nombre,version,etapas').eq('id', 'csy-general').abortSignal(signal).single(),
    supabase.from('project_task_template_applications').select('version,contenido,tareas_creadas,subtareas_creadas,created_at').eq('proyecto_id', projectId).eq('plantilla_id', 'csy-general').abortSignal(signal).maybeSingle(),
  ]);
  if (definition.error) throw definition.error;
  if (application.error) throw application.error;
  return { template: definition.data as TaskTemplate, application: application.data as TaskTemplateApplication | null };
}

export async function saveTaskTemplate(template: TaskTemplate) {
  const { data, error } = await supabase.from('project_task_templates').update({ nombre: template.nombre.trim(), etapas: template.etapas }).eq('id', template.id).eq('version', template.version).select('id,nombre,version,etapas').single();
  if (error) throw error;
  return data as TaskTemplate;
}

export async function applyVillaTaskTemplate(projectId: string, template: TaskTemplate, selected: number[]) {
  const { data, error } = await supabase.rpc('apply_project_task_template', { p_proyecto_id: projectId, p_plantilla_id: template.id, p_version: template.version, p_etapas: selected });
  if (error) throw error;
  return data as ApplyTemplateResult;
}
