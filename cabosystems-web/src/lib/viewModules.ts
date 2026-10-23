import { sharedModule } from './modulePreload';
import type { SectionResources } from '../context/SectionResources';
import { fleetSnapshot } from './fleetSnapshot';

// React.lazy and background warmup share the exact same import promise.
export const loadLiveMap = sharedModule(() => import('../components/LiveMap'));
export const loadChat = sharedModule(() => import('../components/chat/ChatView'));
export const loadTasks = sharedModule(() => import('../components/projects/ProjectsManagementView'));
export const loadAgenda = sharedModule(() => import('../components/agenda/CompanyAgenda'));
export const loadDirectory = sharedModule(() => import('../components/projects/ProjectDirectoryView'));
export const loadTeam = sharedModule(() => import('../components/team/TeamManagementView'));

/** A deliberate hover/focus downloads only the target's code, then queues its data. */
export async function preloadView(id: string, resources: SectionResources, userId: string, admin: boolean) {
  resources.setIntent(id);
  if (id === 'radar') { await loadLiveMap(); await resources.prefetch(() => resources.queries.load('fleet', fleetSnapshot, false, 10_000), id); return; }
  if (id === 'proyectos') { const module = await loadTasks(); await resources.prefetch(() => module.prefetchTasks(resources), id); }
  if (id === 'agenda') { const module = await loadAgenda(); await resources.prefetch(() => module.prefetchAgenda(resources), id); }
  if (id === 'directorio-proyectos') { const module = await loadDirectory(); await resources.prefetch(() => module.prefetchDirectory(resources, admin), id); }
  if (id === 'chat') { const module = await loadChat(); await resources.prefetch(() => module.prefetchChat(resources, userId), id); }
  if (id === 'colaboradores' || id === 'invitaciones') { const module = await loadTeam(); if (admin) await resources.prefetch(() => module.prefetchTeam(resources, id), id); }
}
