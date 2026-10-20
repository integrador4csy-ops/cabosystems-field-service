import { apiHandler } from '../_shared/google-calendar/handlers.ts';
import { calendarRuntime } from '../_shared/google-calendar/runtime.ts';

Deno.serve(apiHandler(calendarRuntime()));
