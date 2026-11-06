import type { Profile } from '../types/fleet';

export type ProjectLeadKind = 'integrator' | 'technician';

const LEAD_ROLES: Record<ProjectLeadKind, ReadonlySet<string>> = {
  integrator: new Set(['integrador', 'aux_integracion']),
  technician: new Set(['tecnico', 'instalador', 'aux_instalacion']),
};

export function isEligibleProjectLead(person: Profile, kind: ProjectLeadKind): boolean {
  return person.activo === true && LEAD_ROLES[kind].has(person.rol || '');
}
