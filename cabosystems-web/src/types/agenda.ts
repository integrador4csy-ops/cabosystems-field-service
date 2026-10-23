export type AgendaKind = 'evento' | 'recordatorio';
export type RecurrenceFrequency = 'ninguna' | 'diaria' | 'semanal' | 'mensual';

export interface EventRecurrence {
  repeticion: RecurrenceFrequency;
  intervalo: number;
  dias_semana: number[]; // ISO weekdays: Monday = 1, Sunday = 7.
  repetir_hasta: string | null;
}

export interface CompanyEvent extends EventRecurrence {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: AgendaKind;
  fecha: string;
  hora: string | null;
  hora_fin?: string | null;
  ubicacion: string | null;
  created_at: string;
  occurrence_date?: string;
  google?: { calendarId: string; calendarName: string; calendarColor?: string; etag: string; recurring: boolean; editable: boolean; availabilityOnly?: boolean; endDate: string; endTime: string | null; lastDay: string; timeZone: string };
}

export type EventInput = Omit<CompanyEvent, 'id' | 'created_at' | 'occurrence_date' | 'google'> & {
  calendar_id?: string; google_etag?: string; request_id?: string; fecha_fin?: string; hora_fin?: string | null;
};
export interface AgendaGoogleCalendar { id: string; name: string; timeZone: string; backgroundColor?: string; editable?: boolean }
