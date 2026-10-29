import { supabase } from './supabase';
import { validReportDate, type TaskActivity } from './taskReports';

export async function getTaskReportPeople(signal: AbortSignal): Promise<{ id: string; nombre: string }[]> {
  const { data, error } = await supabase.rpc('get_task_activity_people').abortSignal(signal);
  if (error) throw error;
  return data || [];
}

/** Keyset pagination and a frozen upper ID avoid skipped/duplicated actions. */
export async function getTaskReport(from: string, to: string, person: string, project: string, signal: AbortSignal): Promise<TaskActivity[]> {
  if (!validReportDate(from) || !validReportDate(to) || from > to) throw new Error('Periodo no válido');
  const rows: TaskActivity[] = [];
  let after = 0, until: number | null = null;
  for (;;) {
    signal.throwIfAborted();
    const { data, error } = await supabase.rpc('get_task_activity_report', { p_from: from, p_to: to, p_actor: person || null, p_project: project || null, p_after: after, p_until: until, p_limit: 500 }).abortSignal(signal);
    if (error) throw error;
    const page = (data || []) as TaskActivity[];
    if (!page.length) break;
    if (until === null) until = page[0].hasta_id;
    const next = page[page.length - 1].id;
    if (!Number.isSafeInteger(next) || next <= after || !Number.isSafeInteger(until)) throw new Error('No se pudo completar el informe');
    rows.push(...page); after = next;
    if (page.length < 500 || after >= until!) break;
  }
  return rows;
}
