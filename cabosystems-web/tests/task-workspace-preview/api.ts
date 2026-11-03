// Isolated visual preview: task/project writes never leave this page.
export async function createProject() { return { id: 'preview-project' }; }
export async function updateProject() {}
export async function createTask() { return { id: 'preview-task' }; }
export async function updateTask() {}
export async function deleteTask() {}
export async function createSubtask() { return { id: 'preview-subtask' }; }
export async function toggleSubtask() {}
export async function deleteSubtask() {}
export async function recordTaskProgress() { return { id: 4, request_id: 'preview', actor_name: 'Administrador de prueba' }; }
export async function getTaskProgressHistory(taskId: string) { return taskId === '3' ? [{ id: 1, request_id: 'preview-1', actor_name: 'Administrador de prueba', tarea_id: taskId, subtarea_id: 'step-1', subtarea_titulo: 'Revisar planos', accion: 'subtarea', anterior: 'false', siguiente: 'true', comentario: 'Planos revisados con el supervisor.', evidencia_path: null, captured_at: new Date().toISOString(), accepted_at: new Date().toISOString(), evidence_url: null }] : []; }
