import React, { useEffect, useState } from 'react';
import { randomUUID } from 'expo-crypto';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarDays, Clock3, MapPin, Repeat2, Check, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AgendaPalette as P } from '@/constants/Theme';
import { dateKey, parseDateKey } from '@/lib/agenda';
import { eventSchedule } from '@/lib/companyAgendaPresentation';
import { isoWeekday } from '@/lib/companyAgendaRecurrence';
import { validCompanyEvent } from '@/lib/companyAgenda';
import type { CompanyAgendaCopy } from '@/lib/companyAgendaCopy';
import type { AgendaGoogleCalendar, CompanyEvent, EventInput, RecurrenceFrequency } from '@/types/companyAgenda';
import { getGoogleCalendars } from '@/lib/companyAgendaApi';
import { AgendaDatePicker } from './AgendaDatePicker';
import { CompanyChoice } from './CompanyChoice';

export function CompanyEventModal({ event, day, canManage: allowed, copy: c, locale, onClose, onSave, onDelete }: {
  event: CompanyEvent | null; day: string; canManage: boolean; copy: CompanyAgendaCopy; locale: string;
  onClose: () => void; onSave: (id: string | undefined, input: EventInput) => Promise<void>; onDelete: (id: string, etag?: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const canManage = allowed && event?.google?.editable !== false;
  const [calendars, setCalendars] = useState<AgendaGoogleCalendar[]>([]);
  const [calendarError, setCalendarError] = useState(false);
  const [allDay, setAllDay] = useState(event ? !event.hora : false);
  useEffect(() => {
    if (event || !canManage) return;
    let active = true;
    void getGoogleCalendars().then(items => { if (active) setCalendars(items.filter(calendar => calendar.editable !== false)); }).catch(() => { if (active) setCalendarError(true); });
    return () => { active = false; };
  }, [event, canManage]);
  const [input, setInput] = useState<EventInput>(() => ({ titulo: event?.google?.availabilityOnly ? (locale.startsWith('en') ? 'Busy' : 'Ocupado') : event?.titulo || '', descripcion: event?.descripcion || '', tipo: 'evento', fecha: event?.fecha || day, hora: event ? event.hora?.slice(0, 5) || '' : '09:00', ubicacion: event?.ubicacion || '', repeticion: event?.repeticion || 'ninguna', intervalo: event?.intervalo || 1, dias_semana: event?.dias_semana || [], repetir_hasta: event?.repetir_hasta || null, calendar_id: event?.google?.calendarId || '', google_etag: event?.google?.etag, request_id: randomUUID().replace(/-/g, ''), fecha_fin: event?.google?.endDate || '', hora_fin: event ? (event.google?.endTime || event.hora_fin)?.slice(0, 5) || '' : '10:00' }));
  const [mode, setMode] = useState<string>(() => event && (event.intervalo > 1 || event.repeticion === 'diaria') ? 'custom' : event?.repeticion || 'ninguna');
  const [busy, setBusy] = useState(false); const [deleting, setDeleting] = useState(false); const [error, setError] = useState('');
  const disabled = !canManage || busy;
  const change = (patch: Partial<EventInput>) => { setInput(previous => ({ ...previous, ...patch })); setError(''); };
  const changeRepeat = (value: string) => {
    setMode(value);
    const frequency = (value === 'custom' ? 'semanal' : value) as RecurrenceFrequency;
    change({ repeticion: frequency, intervalo: 1, dias_semana: frequency === 'semanal' ? [isoWeekday(input.fecha)] : [], repetir_hasta: frequency === 'ninguna' ? null : input.repetir_hasta });
  };
  const submit = async () => {
    if (disabled || deleting) return;
    if (!validCompanyEvent(input)) { setError(c.invalid); return; }
    if (!allDay && (!input.hora || !input.hora_fin || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.hora_fin) || !input.calendar_id && input.hora_fin <= input.hora)) { setError(c.invalid); return; }
    setBusy(true); setError('');
    try { await onSave(event?.id, { ...input, titulo: input.titulo.trim(), descripcion: input.descripcion?.trim() || null, ubicacion: input.ubicacion?.trim() || null, hora: input.hora || null, hora_fin: input.hora ? input.hora_fin || null : null }); onClose(); }
    catch (reason) { setError(input.calendar_id && reason instanceof Error && reason.message ? reason.message : c.saveFailed); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!event || disabled) return;
    setBusy(true); setError('');
    try { await onDelete(event.id, event.google?.etag); onClose(); } catch (reason) { setError(event.google && reason instanceof Error && reason.message ? reason.message : c.deleteFailed); } finally { setBusy(false); }
  };
  const dateField = (label: string, value: string, setValue: (value: string) => void) => <View style={s.field}><Text style={s.label}>{label}</Text>{disabled ? <Text style={s.readonly}>{value.split('-').reverse().join('/')}</Text> : <AgendaDatePicker date={value} today={dateKey(new Date())} locale={locale} onSelect={setValue} />}</View>;
  const textField = (label: string, value: string, setValue: (value: string) => void, maxLength: number, multiline = false) => <View style={s.field}><Text style={s.label}>{label}</Text>{!canManage ? <Text selectable style={s.readonly}>{value || '—'}</Text> : <TextInput accessibilityLabel={label} editable={!busy} value={value} onChangeText={setValue} maxLength={maxLength} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[s.input, multiline && s.description]} />}</View>;
  const formatDate = (value: string) => parseDateKey(value).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  const detailDate = event?.occurrence_date || input.fecha;
  const repeatLabel = input.repeticion === 'ninguna' ? c.repeats : `${c.every} ${input.intervalo} ${input.repeticion === 'diaria' ? c.days : input.repeticion === 'semanal' ? c.weeks : c.months}`;
  const repeatHint = [input.repeticion === 'semanal' ? input.dias_semana.map(value => new Date(2024, 0, value, 12).toLocaleDateString(locale, { weekday: 'short' })).join(', ') : '', input.repetir_hasta ? `${c.until}: ${formatDate(input.repetir_hasta)}` : ''].filter(Boolean).join(' · ');
  const detailRow = (Icon: typeof CalendarDays, label: string, value: string, hint?: string) => <View style={s.detailRow}><Icon size={20} color={P.accent} /><View style={s.detailBody}><Text style={s.label}>{label}</Text><Text selectable style={s.detailValue}>{value}</Text>{hint ? <Text style={s.help}>{hint}</Text> : null}</View></View>;
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!busy) onClose(); }}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.sheet} accessibilityViewIsModal>
        <View style={s.header}><CalendarDays size={23} color={P.accent} /><Text accessibilityRole="header" style={s.title}>{!canManage ? c.details : event ? c.edit : c.newEvent}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.close} disabled={busy} style={s.icon} onPress={onClose}><X size={22} color={P.slate} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          {!canManage && event ? <>
            <View style={s.eventSummary}><Text style={s.calendarName}>{event.google?.calendarName || c.localCalendar}</Text><Text selectable accessibilityRole="header" style={s.eventTitle}>{input.titulo}</Text></View>
            <View style={s.details}>
              {detailRow(CalendarDays, c.date, formatDate(detailDate), input.fecha_fin && input.fecha_fin !== detailDate ? `${c.endDate}: ${formatDate(input.fecha_fin)}` : undefined)}
              {detailRow(Clock3, locale.startsWith('en') ? 'Time' : 'Horario', eventSchedule(event, locale), event.google ? c.googleTime : undefined)}
              {input.ubicacion ? detailRow(MapPin, locale.startsWith('en') ? 'Location' : 'Ubicación', input.ubicacion) : null}
              {event.google?.recurring || event.repeticion !== 'ninguna' ? detailRow(Repeat2, c.repeat, repeatLabel, repeatHint || undefined) : null}
            </View>
            {input.descripcion ? <View style={s.descriptionBlock}><Text style={s.label}>{c.description}</Text><Text selectable style={s.descriptionText}>{input.descripcion}</Text></View> : null}
          </> : <>
          {event ? <Text style={s.help}>{c.calendar}: {event.google?.calendarName || c.localCalendar}</Text> : <CompanyChoice label={c.calendar} value={input.calendar_id || ''} disabled={disabled} options={[{ value: '', label: c.localCalendar }, ...calendars.map(calendar => ({ value: calendar.id, label: calendar.name }))]} onChange={calendar_id => change({ calendar_id })} />}
          {calendarError ? <Text style={s.help}>{c.calendarFailed}</Text> : null}
          {textField(c.titleLabel, input.titulo, titulo => change({ titulo }), 160)}
          {dateField(c.date, input.fecha, fecha => change({ fecha }))}
          <Pressable accessibilityRole="checkbox" accessibilityLabel={c.allDay} accessibilityState={{ checked: allDay, disabled }} disabled={disabled} style={s.checkboxRow} onPress={() => { setAllDay(!allDay); change(allDay ? { hora: '09:00', hora_fin: '10:00' } : { hora: '', hora_fin: '' }); }}><View style={[s.checkbox, allDay && s.checkboxChecked]}>{allDay ? <Check size={14} strokeWidth={3} color={P.white} /> : null}</View><Text style={s.buttonText}>{c.allDay}</Text></Pressable>
          {!allDay ? <>{textField(c.startTime, input.hora || '', hora => change({ hora }), 5)}{textField(c.endTime, input.hora_fin || '', hora_fin => change({ hora_fin }), 5)}</> : null}
          {input.calendar_id ? <>{dateField(c.endDate, input.fecha_fin || input.fecha, fecha_fin => change({ fecha_fin }))}<Text style={s.help}>{c.googleTime}</Text></> : null}
          {event?.google?.recurring ? <Text style={s.help}>{c.googleOccurrence}</Text> : null}
          {!event?.google ? <View style={s.recurrence}>
            <CompanyChoice label={c.repeat} value={mode} disabled={disabled} options={[{ value: 'ninguna', label: c.none }, { value: 'semanal', label: c.weekly }, { value: 'mensual', label: c.monthly }, { value: 'custom', label: c.custom }]} onChange={changeRepeat} />
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
          {textField(c.location, input.ubicacion || '', ubicacion => change({ ubicacion }), 240)}
          {textField(c.description, input.descripcion || '', descripcion => change({ descripcion }), 5000, true)}
          </>}
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
          {deleting ? <View style={s.confirmation}><Text style={s.readonly}>{event?.repeticion !== 'ninguna' ? c.deleteSeries : c.deleteOne}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => setDeleting(false)} style={s.button}><Text style={s.buttonText}>{c.cancel}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void remove()} style={[s.button, s.deleteButton]}><Text style={s.primaryText}>{busy ? c.deleting : c.confirm}</Text></Pressable></View> : null}
        </ScrollView>
        <View style={s.footer}>{canManage && event && !deleting ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setDeleting(true)} style={s.button}><Text style={s.buttonText}>{c.remove}</Text></Pressable> : null}{canManage ? <View style={s.spacer} /> : null}<Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={[s.button, !canManage && s.closePrimary]}><Text style={!canManage ? s.primaryText : s.buttonText}>{c.close}</Text></Pressable>{canManage && !deleting ? <Pressable accessibilityRole="button" accessibilityLabel={c.save} disabled={busy} onPress={() => void submit()} style={[s.button, s.primary]}>{busy ? <ActivityIndicator color={P.white} /> : <Text style={s.primaryText}>{c.save}</Text>}</Pressable> : null}</View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  eventSummary: { gap: 8, paddingVertical: 4 },
  calendarName: { color: P.slate, fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 19 },
  eventTitle: { color: P.ink, fontFamily: 'Outfit_600SemiBold', fontSize: 26, lineHeight: 33 },
  details: { backgroundColor: P.wash, borderRadius: 10, paddingHorizontal: 16 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 15 },
  detailBody: { flex: 1, minWidth: 0, gap: 4 },
  detailValue: { color: P.ink, fontFamily: 'Outfit_500Medium', fontSize: 15, lineHeight: 22 },
  descriptionBlock: { gap: 8, paddingTop: 4 },
  descriptionText: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 24 },
  closePrimary: { flex: 1, backgroundColor: P.accent, borderColor: P.accent, minHeight: 48 },
  checkboxRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: P.slate, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: P.accent, borderColor: P.accent },
  page: { flex: 1, backgroundColor: P.white, alignItems: 'center' }, sheet: { width: '100%', maxWidth: 600, flex: 1, backgroundColor: P.white }, header: { minHeight: 68, paddingLeft: 20, paddingRight: 12, gap: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 2, borderColor: P.accent }, title: { flex: 1, fontFamily: 'Outfit_600SemiBold', color: P.slate, fontSize: 18 }, icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, gap: 16 }, field: { gap: 8 }, label: { fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 13 }, input: { backgroundColor: P.wash, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: P.line, fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 15 }, description: { minHeight: 110 }, readonly: { fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 15, lineHeight: 23 }, recurrence: { paddingVertical: 16, gap: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: P.line }, weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, weekday: { minWidth: 44, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, selectedDay: { borderColor: P.accent, backgroundColor: P.wash }, dayText: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 13, textTransform: 'capitalize' }, selectedDayText: { color: P.ink, fontFamily: 'Outfit_600SemiBold' }, help: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 20 }, error: { padding: 12, borderWidth: 1, borderColor: P.accent, borderRadius: 8, fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 14 }, confirmation: { gap: 12, paddingVertical: 12 }, footer: { backgroundColor: P.white, flexDirection: 'row', gap: 8, alignItems: 'center', borderTopWidth: 1, borderColor: P.line, padding: 12 }, spacer: { flex: 1 }, button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: P.line }, buttonText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: P.ink }, primary: { backgroundColor: P.accent, borderColor: P.accent }, primaryText: { fontFamily: 'Outfit_600SemiBold', color: P.white, fontSize: 14 }, deleteButton: { backgroundColor: P.ink },
});
