import { supabase } from './supabase';
import type { AgendaGoogleCalendar, CompanyEvent, EventInput } from '../types/agenda';
import { expandCompanyEvents, validRecurrence } from './agendaRecurrence';

export interface CompanyBirthdayProfile {
  id: string;
  nombre: string | null;
  fecha_nacimiento: string | null;
}

export interface AgendaCollaborator {
  id: string;
  nombre: string;
  email: string;
  avatar_url?: string | null;
  rol?: string | null;
}

export const KNOWN_CSY_COLLABORATORS: Record<string, string> = {
  'danielh@csy.mx': 'Daniel Helguera',
  'operaciones1csy@gmail.com': 'Alessandra Collins Carrillo',
  'gsandoval@csy.mx': 'Gerardo Sandoval Castro',
  'carlosp@csy.mx': 'Carlos Perez',
  'instalaciones2.csy@gmail.com': 'Samuel Hernandez',
  'instalaciones1.csy@gmail.com': 'Instalaciones 1',
  'instalaciones3.csy@gmail.com': 'Instalaciones 3',
  'integrador1@csy.mx': 'Juan Salas Ruiz',
  'integrador2@csy.mx': 'Aaron Belmonte',
  'integrador3@csy.mx': 'Luis Eduardo Flores',
  'integrador4csy@gmail.com': 'Carlos Jesus Fregoso Zapata',
};

function deriveNameFromEmail(email: string): string {
  return email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
}

function isGenericCollaboratorName(name: string | undefined, email: string): boolean {
  const cleanName = (name || '').trim();
  if (!cleanName) return true;
  const lower = cleanName.toLowerCase();
  const cleanEmail = email.toLowerCase().trim();
  if (lower === cleanEmail || lower.includes('@')) return true;
  if (lower === deriveNameFromEmail(cleanEmail).toLowerCase()) return true;
  return /^(integrador|instalaciones|operaciones)\s*\d*$/i.test(cleanName);
}

export const INITIAL_COLLABORATORS: AgendaCollaborator[] = Object.entries(KNOWN_CSY_COLLABORATORS).map(([email, nombre]) => ({
  id: email,
  email,
  nombre,
  rol: 'colaborador',
  avatar_url: null,
}));

