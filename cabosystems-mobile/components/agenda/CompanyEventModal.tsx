import React, { useEffect, useMemo, useRef, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type ScrollViewInstance } from 'react-native';
import { CalendarDays, Clock3, MapPin, Repeat2, UserPlus, Users, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AgendaPalette as P } from '@/constants/Theme';
import { dateKey, parseDateKey } from '@/lib/agenda';
import { eventSchedule } from '@/lib/companyAgendaPresentation';
import { isoWeekday } from '@/lib/companyAgendaRecurrence';
import { validCompanyEvent } from '@/lib/companyAgenda';
import type { CompanyAgendaCopy } from '@/lib/companyAgendaCopy';
import type { AgendaGoogleCalendar, CompanyEvent, EventAttendee, EventInput, RecurrenceFrequency } from '@/types/companyAgenda';
import { getAgendaCollaborators, getGoogleCalendars, INITIAL_COLLABORATORS, type AgendaCollaborator } from '@/lib/companyAgendaApi';
import { AgendaDatePicker } from './AgendaDatePicker';
import { AgendaTimePicker } from './AgendaTimePicker';
import { CompanyChoice } from './CompanyChoice';
import { TaskFilterSelect } from '@/components/TaskFilterSelect';

export function CompanyEventModal({ event, day, canManage: allowed, canManageCompany: allowedCompany, availableCalendars, copy: c, locale, onClose, onSave, onDelete }: {
  event: CompanyEvent | null; day: string; canManage?: boolean; canManageCompany?: boolean; availableCalendars?: AgendaGoogleCalendar[]; copy: CompanyAgendaCopy; locale: string;
  onClose: () => void; onSave: (id: string | undefined, input: EventInput) => Promise<void>; onDelete: (id: string, etag?: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const scrollOffset = useRef(0);
  const [dateRoom, setDateRoom] = useState(0);
  const makeDateRoom = (scrollBy: number) => new Promise<void>(resolve => {
    const target = scrollOffset.current + scrollBy;
    setDateRoom(scrollBy + 80);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scroll.current?.scrollTo({ y: target, animated: false });
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
  });
  const canManageCompany = allowedCompany !== undefined ? allowedCompany : Boolean(allowed);
  const isGoogle = Boolean(event?.google);
  const canManage = event ? (isGoogle ? event.google?.editable !== false : canManageCompany) : true;
  const [calendars, setCalendars] = useState<AgendaGoogleCalendar[]>(() => (availableCalendars || []).filter(item => item.editable !== false));
  const [calendarError, setCalendarError] = useState(false);
  const [allDay, setAllDay] = useState(event ? !event.hora : false);
  const [collaborators, setCollaborators] = useState<AgendaCollaborator[]>(INITIAL_COLLABORATORS);
  const [guestQuery, setGuestQuery] = useState('');
  const [guestDropdownOpen, setGuestDropdownOpen] = useState(false);
  const initialCalendarId = event?.google?.calendarId || (!canManageCompany ? ((availableCalendars || []).find(item => item.editable !== false)?.id || '') : '');
  useEffect(() => {
    let active = true;
    void getAgendaCollaborators().then(list => { if (active) setCollaborators(list); }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (event) return;
    let active = true;
    void getGoogleCalendars().then(items => {
      if (active) {
        const writable = items.filter(calendar => calendar.editable !== false);
        setCalendars(writable);
        if (!canManageCompany && writable.length > 0) {
          setInput(curr => curr.calendar_id ? curr : { ...curr, calendar_id: writable[0].id });
        }
      }
    }).catch(() => { if (active) setCalendarError(true); });
    return () => { active = false; };
  }, [event, canManageCompany]);
  const [input, setInput] = useState<EventInput>(() => ({
    titulo: event?.google?.availabilityOnly ? (locale.startsWith('en') ? 'Busy' : 'Ocupado') : event?.titulo || '',
    descripcion: event?.descripcion || '',
    tipo: 'evento',
    fecha: event?.fecha || day,
    hora: event ? event.hora?.slice(0, 5) || '' : '09:00',
    ubicacion: event?.ubicacion || '',
    repeticion: event?.repeticion || 'ninguna',
    intervalo: event?.intervalo || 1,
    dias_semana: event?.dias_semana || [],
    repetir_hasta: event?.repetir_hasta || null,
    calendar_id: initialCalendarId,
    google_etag: event?.google?.etag,
    request_id: randomUUID().replace(/-/g, ''),
    fecha_fin: event?.google?.endDate || '',
    hora_fin: event ? (event.google?.endTime || event.hora_fin)?.slice(0, 5) || '' : '10:00',
    attendees: event?.attendees || event?.google?.attendees || [],
  }));
  const [mode, setMode] = useState<string>(() => event && (event.intervalo > 1 || event.repeticion === 'diaria') ? 'custom' : event?.repeticion || 'ninguna');
  const [busy, setBusy] = useState(false); const [deleting, setDeleting] = useState(false); const [error, setError] = useState('');
  const disabled = !canManage || busy;
  const change = (patch: Partial<EventInput>) => { setInput(previous => ({ ...previous, ...patch })); setError(''); };
  const addGuest = (attendee: EventAttendee) => {
    const email = attendee.email.trim().toLowerCase();
    if (!email || (input.attendees || []).some(a => a.email.toLowerCase() === email)) return;
    change({ attendees: [...(input.attendees || []), { ...attendee, email }] });
    setGuestQuery('');
    setGuestDropdownOpen(false);
  };
  const removeGuest = (email: string) => {
    change({ attendees: (input.attendees || []).filter(a => a.email.toLowerCase() !== email.toLowerCase()) });
  };
  const matchingGuests = useMemo(() => {
    const q = guestQuery.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (!q) return [];
    return collaborators.filter(collab => {
      const already = (input.attendees || []).some(a => a.email.toLowerCase() === collab.email.toLowerCase());
      if (already) return false;
      const name = (collab.nombre || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const email = collab.email.toLowerCase();
      return name.includes(q) || email.includes(q);
    }).slice(0, 5);
  }, [collaborators, guestQuery, input.attendees]);
  const customEmailMatch = useMemo(() => {
    const q = guestQuery.trim().toLowerCase();
    if (!q || !q.includes('@') || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q)) return null;
    const already = (input.attendees || []).some(a => a.email.toLowerCase() === q);
    if (already) return null;
    return q;
  }, [guestQuery, input.attendees]);
  const changeRepeat = (value: string) => {
    setMode(value);
    const frequency = (value === 'custom' ? 'semanal' : value) as RecurrenceFrequency;
    change({ repeticion: frequency, intervalo: 1, dias_semana: frequency === 'semanal' ? [isoWeekday(input.fecha)] : [], repetir_hasta: frequency === 'ninguna' ? null : input.repetir_hasta });
  };
  const submit = async () => {
    if (disabled || deleting) return;
    if (!input.calendar_id && !canManageCompany) { setError(locale.startsWith('en') ? 'Only administrators can create company calendar events.' : 'Solo administradores pueden crear eventos en el calendario general de la empresa.'); return; }
    if (!validCompanyEvent(input)) { setError(c.invalid); return; }
    if (!allDay && (!input.hora || !input.hora_fin || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.hora_fin) || !input.calendar_id && input.hora_fin <= input.hora)) { setError(c.invalid); return; }
    setBusy(true); setError('');
    try { await onSave(event?.id, { ...input, titulo: input.titulo.trim(), descripcion: input.descripcion?.trim() || null, ubicacion: input.ubicacion?.trim() || null, hora: input.hora || null, hora_fin: input.hora ? input.hora_fin || null : null }); onClose(); }
    catch (reason) { setError(input.calendar_id && reason instanceof Error && reason.message ? reason.message : c.saveFailed); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!event || disabled) return;
    if (!event.google && !canManageCompany) { setError(locale.startsWith('en') ? 'Only administrators can delete company calendar events.' : 'Solo administradores pueden eliminar eventos del calendario general de la empresa.'); return; }
    setBusy(true); setError('');
    try { await onDelete(event.id, event.google?.etag); onClose(); } catch (reason) { setError(event.google && reason instanceof Error && reason.message ? reason.message : c.deleteFailed); } finally { setBusy(false); }
  };
  const dateField = (label: string, value: string, setValue: (value: string) => void) => <View style={s.field}><Text style={s.label}>{label}</Text>{disabled ? <Text style={s.readonly}>{value.split('-').reverse().join('/')}</Text> : <AgendaDatePicker date={value} today={dateKey(new Date())} locale={locale} field onBeforeOpen={makeDateRoom} onAfterClose={() => setDateRoom(0)} onSelect={setValue} />}</View>;
  const textField = (label: string, value: string, setValue: (value: string) => void, maxLength: number, multiline = false) => <View style={[s.field, maxLength === 5 && s.timeField]}>{![160, 240, 5000].includes(maxLength) ? <Text style={s.label}>{label}</Text> : null}{!canManage ? <Text selectable style={s.readonly}>{value || '—'}</Text> : <TextInput accessibilityLabel={label} editable={!busy} value={value} onChangeText={setValue} maxLength={maxLength} multiline={multiline} placeholder={maxLength === 5 ? '09:00' : [160, 240, 5000].includes(maxLength) ? label : undefined} placeholderTextColor={P.muted} selectionColor={P.accent} keyboardType={maxLength === 5 ? 'numbers-and-punctuation' : 'default'} autoCorrect={maxLength !== 5} textAlignVertical={multiline ? 'top' : 'center'} style={[s.input, maxLength === 160 && s.titleInput, maxLength === 5 && s.timeInput, multiline && s.description]} />}</View>;

  const formatDate = (value: string) => parseDateKey(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const detailDate = event?.occurrence_date || input.fecha;
  const repeatLabel = input.repeticion === 'ninguna' ? c.repeats : `${c.every} ${input.intervalo} ${input.repeticion === 'diaria' ? c.days : input.repeticion === 'semanal' ? c.weeks : c.months}`;
  const repeatHint = [input.repeticion === 'semanal' ? input.dias_semana.map(value => new Date(2024, 0, value, 12).toLocaleDateString(locale, { weekday: 'short' })).join(', ') : '', input.repetir_hasta ? `${c.until}: ${formatDate(input.repetir_hasta)}` : ''].filter(Boolean).join(' · ');
  const detailRow = (Icon: typeof CalendarDays, label: string, value: string, hint?: string) => <View style={s.detailRow}><Icon size={20} color={P.accent} /><View style={s.detailBody}><Text style={s.label}>{label}</Text><Text selectable style={s.detailValue}>{value}</Text>{hint ? <Text style={s.help}>{hint}</Text> : null}</View></View>;
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!busy) onClose(); }}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.sheet} accessibilityViewIsModal>
        <View style={s.header}><Text accessibilityRole="header" style={s.title}>{!canManage ? c.details : event ? c.edit : c.newEvent}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.close} disabled={busy} style={s.icon} onPress={onClose}><X size={22} color={P.slate} /></Pressable></View>
        <ScrollView ref={scroll} onScroll={event => { scrollOffset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false} contentContainerStyle={[s.content, dateRoom > 0 && { paddingBottom: 32 + dateRoom }]}>
          {!canManage && event ? <>
            <View style={s.eventSummary}><Text style={s.calendarName}>{event.google?.calendarName || c.localCalendar}</Text><Text selectable accessibilityRole="header" style={s.eventTitle}>{input.titulo}</Text></View>
            <View style={s.details}>
              {detailRow(CalendarDays, c.date, formatDate(detailDate), input.fecha_fin && input.fecha_fin !== detailDate ? `${c.endDate}: ${formatDate(input.fecha_fin)}` : undefined)}
              {detailRow(Clock3, locale.startsWith('en') ? 'Time' : 'Horario', eventSchedule(event, locale), event.google ? c.googleTime : undefined)}
              {input.ubicacion ? detailRow(MapPin, locale.startsWith('en') ? 'Location' : 'Ubicación', input.ubicacion) : null}
              {event.google?.recurring || event.repeticion !== 'ninguna' ? detailRow(Repeat2, c.repeat, repeatLabel, repeatHint || undefined) : null}
            </View>
            {input.attendees && input.attendees.length > 0 ? (
              <View style={s.attendeesReadBlock}>
                <Text style={s.label}>{c.attendees} ({input.attendees.length})</Text>
                <View style={s.chipsWrap}>
                  {input.attendees.map(a => (
                    <View key={a.email} style={s.chip}>
                      {a.avatar_url ? (
                        <Image source={{ uri: a.avatar_url }} style={s.chipAvatar} />
                      ) : (
                        <View style={s.chipAvatarFallback}>
                          <Text style={s.chipAvatarText}>{(a.displayName || a.email).slice(0, 2).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={s.chipText}>{a.displayName || a.email}</Text>
                      {a.responseStatus && a.responseStatus !== 'needsAction' ? (
                        <Text style={s.chipStatus}>
                          {a.responseStatus === 'accepted' ? '✓' : a.responseStatus === 'declined' ? '✕' : '?'}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            ) : null}
            {input.descripcion ? <View style={s.descriptionBlock}><Text style={s.label}>{c.description}</Text><Text selectable style={s.descriptionText}>{input.descripcion}</Text></View> : null}
          </> : <>
          {textField(c.titleLabel, input.titulo, titulo => change({ titulo }), 160)}
          {textField(c.location, input.ubicacion || '', ubicacion => change({ ubicacion }), 240)}
          {textField(c.description, input.descripcion || '', descripcion => change({ descripcion }), 5000, true)}
          <View style={s.field}>
            <Text style={s.label}>{c.attendees}</Text>
            <View style={s.guestInputContainer}>
              <Users size={16} color={P.slate} style={s.guestInputIcon} />
              <TextInput
                accessibilityLabel={c.attendees}
                editable={!busy}
                value={guestQuery}
                onChangeText={text => { setGuestQuery(text); setGuestDropdownOpen(true); }}
                onFocus={() => { if (guestQuery.trim()) setGuestDropdownOpen(true); }}
                placeholder={c.addGuest}
                placeholderTextColor={P.muted}
                selectionColor={P.accent}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => {
                  if (matchingGuests.length > 0) {
                    addGuest({ email: matchingGuests[0].email, displayName: matchingGuests[0].nombre, avatar_url: matchingGuests[0].avatar_url || undefined });
                  } else if (customEmailMatch) {
                    addGuest({ email: customEmailMatch });
                  }
                }}
                style={[s.input, s.guestInput]}
              />
            </View>
            {guestDropdownOpen && (matchingGuests.length > 0 || customEmailMatch) ? (
              <View style={s.guestDropdown}>
                {matchingGuests.map(collab => (
                  <Pressable
                    key={collab.id}
                    style={({ pressed }) => [s.dropdownOption, pressed && s.dropdownOptionPressed]}
                    onPress={() => addGuest({ email: collab.email, displayName: collab.nombre, avatar_url: collab.avatar_url || undefined })}
                  >
                    {collab.avatar_url ? (
                      <Image source={{ uri: collab.avatar_url }} style={s.avatar} />
                    ) : (
                      <View style={s.avatarFallback}>
                        <Text style={s.avatarInitial}>{(collab.nombre || collab.email).slice(0, 2).toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={s.optionInfo}>
                      <Text style={s.optionName}>{collab.nombre}</Text>
                      <Text style={s.optionEmail}>{collab.email}</Text>
                    </View>
                  </Pressable>
                ))}
                {customEmailMatch && !matchingGuests.some(m => m.email.toLowerCase() === customEmailMatch) ? (
                  <Pressable
                    style={({ pressed }) => [s.dropdownOption, pressed && s.dropdownOptionPressed]}
                    onPress={() => addGuest({ email: customEmailMatch })}
                  >
                    <View style={s.avatarFallback}>
                      <UserPlus size={16} color={P.accent} />
                    </View>
                    <View style={s.optionInfo}>
                      <Text style={s.optionName}>{customEmailMatch}</Text>
                      <Text style={s.optionEmail}>{c.addGuest}</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {input.attendees && input.attendees.length > 0 ? (
              <View style={s.chipsWrap}>
                {input.attendees.map(a => (
                  <View key={a.email} style={s.chip}>
                    {a.avatar_url ? (
                      <Image source={{ uri: a.avatar_url }} style={s.chipAvatar} />
                    ) : (
                      <View style={s.chipAvatarFallback}>
                        <Text style={s.chipAvatarText}>{(a.displayName || a.email).slice(0, 2).toUpperCase()}</Text>
                      </View>
                    )}
                    <Text style={s.chipText} numberOfLines={1}>{a.displayName || a.email}</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${a.displayName || a.email}`}
                      disabled={busy}
                      onPress={() => removeGuest(a.email)}
                      style={s.chipRemove}
                    >
                      <X size={13} color={P.slate} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          {event ? <Text style={s.help}>{c.calendar}: {event.google?.calendarName || c.localCalendar}</Text> : <View style={s.field}>{disabled ? <Text style={s.readonly}>{calendars.find(calendar => calendar.id === input.calendar_id)?.name || (canManageCompany ? c.localCalendar : '')}</Text> : <TaskFilterSelect anchored label={c.calendar} value={input.calendar_id || ''} options={[...(canManageCompany ? [{ value: '', label: c.localCalendar }] : []), ...calendars.map(calendar => ({ value: calendar.id, label: calendar.name }))]} onChange={calendar_id => change({ calendar_id })} />}</View>}
          {calendarError ? <Text style={s.help}>{c.calendarFailed}</Text> : null}
          <View style={s.scheduleSection}>
          <View style={s.checkboxRow}><Text style={s.buttonText}>{c.allDay}</Text><Switch accessibilityLabel={c.allDay} disabled={disabled} value={allDay} trackColor={{ false: P.line, true: P.accent }} thumbColor={P.white} onValueChange={value => { setAllDay(value); change(value ? { hora: '', hora_fin: '' } : { hora: '09:00', hora_fin: '10:00' }); }} /></View>
          <View style={s.dateTimeRow}>
            <View style={s.dateColumn}>{dateField(c.date, input.fecha, fecha => change({ fecha }))}</View>
            {!allDay ? <View style={s.timeColumn}>
              <AgendaTimePicker label={c.startTime} value={input.hora || ''} disabled={disabled} locale={locale} onChange={hora => change({ hora })} />
              <AgendaTimePicker label={c.endTime} value={input.hora_fin || ''} disabled={disabled} locale={locale} onChange={hora_fin => change({ hora_fin })} />
            </View> : null}
          </View>
          {input.calendar_id ? <>{dateField(c.endDate, input.fecha_fin || input.fecha, fecha_fin => change({ fecha_fin }))}<Text style={s.help}>{c.googleTime}</Text></> : null}
          </View>
          {event?.google?.recurring ? <Text style={s.help}>{c.googleOccurrence}</Text> : null}
          {!event?.google ? <View style={s.recurrence}>
            <CompanyChoice compact label={c.repeat} value={mode} disabled={disabled} options={[{ value: 'ninguna', label: c.none }, { value: 'semanal', label: c.weekly }, { value: 'mensual', label: c.monthly }, { value: 'custom', label: c.custom }]} onChange={changeRepeat} />
            {mode === 'custom' ? <>
              <View style={s.field}><Text style={s.label}>{c.every}</Text>{!canManage ? <Text style={s.readonly}>{input.intervalo}</Text> : <TextInput accessibilityLabel={c.interval} keyboardType="number-pad" editable={!busy} value={input.intervalo ? String(input.intervalo) : ''} onChangeText={value => change({ intervalo: Number(value) })} maxLength={3} style={s.input} />}</View>
              <CompanyChoice label={c.unit} value={input.repeticion} disabled={disabled} options={[{ value: 'diaria', label: c.days }, { value: 'semanal', label: c.weeks }, { value: 'mensual', label: c.months }]} onChange={value => change({ repeticion: value as RecurrenceFrequency, dias_semana: value === 'semanal' ? [isoWeekday(input.fecha)] : [] })} />
            </> : null}
            {input.repeticion === 'semanal' ? <View style={s.field}><Text style={s.label}>{c.weekdays}</Text><View style={s.weekdays} accessibilityLabel={c.weekdays}>{Array.from({ length: 7 }, (_, index) => {
              const value = index + 1; const date = new Date(2024, 0, value, 12); const selected = input.dias_semana.includes(value);
              return <Pressable key={value} accessibilityRole="checkbox" accessibilityLabel={date.toLocaleDateString(locale, { weekday: 'long' })} accessibilityState={{ checked: selected, disabled }} disabled={disabled} style={[s.weekday, selected && s.selectedDay]} onPress={() => change({ dias_semana: selected ? input.dias_semana.filter(day => day !== value) : [...input.dias_semana, value].sort((a, b) => a - b) })}><Text style={[s.dayText, selected && s.selectedDayText]}>{date.toLocaleDateString(locale, { weekday: 'short' })}</Text></Pressable>;
            })}</View></View> : null}
            {input.repeticion === 'mensual' ? <Text style={s.help}>{c.monthHelp}</Text> : null}
            {input.repeticion !== 'ninguna' ? <><CompanyChoice label={c.ends} value={input.repetir_hasta ? 'date' : 'never'} disabled={disabled} options={[{ value: 'never', label: c.never }, { value: 'date', label: c.onDate }]} onChange={value => change({ repetir_hasta: value === 'date' ? input.fecha : null })} />{input.repetir_hasta ? dateField(c.until, input.repetir_hasta, repetir_hasta => change({ repetir_hasta })) : null}</> : null}
          </View> : null}
          {event && event.repeticion !== 'ninguna' ? <Text style={s.help}>{canManage ? c.series : c.seriesRead}</Text> : null}
          </>}
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
          {deleting ? <View style={s.confirmation}><Text style={s.readonly}>{event?.repeticion !== 'ninguna' ? c.deleteSeries : c.deleteOne}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => setDeleting(false)} style={s.button}><Text style={s.buttonText}>{c.cancel}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void remove()} style={[s.button, s.deleteButton]}><Text style={s.primaryText}>{busy ? c.deleting : c.confirm}</Text></Pressable></View> : null}
        </ScrollView>
        <View style={s.footer}>{canManage && event && !deleting ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setDeleting(true)} style={s.button}><Text style={s.buttonText}>{c.remove}</Text></Pressable> : null}{canManage ? <View style={s.spacer} /> : null}<Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={[s.button, !canManage && s.closePrimary]}><Text style={!canManage ? s.primaryText : s.buttonText}>{canManage && !event ? c.cancel : c.close}</Text></Pressable>{canManage && !deleting ? <Pressable accessibilityRole="button" accessibilityLabel={c.save} disabled={busy} onPress={() => void submit()} style={[s.button, s.primary, busy && s.disabled]}>{busy ? <ActivityIndicator color={P.white} /> : <Text style={s.primaryText}>{c.save}</Text>}</Pressable> : null}</View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  dateTimeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dateColumn: { width: '44%', flexGrow: 0, flexShrink: 0, minWidth: 0 },
  timeColumn: { flex: 1, minWidth: 0, flexDirection: 'row', gap: 8 },
  timeField: { flex: 1, minWidth: 0 },
  timeLabel: { fontSize: 12 },
  timeInput: { minHeight: 44, paddingHorizontal: 8, paddingVertical: 8, fontSize: 13 },
  titleInput: { minHeight: 58, fontFamily: 'Outfit_500Medium', fontSize: 20, lineHeight: 27 },
  scheduleSection: { gap: 16 },
  disabled: { opacity: 0.55 },
  eventSummary: { gap: 8, paddingVertical: 4 },
  calendarName: { color: P.slate, fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 19 },
  eventTitle: { color: P.ink, fontFamily: 'Outfit_600SemiBold', fontSize: 26, lineHeight: 33 },
  details: { backgroundColor: P.wash, borderRadius: 10, paddingHorizontal: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 15 },
  detailBody: { flex: 1, minWidth: 0, gap: 4 },
  detailValue: { color: P.ink, fontFamily: 'Outfit_500Medium', fontSize: 15, lineHeight: 22 },
  descriptionBlock: { gap: 8, paddingTop: 4 },
  descriptionText: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 24 },
  attendeesReadBlock: { gap: 8, marginTop: 4 },
  guestInputContainer: { position: 'relative', justifyContent: 'center' },
  guestInputIcon: { position: 'absolute', left: 12, zIndex: 1 },
  guestInput: { paddingLeft: 38 },
  guestDropdown: { backgroundColor: P.white, borderWidth: 1, borderColor: P.line, borderRadius: 8, marginTop: -4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4, zIndex: 10 },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: P.line },
  dropdownOptionPressed: { backgroundColor: P.wash },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: P.wash, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 12, fontFamily: 'Outfit_600SemiBold', color: P.accent },
  optionInfo: { flex: 1, minWidth: 0 },
  optionName: { fontSize: 14, fontFamily: 'Outfit_500Medium', color: P.ink },
  optionEmail: { fontSize: 12, fontFamily: 'Outfit_400Regular', color: P.slate },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: P.wash, paddingVertical: 4, paddingLeft: 6, paddingRight: 8, borderRadius: 16, borderWidth: 1, borderColor: P.line, maxWidth: '100%' },
  chipAvatar: { width: 22, height: 22, borderRadius: 11 },
  chipAvatarFallback: { width: 22, height: 22, borderRadius: 11, backgroundColor: P.white, alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { fontSize: 10, fontFamily: 'Outfit_600SemiBold', color: P.slate },
  chipText: { fontSize: 13, fontFamily: 'Outfit_400Regular', color: P.ink, flexShrink: 1 },
  chipRemove: { padding: 2, alignItems: 'center', justifyContent: 'center' },
  chipStatus: { fontSize: 11, fontFamily: 'Outfit_600SemiBold', color: P.accent, marginLeft: 2 },
  closePrimary: { flex: 1, backgroundColor: P.accent, borderColor: P.accent, minHeight: 48 },
  checkboxRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  page: { flex: 1, backgroundColor: P.white, alignItems: 'center' }, sheet: { width: '100%', maxWidth: 600, flex: 1, backgroundColor: P.white }, header: { minHeight: 64, paddingLeft: 24, paddingRight: 12, gap: 10, flexDirection: 'row', alignItems: 'center' }, title: { flex: 1, fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 20 }, icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, content: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 32, gap: 24 }, field: { gap: 8 }, label: { fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 13 }, input: { backgroundColor: P.white, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: P.line, fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 15 }, description: { minHeight: 80 }, readonly: { fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 15, lineHeight: 23 }, recurrence: { paddingVertical: 4, gap: 16 }, weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, weekday: { minWidth: 44, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, selectedDay: { borderColor: P.accent, backgroundColor: P.wash }, dayText: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 13, textTransform: 'capitalize' }, selectedDayText: { color: P.ink, fontFamily: 'Outfit_600SemiBold' }, help: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 20 }, error: { padding: 12, borderWidth: 1, borderColor: P.accent, borderRadius: 8, fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 14 }, confirmation: { gap: 12, paddingVertical: 12 }, footer: { backgroundColor: P.white, flexDirection: 'row', gap: 8, alignItems: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12 }, spacer: { flex: 0 }, button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: P.line }, buttonText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: P.ink }, primary: { flex: 1, minHeight: 50, backgroundColor: P.accent, borderColor: P.accent }, primaryText: { fontFamily: 'Outfit_600SemiBold', color: P.white, fontSize: 14 }, deleteButton: { backgroundColor: P.ink },
});
