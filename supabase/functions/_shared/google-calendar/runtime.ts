import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { createCalendarService } from './core.ts';
import { createStore } from './store.ts';

export function calendarRuntime() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return createCalendarService({ store: createStore(db), clientId: Deno.env.get('GOOGLE_CALENDAR_CLIENT_ID') || '', clientSecret: Deno.env.get('GOOGLE_CALENDAR_CLIENT_SECRET') || '', redirectUri: `${url}/functions/v1/google-calendar-callback` });
}
