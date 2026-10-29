import React, { memo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, MapPin, Repeat2, ChevronRight } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import type { CompanyEvent } from '@/types/companyAgenda';
import { calendarAppearance } from '@/lib/companyAgendaPresentation';

export const CompanyAgendaEvent = memo(function CompanyAgendaEvent({ event, time, schedule, type, repeats, onOpen, color }: {
  color?: string; event: CompanyEvent; time: string; schedule: string; type: string; repeats: string; onOpen: (event: CompanyEvent) => void;
}) {
  const { language } = useTranslation();
  const appearance = calendarAppearance(event, color);
  const foreground = appearance ? { color: appearance.color } : undefined;
  const iconColor = appearance?.color || P.muted;
  return <Pressable accessibilityRole="button" onPress={() => onOpen(event)} style={({ pressed }) => [s.row, appearance && { backgroundColor: appearance.backgroundColor, paddingHorizontal: 14, borderRadius: 10 }, pressed && s.pressed]}>
    <View style={s.timeColumn}><Text style={[s.time, foreground]}>{time}</Text><View style={[s.timeDot, appearance && { backgroundColor: appearance.color }]} /></View>
    <View style={s.body}><Text style={[s.title, foreground]}>{event.google?.availabilityOnly ? (language === 'en' ? 'Busy' : 'Ocupado') : event.titulo}</Text>{event.hora ? <Text style={[s.metaText, foreground]}>{schedule}</Text> : null}<View style={s.meta}><CalendarDays size={12} color={iconColor} /><Text style={[s.metaText, foreground]}>{type}</Text>{event.repeticion !== 'ninguna' || event.google?.recurring ? <Repeat2 size={12} color={iconColor} accessibilityLabel={repeats} /> : null}</View>{event.ubicacion ? <View style={s.meta}><MapPin size={12} color={iconColor} /><Text style={[s.location, foreground]}>{event.ubicacion}</Text></View> : null}</View>
    <ChevronRight size={16} color={iconColor} style={s.chevron} />
  </Pressable>;
});
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 18, marginVertical: 6, borderBottomWidth: 1, borderColor: P.line }, pressed: { opacity: 0.6 }, timeColumn: { width: 76, alignItems: 'flex-start', gap: 12, paddingTop: 3 }, time: { fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 12, lineHeight: 18 }, timeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: P.accent }, body: { flex: 1, gap: 7 }, title: { fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 15, lineHeight: 21 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 5 }, metaText: { fontFamily: 'Outfit_400Regular', color: P.muted, fontSize: 12 }, location: { flex: 1, fontFamily: 'Outfit_400Regular', color: P.slate, fontSize: 12, lineHeight: 17 }, chevron: { marginTop: 4 },
});
