export async function updateTask(_id: string, values: unknown) { document.querySelector('main > p')!.textContent = `Guardado de prueba: ${JSON.stringify(values)}`; }
export async function createTask() { return { id: 'demo-task' }; }
export async function createSubtask() {}
