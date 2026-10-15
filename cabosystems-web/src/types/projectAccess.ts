import type { Proyecto } from './projects';
import type { Profile } from './fleet';

export interface Development { id: string; nombre: string; created_at: string }
export interface ProjectVilla extends Proyecto { desarrollo_id: string; integrador_id: string | null; tecnico_id: string | null; equipo_revision: number }
export interface ProjectMember { proyecto_id: string; usuario_id: string }
export interface AccessGrant { usuario_id: string; desarrollo_id?: string; created_at: string }
export interface ProjectDirectory {
  developments: Development[]; villas: ProjectVilla[]; members: ProjectMember[];
  globalGrants: AccessGrant[]; developmentGrants: AccessGrant[]; staff: Profile[];
}
