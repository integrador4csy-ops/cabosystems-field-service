import { supabase } from './supabase';

export type CalendarColors = Record<string, string>;
export const CALENDAR_COLOR_PALETTE = [
  '#c2185b', '#f4511e', '#f6bf26', '#0b8043', '#3f51b5', '#8e24aa',
  '#e91e63', '#ef6c00', '#c0ca33', '#009688', '#7986cb', '#795548',
  '#d50000', '#fb8c00', '#7cb342', '#039be5', '#b39ddb', '#616161',
  '#e67c73', '#fbbd23', '#33b679', '#4285f4', '#9e69af', '#a79b8e',
];
export const validCalendarColor = (color: string) => /^#[a-f0-9]{6}$/i.test(color);

export async function getCalendarColors(owner: string): Promise<CalendarColors> {
  if (!owner) return {};
  const colors: CalendarColors = {};
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('agenda_calendar_colors').select('calendar_id,color').eq('user_id', owner).order('calendar_id').range(offset, offset + 499);
    if (error) throw error;
    for (const row of data || []) if (validCalendarColor(row.color)) Object.defineProperty(colors, row.calendar_id, { value: row.color, enumerable: true, configurable: true, writable: true });
    if (!data || data.length < 500) return colors;
  }
}
export async function saveCalendarColor(owner: string, calendarId: string, color: string | null): Promise<void> {
  if (!owner || !calendarId || calendarId.length > 1024 || color !== null && !validCalendarColor(color)) throw new Error('El calendario o el color no son válidos.');
  if (color === null) {
    const { error } = await supabase.from('agenda_calendar_colors').delete().eq('user_id', owner).eq('calendar_id', calendarId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('agenda_calendar_colors').upsert({ user_id: owner, calendar_id: calendarId, color: color.toLowerCase() }, { onConflict: 'user_id,calendar_id' }).select('calendar_id').single();
    if (error) throw error;
  }
}

