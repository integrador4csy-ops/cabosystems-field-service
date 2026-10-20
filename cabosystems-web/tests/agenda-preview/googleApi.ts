// Isolated preview only. No network or access to Google/Supabase.
const calendars = [
  { id: 'test-office', name: 'Pruebas CaboSystems', timeZone: 'America/Mazatlan', accessRole: 'owner', primary: true },
  { id: 'test-read', name: 'Calendario de consulta', timeZone: 'America/Mazatlan', accessRole: 'reader', primary: false },
];
let selected: typeof calendars = [];
let revision = 'preview';
export async function calendarRequest<T>(body: Record<string, unknown>): Promise<T> {
  if (body.action === 'status') return { configured: true, connected: true, revision, account: 'cuenta-de-prueba@example.test', selectedCalendars: selected, connectedAt: '2026-10-20T18:00:00Z', syncEnabled: true } as T;
  if (body.action === 'calendars') return { revision, calendars } as T;
  if (body.action === 'select') {
    selected = calendars.filter((calendar) => (body.calendarIds as string[]).includes(calendar.id));
    revision = crypto.randomUUID(); return { saved: true, syncEnabled: false } as T;
  }
  throw new Error('La previsualización no autoriza cuentas reales.');
}
