import { supabase } from './supabase';

export type WarrantyStatus = 'registered' | 'review' | 'waiting' | 'resolved' | 'rejected';
export type WarrantyArea = 'project' | 'laboratory' | 'operations' | 'supplier' | 'client';

export interface WarrantyPerson {
  id: string;
  nombre: string;
  rol?: string;
}

export interface WarrantyProject {
  id: string;
  desarrollo: string;
  villa: string;
}

export interface WarrantyUpdate {
  id: string;
  status: WarrantyStatus;
  area: WarrantyArea;
  note: string;
  created_at: string;
  actor: WarrantyPerson | null;
}

export interface WarrantyCase {
  id: string;
  case_number: number;
  project_id: string | null;
  location: string;
  equipment: string;
  serial_number: string | null;
  mac_address: string | null;
  issue: string;
  responsible_id: string;
  status: WarrantyStatus;
  area: WarrantyArea;
  warranty_until: string | null;
  last_note: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  responsible: WarrantyPerson | null;
  project: WarrantyProject | null;
  updates: WarrantyUpdate[];
}

export interface CreateWarrantyCaseInput {
  project_id?: string | null;
  location: string;
  equipment: string;
  serial_number?: string | null;
  mac_address?: string | null;
  issue: string;
  responsible_id: string;
  area: WarrantyArea;
  warranty_until?: string | null;
  last_note?: string;
}

export interface UpdateWarrantyCaseInput {
  status: WarrantyStatus;
  area: WarrantyArea;
  warranty_until?: string | null;
  last_note: string;
}

const client = supabase as any;
const caseSelection = `
  *,
  responsible:profiles!warranty_cases_responsible_id_fkey(id,nombre,rol),
  project:proyectos(id,desarrollo,villa),
  updates:warranty_case_updates(
    id,status,area,note,created_at,
    actor:profiles!warranty_case_updates_actor_id_fkey(id,nombre,rol)
  )
`;

function normalizeCase(row: any): WarrantyCase {
  return {
    ...row,
    responsible: Array.isArray(row.responsible) ? row.responsible[0] ?? null : row.responsible,
    project: Array.isArray(row.project) ? row.project[0] ?? null : row.project,
    updates: [...(row.updates || [])]
      .map((update: any) => ({ ...update, actor: Array.isArray(update.actor) ? update.actor[0] ?? null : update.actor }))
      .sort((a: WarrantyUpdate, b: WarrantyUpdate) => Date.parse(b.created_at) - Date.parse(a.created_at)),
  };
}

export async function getWarrantyCases(): Promise<WarrantyCase[]> {
  const { data, error } = await client.from('warranty_cases').select(caseSelection).order('updated_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeCase);
}

export async function getWarrantyProjects(): Promise<WarrantyProject[]> {
  const { data, error } = await client.from('proyectos').select('id,desarrollo,villa').order('desarrollo').order('villa');
  if (error) throw error;
  return data || [];
}

export async function createWarrantyCase(input: CreateWarrantyCaseInput): Promise<WarrantyCase> {
  const payload = {
    ...input,
    location: input.location.trim(),
    equipment: input.equipment.trim(),
    serial_number: input.serial_number?.trim() || null,
    mac_address: input.mac_address?.trim().toUpperCase() || null,
    issue: input.issue.trim(),
    last_note: input.last_note?.trim() || input.issue.trim(),
    warranty_until: input.warranty_until || null,
    project_id: input.project_id || null,
  };
  const { data, error } = await client.from('warranty_cases').insert(payload).select(caseSelection).single();
  if (error) throw error;
  return normalizeCase(data);
}

export async function updateWarrantyCase(id: string, input: UpdateWarrantyCaseInput): Promise<WarrantyCase> {
  const { data, error } = await client.from('warranty_cases').update({
    ...input,
    last_note: input.last_note.trim(),
    warranty_until: input.warranty_until || null,
  }).eq('id', id).select(caseSelection).single();
  if (error) throw error;
  void supabase.functions.invoke('operations-push-notifications', {
    body: { kind: 'warranty_update', entityId: id },
  }).then(({ error: notificationError }) => {
    if (notificationError) console.warn('Warranty notification failed:', notificationError);
  }).catch((notificationError) => console.warn('Warranty notification failed:', notificationError));
  return normalizeCase(data);
}

export async function deleteWarrantyCase(id: string): Promise<void> {
  const { error } = await client.from('warranty_cases').delete().eq('id', id);
  if (error) throw error;
}

export function warrantyFolio(caseNumber: number) {
  return `GAR-${String(caseNumber).padStart(4, '0')}`;
}
