import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Plus, CalendarSync } from 'lucide-react-native';
import { AgendaPalette as P, Colors } from '@/constants/Theme';
import { HeaderCaboSystems } from '@/components/HeaderCaboSystems';
import { EqualSegmentedTabs, type EqualSegmentedTab } from '@/components/EqualSegmentedTabs';
import { parseDateKey } from '@/lib/agenda';
import type { CompanyView } from '@/lib/companyAgenda';
import type { CompanyAgendaCopy } from '@/lib/companyAgendaCopy';
import { AgendaDatePicker } from './AgendaDatePicker';

const VIEWS: readonly CompanyView[] = ['month', 'week', 'day'];

export const CompanyAgendaTopBar = React.memo(function CompanyAgendaTopBar({ copy: c, canManage, onCreate, onSync }: { copy: CompanyAgendaCopy; canManage: boolean; onCreate: () => void; onSync: () => void }) {
  return <HeaderCaboSystems seamless showProjectSelector={false} rightAccessory={canManage ? <Pressable accessibilityRole="button" accessibilityLabel={c.newEvent} onPress={onCreate} style={({ pressed }) => [s.add, pressed && s.pressed]}><Plus size={20} strokeWidth={2.6} color={P.white} /></Pressable> : undefined} accountAccessory={<Pressable accessibilityRole="button" accessibilityLabel={c.syncCalendar} onPress={onSync} style={({ pressed }) => [s.headerSync, pressed && s.pressed]}><CalendarSync size={21} strokeWidth={2.2} color={P.accent} /></Pressable>} />;
});

export const CompanyAgendaControls = React.memo(function CompanyAgendaControls({ copy: c, locale, view, anchor, today, days, counts, onView, onDate, calendarFilter, showCalendar = true }: {
  calendarFilter?: React.ReactNode; showCalendar?: boolean;
  copy: CompanyAgendaCopy; locale: string; view: CompanyView; anchor: string; today: string;
  days: string[]; counts: Map<string, number>;
  onView: (value: CompanyView) => void;
  onDate: (value: string) => void;
}) {
  const monthLabel = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long' }).format(parseDateKey(anchor)), [anchor, locale]);
  const viewTabs = useMemo<readonly EqualSegmentedTab<CompanyView>[]>(
    () => VIEWS.map(id => ({ id, label: c[id] })),
    [c],
  );
  return <View style={s.controls}>
    <View style={s.periodNavigation}>
      <View style={s.periodLabel}><AgendaDatePicker date={anchor} today={today} locale={locale} compact label={monthLabel} onSelect={onDate} /></View>
      <View style={s.filterCell}>{calendarFilter}</View>
    </View>
    <EqualSegmentedTabs accessibilityLabel={c.views} value={view} tabs={viewTabs} onChange={onView} />
    {showCalendar ? <CompanyAgendaGrid copy={c} locale={locale} view={view} anchor={anchor} today={today} days={days} counts={counts} onDate={onDate} onView={onView} /> : null}
  </View>;
});

export const CompanyAgendaGrid = React.memo(function CompanyAgendaGrid({ copy: c, locale, view, anchor, today, days, counts, onDate, onView }: {
  copy: CompanyAgendaCopy; locale: string; view: CompanyView; anchor: string; today: string;
  days: string[]; counts: Map<string, number>; onDate: (value: string) => void; onView: (value: CompanyView) => void;
}) {
  const formats = useMemo(() => ({ weekday: new Intl.DateTimeFormat(locale, { weekday: 'short' }), full: new Intl.DateTimeFormat(locale, { dateStyle: 'full' }) }), [locale]);
  if (view === 'day') return null;
  return <View style={s.calendar}>
    <View style={s.weekdays}>{days.slice(0, 7).map(day => <Text key={day} style={s.weekday}>{formats.weekday.format(parseDateKey(day)).replace('.', '')}</Text>)}</View>
    <View style={s.grid}>{days.map(day => {
      const selected = day === anchor;
      const count = counts.get(day) || 0;
      const outside = view === 'month' && day.slice(0, 7) !== anchor.slice(0, 7);
      return <Pressable key={day} accessibilityRole="button" accessibilityLabel={`${c.selectDay} ${formats.full.format(parseDateKey(day))}, ${count} ${c.count}`} accessibilityState={{ selected }} onPress={() => { onDate(day); onView('day'); }} style={({ pressed }) => [s.day, pressed && s.pressed]}>
        <View style={[s.dayCircle, day === today && s.todayCircle, selected && s.selectedCircle]}><Text style={[s.dayNumber, outside && s.outside, selected && s.selectedNumber]}>{parseDateKey(day).getDate()}</Text></View>
        <View style={s.dots}>{Array.from({ length: Math.min(count, 3) }, (_, index) => <View key={index} style={[s.dot, outside && s.outsideDot]} />)}</View>
      </Pressable>;
    })}</View>
  </View>;
});

const s = StyleSheet.create({
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' }, headerSync: { width: 44, height: 44, borderRadius: 22, backgroundColor: P.wash, alignItems: 'center', justifyContent: 'center' }, pressed: { opacity: 0.6 }, controls: { paddingTop: 6 }, periodNavigation: { height: 52, marginTop: 0, flexDirection: 'row', alignItems: 'center', gap: 10 }, periodLabel: { flex: 1, minWidth: 0, height: 52, alignItems: 'flex-start', justifyContent: 'center' }, filterCell: { flexShrink: 0, height: 44, justifyContent: 'center' }, icon: { width: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }, calendar: { paddingBottom: 8 }, weekdays: { flexDirection: 'row', marginBottom: 7 }, weekday: { width: '14.285714%', textAlign: 'center', color: P.muted, fontFamily: 'Outfit_500Medium', fontSize: 11, textTransform: 'uppercase', paddingVertical: 4 }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, day: { width: '14.285714%', minHeight: 48, alignItems: 'center', justifyContent: 'center' }, dayCircle: { width: 33, height: 33, borderRadius: 17, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' }, todayCircle: { borderColor: Colors.primary }, selectedCircle: { backgroundColor: Colors.primary, borderColor: Colors.primary }, dayNumber: { fontFamily: 'Outfit_500Medium', color: P.ink, fontSize: 14 }, outside: { color: P.muted }, selectedNumber: { color: P.white, fontFamily: 'Outfit_600SemiBold' }, dots: { minHeight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }, dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: P.slate }, outsideDot: { opacity: 0.4 }, typeTabs: { flexDirection: 'row', gap: 24, borderBottomWidth: 1, borderColor: P.line }, typeTab: { minHeight: 46, justifyContent: 'center', borderBottomWidth: 2, borderColor: 'transparent' }, typeTabActive: { borderColor: Colors.primary }, typeText: { fontFamily: 'Outfit_400Regular', color: P.muted, fontSize: 13 }, typeTextActive: { fontFamily: 'Outfit_600SemiBold', color: P.ink },
});
