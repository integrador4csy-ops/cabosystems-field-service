import React, { memo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin, Repeat2, ChevronRight } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import type { CompanyEvent } from '@/types/companyAgenda';
import { calendarAppearance } from '@/lib/companyAgendaPresentation';

export const CompanyAgendaEvent = memo(function CompanyAgendaEvent({
  event,
  time,
  schedule,
  type,
  repeats,
  onOpen,
  color,
}: {
  color?: string;
  event: CompanyEvent;
  time?: string;
  schedule: string;
  type?: string;
  repeats?: string;
  onOpen: (event: CompanyEvent) => void;
}) {
  const { language } = useTranslation();
  const appearance = calendarAppearance(event, color);
  const foreground = appearance ? { color: appearance.color } : undefined;
  const iconColor = appearance?.color || P.muted;
  const isRecurring = event.repeticion !== 'ninguna' || event.google?.recurring;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(event)}
      style={({ pressed }) => [
        s.row,
        appearance && { backgroundColor: appearance.backgroundColor, paddingHorizontal: 14, borderRadius: 10 },
        pressed && s.pressed,
      ]}
    >
      <View style={s.body}>
        <Text style={[s.title, foreground]} numberOfLines={2}>
          {event.google?.availabilityOnly ? (language === 'en' ? 'Busy' : 'Ocupado') : event.titulo}
        </Text>
        <View style={s.scheduleRow}>
          <Text style={[s.scheduleText, foreground]}>{schedule}</Text>
          {isRecurring ? <Repeat2 size={12} color={iconColor} accessibilityLabel={repeats} /> : null}
        </View>
        {event.ubicacion ? (
          <View style={s.meta}>
            <MapPin size={12} color={iconColor} />
            <Text style={[s.location, foreground]} numberOfLines={1}>
              {event.ubicacion}
            </Text>
          </View>
        ) : null}
      </View>
      <ChevronRight size={16} color={iconColor} style={s.chevron} />
    </Pressable>
  );
});

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    marginVertical: 4,
    borderBottomWidth: 1,
    borderColor: P.line,
  },
  pressed: { opacity: 0.6 },
  body: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    color: P.ink,
    fontSize: 15,
    lineHeight: 20,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  scheduleText: {
    fontFamily: 'Outfit_400Regular',
    color: P.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 1,
  },
  location: {
    flex: 1,
    fontFamily: 'Outfit_400Regular',
    color: P.slate,
    fontSize: 12,
    lineHeight: 16,
  },
  chevron: {
    flexShrink: 0,
  },
});