export async function getAgendaCollaborators(): Promise<AgendaCollaborator[]> {
  try {
    const [profilesRes, invsRes, googleAttendees] = await Promise.all([
      supabase.from('profiles').select('id, nombre, avatar_url, rol').eq('activo', true),
      supabase.from('invitaciones').select('id, email, rol').order('created_at', { ascending: false }),
      googleRequest<{ attendees: Array<{ email: string; displayName?: string; avatarUrl?: string }> }>({ action: 'attendees' }).catch(() => null),
    ]);

    const map = new Map<string, AgendaCollaborator>();
    const profileMatchedEmails = new Set<string>();

    for (const [email, name] of Object.entries(KNOWN_CSY_COLLABORATORS)) {
      const clean = email.toLowerCase().trim();
      map.set(clean, {
        id: clean,
        email: clean,
        nombre: name,
        rol: 'colaborador',
        avatar_url: null,
      });
    }

    for (const inv of (invsRes.data || [])) {
      if (!inv.email) continue;
      const clean = inv.email.toLowerCase().trim();
      const existing = map.get(clean);
      if (existing) {
        existing.id = inv.id;
        if (inv.rol) existing.rol = inv.rol;
      } else {
        map.set(clean, {
          id: inv.id,
          email: clean,
          nombre: deriveNameFromEmail(clean),
          rol: inv.rol || 'colaborador',
          avatar_url: null,
        });
      }
    }

    for (const p of (profilesRes.data || [])) {
      if (!p.nombre) continue;
      let matched: AgendaCollaborator | undefined;
      for (const item of map.values()) {
        if (item.nombre.toLowerCase() === p.nombre.toLowerCase()) {
          matched = item;
          break;
        }
      }
      if (matched) {
        matched.id = p.id;
        matched.avatar_url = p.avatar_url || matched.avatar_url;
        matched.rol = p.rol || matched.rol;
        matched.nombre = p.nombre;
        profileMatchedEmails.add(matched.email);
      } else {
        const fallbackEmail = `${p.nombre.toLowerCase().replace(/[^a-z0-9]/g, '')}@csy.mx`;
        map.set(fallbackEmail, {
          id: p.id,
          email: fallbackEmail,
          nombre: p.nombre,
          rol: p.rol,
          avatar_url: p.avatar_url,
        });
        profileMatchedEmails.add(fallbackEmail);
      }
    }

    if (googleAttendees?.attendees) {
      for (const g of googleAttendees.attendees) {
        if (!g.email) continue;
        const clean = g.email.toLowerCase().trim();
        if (!clean.includes('@') || clean.endsWith('calendar.google.com')) continue;
        const googleName = g.displayName?.trim() || '';
        const hasRealGoogleName = Boolean(googleName && !googleName.includes('@'));
        const existing = map.get(clean);
        if (existing) {
          if (hasRealGoogleName && (!profileMatchedEmails.has(clean) || isGenericCollaboratorName(existing.nombre, clean))) {
            existing.nombre = googleName;
          }
          if (g.avatarUrl && !existing.avatar_url) {
            existing.avatar_url = g.avatarUrl;
          }
        } else {
          map.set(clean, {
            id: clean,
            email: clean,
            nombre: hasRealGoogleName ? googleName : deriveNameFromEmail(clean),
            rol: 'invitado',
            avatar_url: g.avatarUrl || null,
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
  } catch {
    return INITIAL_COLLABORATORS;
  }
}

async function googleRequest<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('google-calendar-events', { body });
  if (error) {
    let message = '';
    try { if (error.context instanceof Response) { const result = await error.context.clone().json(); if (typeof result.error === 'string') message = result.error; } } catch { /* localized fallback in the form */ }
    throw new Error(message);
  }
  if (data?.error) throw new Error(String(data.error));
  return data as T;
}
export async function getGoogleCalendars(): Promise<AgendaGoogleCalendar[]> {
  return (await googleRequest<{ calendars: AgendaGoogleCalendar[] }>({ action: 'calendars' })).calendars;
}
export async function getCompanyBirthdays(): Promise<CompanyBirthdayProfile[]> {
  const { data, error } = await supabase.from('profiles')
    .select('id, nombre, fecha_nacimiento')
    .eq('activo', true)
    .not('fecha_nacimiento', 'is', null)
    .order('nombre');
  if (error) throw error;
  return (data || []) as CompanyBirthdayProfile[];
}
export async function getCompanyEvents(from: string, to: string): Promise<CompanyEvent[]> {
  const [local, remote] = await Promise.all([getLocalEvents(from, to), googleRequest<{ events: CompanyEvent[] }>({ action: 'list', from, to })]);
  return [...local, ...remote.events].sort((a, b) => `${a.occurrence_date || a.fecha}/${a.hora || ''}/${a.id}`.localeCompare(`${b.occurrence_date || b.fecha}/${b.hora || ''}/${b.id}`));
}
export async function getLocalEvents(from: string, to: string): Promise<CompanyEvent[]> {
  const events: CompanyEvent[] = [];
  // A series can begin before this month. Page results so older series don't hide later ones.
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase.from('agenda_eventos').select('*')
      .lte('fecha', to).or(`fecha.gte.${from},repeticion.neq.ninguna`)
      .or(`repetir_hasta.is.null,repetir_hasta.gte.${from}`)
      .order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    events.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return expandCompanyEvents(events, from, to);
}

export async function saveCompanyEvent(id: string | undefined, input: EventInput): Promise<CompanyEvent> {
  input = { ...input, tipo: 'evento' };
  if (!validRecurrence(input)) throw new Error('Invalid recurrence');
  if (id?.startsWith('gcal:') || !id && input.calendar_id) return (await googleRequest<{ event: CompanyEvent }>({ action: 'save', id, calendarId: input.calendar_id, etag: input.google_etag, requestId: input.request_id, input })).event;
  const { calendar_id, google_etag: _etag, request_id: _request, fecha_fin: _endDate, attendees: _attendees, ...local } = input;
  if (calendar_id) throw new Error('No se puede mover un evento local desde este formulario.');
  const payload = { ...local, hora_fin: local.hora ? local.hora_fin || null : null };
  const query = id ? supabase.from('agenda_eventos').update(payload).eq('id', id) : supabase.from('agenda_eventos').insert(payload);
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteCompanyEvent(id: string, etag?: string): Promise<void> {
  if (id.startsWith('gcal:')) { await googleRequest({ action: 'delete', id, etag }); return; }
  const { data, error } = await supabase.from('agenda_eventos').delete().eq('id', id).select('id').single();
  if (error) throw error;
  if (!data) throw new Error('Event not found');
}
