import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from '../../src/context/LanguageContext';
import { TaskWorkspace } from '../../src/components/projects/TaskWorkspace';
import type { Proyecto, Tarea } from '../../src/types/projects';
import './preview.css';
import { readTemplatePreviewTasks } from './templatesApi';
const projects: Proyecto[] = [
  { id: 'sol-1', desarrollo: 'Cabo del Sol', villa: 'Villa 01', descripcion: null, estatus: 'activo' },
  { id: 'sol-3', desarrollo: 'Cabo del Sol', villa: 'Villa 03', descripcion: null, estatus: 'activo' },
  { id: 'chileno', desarrollo: 'Chileno Bay', villa: 'PH1', descripcion: null, estatus: 'activo' },
  { id: 'dorado', desarrollo: 'El Dorado', villa: 'Casa 01', descripcion: null, estatus: 'activo' },
  { id: 'empty', desarrollo: 'El Dorado', villa: 'Casa 02', descripcion: null, estatus: 'activo' },
];
const staff = [{ id: 'preview', nombre: 'Administrador de prueba', rol: 'admin', avatar_url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"%3E%3Cpath fill="%23e2e8f0" d="M0 0h64v64H0z"/%3E%3Ccircle cx="32" cy="24" r="12" fill="%2364748b"/%3E%3Cpath d="M10 64V53a22 22 0 0 1 44 0v11" fill="%2364748b"/%3E%3C/svg%3E' }];
const initial: Tarea[] = [
  { id: '1', proyecto_id: 'chileno', titulo: 'Integración home theater y audio multi-zona', estatus: 'pendiente', asignado_a: 'preview', descripcion: null, profiles: staff[0] },
  { id: '2', proyecto_id: 'sol-1', titulo: 'Instalación Savant lighting control', estatus: 'pendiente', asignado_a: 'preview', descripcion: null, profiles: staff[0] },
  { id: '3', proyecto_id: 'sol-1', titulo: 'Levantamiento general de proyecto', estatus: 'en_proceso', asignado_a: 'preview', descripcion: null, profiles: staff[0], subtareas: [{ id: 'step-1', tarea_id: '3', titulo: 'Revisar planos', completada: true }, { id: 'step-2', tarea_id: '3', titulo: '5.3 Suministro de gabinetes empotrados y revisión de dimensiones de mobiliario', completada: false }] },
  { id: '4', proyecto_id: 'sol-3', titulo: 'Comisionado controlador Crestron 4-Series', estatus: 'en_proceso', asignado_a: 'preview', descripcion: null, profiles: staff[0] },
  { id: '5', proyecto_id: 'dorado', titulo: 'Configuración de red y WiFi mesh', estatus: 'completada', asignado_a: 'preview', descripcion: null, profiles: staff[0] },
];
function Preview() {
  const [tasks, setTasks] = useState(initial);
  const [query, setQuery] = useState('');
  const [createVersion, setCreateVersion] = useState(0);
  return <main style={{ height: 'var(--app-viewport-height)', display: 'flex', flexDirection: 'column', padding: 16, gap: 12, fontFamily: 'Outfit,sans-serif', background: '#f9fafb' }}>
    <header style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}><h1 style={{ fontSize: 20 }}>Tareas</h1><input aria-label="Buscar tareas" placeholder="Buscar tareas" value={query} onChange={event => setQuery(event.target.value)} style={{ flex: 1, minWidth: 150, padding: 10, border: '1px solid #e4e7ec', borderRadius: 8, background: '#fff' }}/><button className="workspace-primary" onClick={() => setCreateVersion(value => value + 1)}>Nueva tarea</button></header>
    <p style={{ fontSize: 12 }}>Vista de prueba · datos ficticios · sin conexión a Supabase</p>
    <TaskWorkspace mode="tasks" projects={projects} tasks={tasks} staff={staff} loading={false} error={null} searchQuery={query} createVersion={createVersion} onReload={async () => setTasks([...initial, ...readTemplatePreviewTasks()])} onDeleteProject={async () => {}} onMoveTask={async (task, estatus) => setTasks(previous => previous.map(item => item.id === task.id ? { ...item, estatus } : item))}/>
  </main>;
}
createRoot(document.getElementById('root')!).render(<LanguageProvider><Preview /></LanguageProvider>);
