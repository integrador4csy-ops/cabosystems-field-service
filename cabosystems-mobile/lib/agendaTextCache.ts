import type { CompanyEvent, AgendaGoogleCalendar } from '../types/companyAgenda';

/** Persist calendar fields explicitly so attachment/media payloads never reach disk. */
export function agendaTextEvent(event: CompanyEvent): CompanyEvent {
  const { id, titulo, descripcion, tipo, fecha, hora, hora_fin, ubicacion, created_at,
    occurrence_date, repeticion, intervalo, dias_semana, repetir_hasta } = event;
  const google = event.google;
  return { id, titulo, descripcion, tipo, fecha, hora, hora_fin, ubicacion, created_at,
    occurrence_date, repeticion, intervalo, dias_semana, repetir_hasta,
    ...(google ? { google: {
      calendarId: google.calendarId, calendarName: google.calendarName, calendarColor: google.calendarColor,
      etag: google.etag, recurring: google.recurring, editable: google.editable,
      availabilityOnly: google.availabilityOnly, endDate: google.endDate,
      endTime: google.endTime, lastDay: google.lastDay, timeZone: google.timeZone,
    } } : {}),
  };
}

export function agendaTextCalendar(calendar: AgendaGoogleCalendar): AgendaGoogleCalendar {
  const { id, name, timeZone, backgroundColor, editable } = calendar;
  return { id, name, timeZone, backgroundColor, editable };
}
