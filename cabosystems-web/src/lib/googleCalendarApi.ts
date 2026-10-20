import { supabase } from './supabase';

export interface GoogleCalendar { id: string; name: string; timeZone: string; accessRole: string; primary: boolean }
export interface GoogleCalendarStatus {
  configured: boolean; connected: boolean; revision: string; account: string | null;
  selectedCalendars: GoogleCalendar[]; connectedAt: string | null; syncEnabled: boolean;
}
export async function calendarRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('google-calendar', { body });
  if (error) {
    // Provider messages are already sanitized by the server; never expose an
    // arbitrary upstream response or Supabase diagnostic to the interface.
    let message = '';
    try {
      if (error.context instanceof Response) {
        const result = await error.context.clone().json();
        if (typeof result.error === 'string') message = result.error;
      }
    } catch { /* Use the localized fallback when the function is unavailable. */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}
