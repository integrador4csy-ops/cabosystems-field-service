import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AgendaPalette as P } from '@/constants/Theme';
import { dateKey, parseDateKey, shiftDate, shiftMonth, weekDates } from '@/lib/agenda';

export function AgendaDatePicker({ date, today, locale, onSelect, compact = false, label }: { date: string; today: string; locale: string; onSelect: (date: string) => void; compact?: boolean; label?: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(date);
  const [months, setMonths] = useState(false);
  const insets = useSafeAreaInsets();
  const es = locale.startsWith('es');
  const fullDate = useMemo(() => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }), [locale]);
  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long' }), [locale]);
  const weekday = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'narrow' }), [locale]);
  const days = useMemo(() => {
    const first = `${draft.slice(0, 7)}-01`;
    const start = weekDates(first)[0];
    const last = dateKey(new Date(parseDateKey(draft).getFullYear(), parseDateKey(draft).getMonth() + 1, 0, 12));
    const count = (Math.round((parseDateKey(last).getTime() - parseDateKey(start).getTime()) / 86400000) + 1);
    return Array.from({ length: Math.ceil(count / 7) * 7 }, (_, i) => shiftDate(start, i));
  }, [draft]);
  const close = () => setOpen(false);
  const apply = (value: string) => { onSelect(value); close(); };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${es ? 'Elegir fecha' : 'Choose date'}: ${fullDate.format(parseDateKey(date))}`} accessibilityState={{ expanded: open }} onPress={() => { setDraft(date); setMonths(false); setOpen(true); }} style={[styles.dateButton, compact && styles.compactButton]}>
      <Text numberOfLines={compact ? 1 : undefined} adjustsFontSizeToFit={compact} minimumFontScale={0.8} style={[styles.dateText, compact && styles.compactText]}>{label ? label.charAt(0).toLocaleUpperCase(locale) + label.slice(1) : date.split('-').reverse().join('/')}</Text>{!compact ? <CalendarDays size={18} color={P.ink} /> : null}
    </Pressable>
    {open && <Modal visible transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={es ? 'Cerrar' : 'Close'} onPress={close} style={StyleSheet.absoluteFill} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.row}><Text style={styles.heading}>{es ? 'Elegir fecha' : 'Choose date'}</Text><Pressable accessibilityRole="button" accessibilityLabel={es ? 'Cerrar' : 'Close'} onPress={close} style={styles.icon}><X size={22} color={P.ink} /></Pressable></View>
          <ScrollView>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" accessibilityLabel={es ? 'Periodo anterior' : 'Previous period'} onPress={() => setDraft(shiftMonth(draft, months ? -12 : -1))} style={styles.icon}><ChevronLeft size={22} color={P.ink} /></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={es ? 'Elegir mes' : 'Choose month'} onPress={() => setMonths(!months)} style={styles.monthButton}><Text style={styles.monthText}>{months ? draft.slice(0, 4) : `${monthName.format(parseDateKey(draft))} ${draft.slice(0, 4)}`}</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={es ? 'Periodo siguiente' : 'Next period'} onPress={() => setDraft(shiftMonth(draft, months ? 12 : 1))} style={styles.icon}><ChevronRight size={22} color={P.ink} /></Pressable>
            </View>
            {months ? <View style={styles.grid}>{Array.from({ length: 12 }, (_, i) => <Pressable key={i} accessibilityRole="button" onPress={() => { setDraft(shiftMonth(draft, i - parseDateKey(draft).getMonth())); setMonths(false); }} style={styles.monthCell}><Text style={styles.dayText}>{monthName.format(new Date(2026, i, 1, 12))}</Text></Pressable>)}</View> : <>
              <View style={styles.row}>{weekDates(draft).map(day => <Text key={day} style={styles.weekday}>{weekday.format(parseDateKey(day))}</Text>)}</View>
              <View style={styles.grid}>{days.map(day => <Pressable key={day} accessibilityRole="button" accessibilityLabel={fullDate.format(parseDateKey(day))} accessibilityState={{ selected: day === draft }} onPress={() => setDraft(day)} style={[styles.cell, day === today && styles.today, day === draft && styles.selected]}><Text style={[styles.dayText, day.slice(0, 7) !== draft.slice(0, 7) && styles.outside, day === draft && styles.selectedText]}>{parseDateKey(day).getDate()}</Text></Pressable>)}</View>
            </>}
          </ScrollView>
          <View style={styles.actions}><Pressable accessibilityRole="button" onPress={() => apply(today)} style={styles.action}><Text style={styles.dayText}>{es ? 'Hoy' : 'Today'}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => apply(draft)} style={[styles.action, styles.apply]}><Text style={styles.selectedText}>{es ? 'Aplicar' : 'Apply'}</Text></Pressable></View>
        </View>
      </View>
    </Modal>}
  </>;
}
const styles = StyleSheet.create({
  compactButton: { flex: 1, alignSelf: 'stretch', borderWidth: 0, paddingHorizontal: 0, marginBottom: 0, gap: 0 }, compactText: { fontFamily: 'Outfit_600SemiBold', fontSize: 20, flexShrink: 1 },
  dateButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 24, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: P.line, borderRadius: 8 }, dateText: { fontFamily: 'Outfit_400Regular', fontSize: 15, color: P.ink },
  backdrop: { flex: 1, backgroundColor: P.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 }, sheet: { width: '100%', maxWidth: 480, maxHeight: '90%', padding: 16, borderRadius: 12, backgroundColor: P.white },
  row: { flexDirection: 'row', alignItems: 'center' }, heading: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: P.ink }, icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }, monthButton: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, monthText: { fontFamily: 'Outfit_500Medium', fontSize: 16, color: P.ink, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginVertical: 8 }, weekday: { width: '14.285714%', textAlign: 'center', paddingVertical: 8, fontFamily: 'Outfit_400Regular', color: P.slate }, cell: { width: '14.285714%', minHeight: 44, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'transparent', borderRadius: 6 }, dayText: { fontFamily: 'Outfit_400Regular', fontSize: 14, color: P.ink }, outside: { color: P.muted }, today: { borderColor: P.accent }, selected: { backgroundColor: P.accent }, selectedText: { fontFamily: 'Outfit_500Medium', color: P.white, fontSize: 14 }, monthCell: { width: '33.333333%', minHeight: 48, justifyContent: 'center', alignItems: 'center' }, actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingTop: 12 }, action: { minHeight: 44, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, apply: { backgroundColor: P.accent },
});
