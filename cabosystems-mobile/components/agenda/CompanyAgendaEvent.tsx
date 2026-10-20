import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Bell, CalendarDays, MapPin, Repeat2, ChevronRight } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import type { CompanyEvent } from '@/types/companyAgenda';

export const CompanyAgendaEvent = memo(function CompanyAgendaEvent({ event, time, type, repeats, onOpen }: {
  event: CompanyEvent; time: string; type: string; repeats: string; onOpen: (event: CompanyEvent) => void;
}) {
  const Icon = event.tipo === 'recordatorio' ? Bell : CalendarDays;
  return <Pressable accessibilityRole="button" onPress={() => onOpen(event)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
    <View style={s.timeColumn}><Text style={s.time}>{time}</Text><View style={s.timeDot} /></View>
    <View style={s.body}><Text style={s.title}>{event.titulo}</Text><View style={s.meta}><Icon size={12} color={P.muted} /><Text style={s.metaText}>{type}</Text>{event.repeticion !== 'ninguna' ? <Repeat2 size={12} color={P.muted} accessibilityLabel={repeats} /> : null}</View>{event.ubicacion ? <View style={s.meta}><MapPin size={12} color={P.muted} /><Text style={s.location}>{event.ubicacion}</Text></View> : null}</View>
    <ChevronRight size={16} color={P.muted} style={s.chevron} />
  </Pressable>;
});
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 17, borderBottomWidth: 1, borderColor: P.line }, pressed: { opacity: 0.6 }, timeColumn: { width: 61, alignItems: 'flex-start', gap: 12, paddingTop: 3 }, time: { fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 12, lineHeight: 18 }, timeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: P.accent }, body: { flex: 1, gap: 7 }, title: { fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 15, lineHeight: 21 }, meta: { flexDirection: 'row', alignItems: 'center', gap: 5 }, metaText: { fontFamily: 'Outfit_400Regular', color: P.muted, fontSize: 12 }, location: { flex: 1, fontFamily: 'Outfit_400Regular', color: P.slate, fontSize: 12, lineHeight: 17 }, chevron: { marginTop: 4 },
});
