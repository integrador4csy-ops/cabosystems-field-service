import { supabase } from './supabase';
import type { Profile } from '../types/fleet';
import type { Invitacion } from '../types/admin';
export async function teamProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Profile[];
}
export async function teamInvitations() {
  const { data, error } = await supabase.from('invitaciones').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as Invitacion[];
}
