import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, CalendarDays, MapPin, Repeat2, ChevronRight } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import type { CompanyEvent } from '@/types/companyAgenda';
import { calendarAppearance } from '@/lib/companyAgendaPresentation';

export const CompanyAgendaEvent = memo(function CompanyAgendaEvent({ event, time, schedule, type, repeats, onOpen }: {
  event: CompanyEvent; time: string; schedule: string; type: string; repeats: string; onOpen: (event: CompanyEvent) => void;
}) {
  const Icon = event.tipo === 'recordatorio' ? Bell : CalendarDays;
  const appearance = calendarAppearance(event);
  const foreground = appearance ? { color: appearance.color } : undefined;
  const iconColor = appearance?.color || P.muted;
  return <Pressable accessibilityRole="button" onPress={() => onOpen(event)} style={({ pressed }) => [s.row, appearance && { backgroundColor: appearance.backgroundColor, paddingHorizontal: 10, borderRadius: 8 }, pressed && s.pressed]}>
    <View style={s.timeColumn}><Text style={[s.time, foreground]}>{time}</Text><View style={[s.timeDot, appearance && { backgroundColor: appearance.color }]} /></View>
    <View style={s.body}><Text style={[s.title, foreground]}>{event.titulo}</Text>{event.hora ? <Text style={[s.metaText, foreground]}>{schedule}</Text> : null}<View style={s.meta}><Icon size={12} color={iconColor} /><Text style={[s.metaText, foreground]}>{type}</Text>{event.repeticion !== 'ninguna' || event.google?.recurring ? <Repeat2 size={12} color={iconColor} accessibilityLabel={repeats} /> : null}</View>{event.google ? <Text style={[s.metaText, foreground]}>Google · {event.google.calendarName}</Text> : null}{event.ubicacion ? <View style={s.meta}><MapPin size={12} color={iconColor} /><Text style={[s.location, foreground]}>{event.ubicacion}</Text></View> : null}</View>
    <ChevronRight size={16} color={iconColor} style={s.chevron} />
  </Pressable>;
});
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 17, borderBottomWidth: 1, borderColor: P.line }, pressed: { opacity: 0.6 }, timeColumn: { width: 76, alignItems: 'flex-start', gap: 12, paddingTop: 3 }, time: { fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 12, lineHeight: 18 }, timeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: P.accent }, body: { flex: 1, gap: 7 }, title: { fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 15, lineHeight: 21 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 5 }, metaText: { fontFamily: 'Outfit_400Regular', color: P.muted, fontSize: 12 }, location: { flex: 1, fontFamily: 'Outfit_400Regular', color: P.slate, fontSize: 12, lineHeight: 17 }, chevron: { marginTop: 4 },
});
