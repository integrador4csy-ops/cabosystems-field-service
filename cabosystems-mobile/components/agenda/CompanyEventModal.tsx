import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AgendaPalette as P } from '@/constants/Theme';
import { dateKey } from '@/lib/agenda';
import { isoWeekday, NO_RECURRENCE } from '@/lib/companyAgendaRecurrence';
import { validCompanyEvent } from '@/lib/companyAgenda';
import type { CompanyAgendaCopy } from '@/lib/companyAgendaCopy';
import type { CompanyEvent, EventInput, RecurrenceFrequency } from '@/types/companyAgenda';
import { AgendaDatePicker } from './AgendaDatePicker';
import { CompanyChoice } from './CompanyChoice';

export function CompanyEventModal({ event, day, canManage, copy: c, locale, onClose, onSave, onDelete }: {
  event: CompanyEvent | null; day: string; canManage: boolean; copy: CompanyAgendaCopy; locale: string;
  onClose: () => void; onSave: (id: string | undefined, input: EventInput) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const [input, setInput] = useState<EventInput>(() => ({ titulo: event?.titulo || '', descripcion: event?.descripcion || '', tipo: event?.tipo || 'evento', fecha: event?.fecha || day, hora: event?.hora?.slice(0, 5) || '', ubicacion: event?.ubicacion || '', repeticion: event?.repeticion || 'ninguna', intervalo: event?.intervalo || 1, dias_semana: event?.dias_semana || [], repetir_hasta: event?.repetir_hasta || null }));
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
    setBusy(true); setError('');
    try { await onSave(event?.id, { ...input, titulo: input.titulo.trim(), descripcion: input.descripcion?.trim() || null, ubicacion: input.ubicacion?.trim() || null, hora: input.hora || null }); onClose(); }
    catch { setError(c.saveFailed); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!event || disabled) return;
    setBusy(true); setError('');
    try { await onDelete(event.id); onClose(); } catch { setError(c.deleteFailed); } finally { setBusy(false); }
  };
  const dateField = (label: string, value: string, setValue: (value: string) => void) => <View style={s.field}><Text style={s.label}>{label}</Text>{disabled ? <Text style={s.readonly}>{value.split('-').reverse().join('/')}</Text> : <AgendaDatePicker date={value} today={dateKey(new Date())} locale={locale} onSelect={setValue} />}</View>;
  const textField = (label: string, value: string, setValue: (value: string) => void, maxLength: number, multiline = false) => <View style={s.field}><Text style={s.label}>{label}</Text>{!canManage ? <Text selectable style={s.readonly}>{value || '—'}</Text> : <TextInput accessibilityLabel={label} editable={!busy} value={value} onChangeText={setValue} maxLength={maxLength} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'} style={[s.input, multiline && s.description]} />}</View>;
  return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={() => { if (!busy) onClose(); }}>
    <StatusBar style="dark" />
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[s.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.sheet} accessibilityViewIsModal>
        <View style={s.header}><Text accessibilityRole="header" style={s.title}>{!canManage ? c.details : event ? c.edit : c.newEvent}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.close} disabled={busy} style={s.icon} onPress={onClose}><X size={22} color={P.ink} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          {textField(c.titleLabel, input.titulo, titulo => change({ titulo }), 160)}
          <CompanyChoice label={c.type} value={input.tipo} disabled={disabled} options={[{ value: 'evento', label: c.event }, { value: 'recordatorio', label: c.reminder }]} onChange={value => { change({ tipo: value as EventInput['tipo'], ...(value === 'evento' ? NO_RECURRENCE : {}) }); if (value === 'evento') setMode('ninguna'); }} />
          {dateField(c.date, input.fecha, fecha => change({ fecha }))}
          {textField(c.time, input.hora || '', hora => change({ hora }), 5)}
          {input.tipo === 'recordatorio' ? <View style={s.recurrence}>
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
          {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
          {deleting ? <View style={s.confirmation}><Text style={s.readonly}>{event?.repeticion !== 'ninguna' ? c.deleteSeries : c.deleteOne}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => setDeleting(false)} style={s.button}><Text style={s.buttonText}>{c.cancel}</Text></Pressable><Pressable accessibilityRole="button" disabled={busy} onPress={() => void remove()} style={[s.button, s.deleteButton]}><Text style={s.primaryText}>{busy ? c.deleting : c.confirm}</Text></Pressable></View> : null}
        </ScrollView>
        <View style={s.footer}>{canManage && event && !deleting ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setDeleting(true)} style={s.button}><Text style={s.buttonText}>{c.remove}</Text></Pressable> : null}<View style={s.spacer} /><Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={s.button}><Text style={s.buttonText}>{c.close}</Text></Pressable>{canManage && !deleting ? <Pressable accessibilityRole="button" accessibilityLabel={c.save} disabled={busy} onPress={() => void submit()} style={[s.button, s.primary]}>{busy ? <ActivityIndicator color={P.white} /> : <Text style={s.primaryText}>{c.save}</Text>}</Pressable> : null}</View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: P.white, alignItems: 'center' }, sheet: { width: '100%', maxWidth: 600, flex: 1 }, header: { minHeight: 64, paddingLeft: 20, paddingRight: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: P.line }, title: { flex: 1, fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 20 }, icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, gap: 18 }, field: { gap: 8 }, label: { fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 13 }, input: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: P.line, fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 15 }, description: { minHeight: 110 }, readonly: { fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 15, lineHeight: 23 }, recurrence: { paddingVertical: 16, gap: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: P.line }, weekdays: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, weekday: { minWidth: 44, minHeight: 44, borderRadius: 8, borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }, selectedDay: { borderColor: P.accent, backgroundColor: P.wash }, dayText: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 13, textTransform: 'capitalize' }, selectedDayText: { color: P.ink, fontFamily: 'Outfit_600SemiBold' }, help: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 20 }, error: { padding: 12, borderWidth: 1, borderColor: P.accent, borderRadius: 8, fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 14 }, confirmation: { gap: 12, paddingVertical: 12 }, footer: { flexDirection: 'row', gap: 8, alignItems: 'center', borderTopWidth: 1, borderColor: P.line, padding: 12 }, spacer: { flex: 1 }, button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: P.line }, buttonText: { fontFamily: 'Outfit_500Medium', fontSize: 14, color: P.ink }, primary: { backgroundColor: P.accent, borderColor: P.accent }, primaryText: { fontFamily: 'Outfit_600SemiBold', color: P.white, fontSize: 14 }, deleteButton: { backgroundColor: P.ink },
});
