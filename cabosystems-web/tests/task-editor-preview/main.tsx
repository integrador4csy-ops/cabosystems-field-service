import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../src/context/LanguageContext';
import { CreateTaskModal } from '../../src/components/projects/CreateTaskModal';
import './preview.css';
const project = { id: 'demo', desarrollo: 'Cabo del Sol', villa: 'Villa 03', descripcion: null, estatus: 'activo' as const };
const task = { id: 'demo-task', proyecto_id: 'demo', asignado_a: 'demo-admin', titulo: 'Comisionado controlador Crestron 4-Series', descripcion: 'Actualización de firmware, emparejamiento de módulos y pruebas de escenas.', estatus: 'en_proceso' as const, fecha_programada: null };
function Preview() {
  const [open, setOpen] = useState(true);
  return <main style={{ padding: 24 }}><p>Vista de prueba · datos ficticios · sin conexión a Supabase</p><button onClick={() => setOpen(true)}>Editar tarea</button><CreateTaskModal isOpen={open} onClose={() => setOpen(false)} onSuccess={() => {}} project={project} taskToEdit={task} staffList={[{ id: 'demo-admin', nombre: 'Administrador de prueba', rol: 'admin' }]} /></main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Preview /></LanguageProvider>);
