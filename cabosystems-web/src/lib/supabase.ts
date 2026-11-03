import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://nyqlfgnblkmijxspkvpi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im55cWxmZ25ibGttaWp4c3BrdnBpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxNTQ4OTEsImV4cCI6MjEwNDczMDg5MX0.KRv2R3wIafx6zHGYB4mhSD4p7OzN8mfWc_mq89JueR4';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

