import { eventsHandler } from '../_shared/google-calendar/events.ts';
import { calendarRuntime } from '../_shared/google-calendar/runtime.ts';

Deno.serve(eventsHandler(calendarRuntime()));
