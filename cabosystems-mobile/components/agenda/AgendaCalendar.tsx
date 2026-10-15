import React, { memo, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import { monthWorkWeeks, parseDateKey, weekDates } from '@/lib/agenda';

export const AgendaCalendar = memo(function AgendaCalendar({ date, today, mode, counts, locale, onSelect }: {
  date: string; today: string; mode: 'month' | 'week'; counts: Map<string, number>; locale: string; onSelect: (date: string) => void;
}) {
  const weeks = useMemo(() => mode === 'month' ? monthWorkWeeks(date) : [weekDates(date).slice(0, 5)], [date, mode]);
  const shortDay = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short' }), [locale]);
  const fullDate = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), [locale]);
  return <View style={styles.calendar}>
    <View style={styles.weekdays}>{weeks[0].map((day) => <Text key={day} style={styles.weekday} numberOfLines={1}>{shortDay.format(parseDateKey(day)).replace('.', '')}</Text>)}</View>
    {weeks.map((week) => <View key={week[0]} style={styles.week}>
      {week.map((day) => {
        const count = counts.get(day) || 0; const selected = day === date;
        return <Pressable key={day} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${fullDate.format(parseDateKey(day))}, ${count}`} onPress={() => onSelect(day)} style={[styles.cell, day === today && styles.today, selected && styles.selected]}>
          <Text style={[styles.day, day.slice(0, 7) !== date.slice(0, 7) && styles.outside, selected && styles.selectedText]}>{parseDateKey(day).getDate()}</Text>
          <View style={styles.mark}>{count > 0 ? <Text style={[styles.count, selected && styles.selectedText]}>{count}</Text> : <View style={styles.noCount} />}</View>
        </Pressable>;
      })}
    </View>)}
  </View>;
});
const styles = StyleSheet.create({
  calendar: { borderWidth: 1, borderColor: P.line, borderRadius: 10, padding: 6, marginBottom: 16 }, weekdays: { flexDirection: 'row', paddingVertical: 6 }, weekday: { flex: 1, textAlign: 'center', fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 12 }, week: { flexDirection: 'row', gap: 4, marginVertical: 2 }, cell: { flex: 1, minHeight: 52, paddingVertical: 4, alignItems: 'center', justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: 'transparent', gap: 2 }, today: { borderColor: P.accent }, selected: { backgroundColor: P.accent, borderColor: P.accent }, day: { color: P.ink, fontFamily: 'Outfit_500Medium', fontSize: 15 }, outside: { color: P.muted }, selectedText: { color: P.ink, fontFamily: 'Outfit_600SemiBold' }, mark: { minHeight: 15, alignItems: 'center', justifyContent: 'center' }, count: { color: P.slate, fontFamily: 'Outfit_500Medium', fontSize: 10 }, noCount: { height: 15 },
});
