import { callbackHandler } from '../_shared/google-calendar/handlers.ts';
import { calendarRuntime } from '../_shared/google-calendar/runtime.ts';

// Google cannot supply a Supabase JWT. Authentication is an expiring, hashed,
// single-use state bound to a canonical active admin plus a PKCE verifier.
Deno.serve(callbackHandler(calendarRuntime()));
