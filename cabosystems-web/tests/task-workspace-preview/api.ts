// Isolated visual preview: task/project writes never leave this page.
export async function createProject() { return { id: 'preview-project' }; }
export async function updateProject() {}
export async function createTask() { return { id: 'preview-task' }; }
export async function updateTask() {}
export async function deleteTask() {}
export async function createSubtask() { return { id: 'preview-subtask' }; }
export async function toggleSubtask() {}
export async function deleteSubtask() {}
