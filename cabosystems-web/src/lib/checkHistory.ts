import { supabase } from './supabase';

export type CheckType = 'check_in' | 'check_out';

export interface AdminCheckHistoryItem {
  id: string;
  technician_id: string;
  technician_name: string;
  technician_avatar_url: string | null;
  check_type: CheckType;
  checked_at: string;
  local_day: string;
  latitude: number;
  longitude: number;
  photo_url: string;
  comments: string | null;
  task_id: string | null;
  project_id: string;
  villa: string;
  development: string;
}

export async function getAdminCheckHistory(day: string, technicianId?: string | null): Promise<AdminCheckHistoryItem[]> {
  const { data, error } = await supabase.rpc('list_admin_check_history', {
    p_day: day,
    p_user_id: technicianId || null,
  });
  if (error) throw error;
  return (data || []) as AdminCheckHistoryItem[];
}
