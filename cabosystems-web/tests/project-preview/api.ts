import type { Development, ProjectDirectory, ProjectVilla } from '../../src/types/projectAccess';
const created_at = '2026-10-15T12:00:00Z';
const data: ProjectDirectory = {
  developments: [{ id: 'chileno', nombre: 'Chileno Bay', created_at }, { id: 'palmilla', nombre: 'Palmilla', created_at }, { id: 'querencia', nombre: 'Querencia', created_at }],
  villas: Array.from({ length: 7 }, (_, i) => ({ id: `villa-${i}`, desarrollo_id: i < 5 ? 'chileno' : 'palmilla', desarrollo: i < 5 ? 'Chileno Bay' : 'Palmilla', villa: `Villa ${String(i + 1).padStart(2, '0')}`, descripcion: i === 0 ? 'Integración de iluminación, audio y red residencial.' : null, estatus: 'activo' as const, integrador_id: i === 0 ? 'integrador' : null, tecnico_id: i === 0 ? 'tecnico' : null, equipo_revision: 0 })),
  members: [{ proyecto_id: 'villa-0', usuario_id: 'auxiliar' }],
  staff: [{ id: 'admin', nombre: 'Administrador de prueba', rol: 'admin', activo: true }, { id: 'integrador', nombre: 'Diego Martínez', rol: 'integrador', activo: true }, { id: 'tecnico', nombre: 'Ana Torres', rol: 'instalador', activo: true }, { id: 'auxiliar', nombre: 'Luis Mendoza', rol: 'aux_instalacion', activo: true }, { id: 'global', nombre: 'María López', rol: 'integrador', activo: true }],
  globalGrants: [{ usuario_id: 'global', created_at }], developmentGrants: [],
};
export async function getProjectDirectory() { return structuredClone(data); }
export async function createDevelopment(nombre: string) { const d = { id: crypto.randomUUID(), nombre, created_at }; data.developments.push(d); return d; }
export async function createVilla(d: Development, villa: string, descripcion: string) { const p: ProjectVilla = { id: crypto.randomUUID(), desarrollo_id: d.id, desarrollo: d.nombre, villa, descripcion, estatus: 'activo', integrador_id: null, tecnico_id: null, equipo_revision: 0 }; data.villas.push(p); return p; }
export async function saveProjectTeam(villa: ProjectVilla, integrador: string, tecnico: string, participants: string[]) { const p = data.villas.find(p => p.id === villa.id)!; if (p.equipo_revision !== villa.equipo_revision) throw { code: '40001' }; p.integrador_id = integrador || null; p.tecnico_id = tecnico || null; p.equipo_revision++; data.members = [...data.members.filter(m => m.proyecto_id !== p.id), ...participants.map(usuario_id => ({ proyecto_id: p.id, usuario_id }))]; }
export async function grantProjectAccess(usuario_id: string, desarrollo_id?: string) { if (desarrollo_id) data.developmentGrants.push({ usuario_id, desarrollo_id, created_at }); else data.globalGrants.push({ usuario_id, created_at }); }
export async function revokeProjectAccess(id: string, development?: string) { if (development) data.developmentGrants = data.developmentGrants.filter(g => g.usuario_id !== id || g.desarrollo_id !== development); else data.globalGrants = data.globalGrants.filter(g => g.usuario_id !== id); }
