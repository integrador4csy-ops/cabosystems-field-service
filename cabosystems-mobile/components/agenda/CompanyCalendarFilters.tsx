import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp, SlidersHorizontal } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';

export function CompanyCalendarFilters({ calendars, hidden, locale, onToggle }: {
  calendars: { id: string; name: string; backgroundColor?: string | null }[];
  hidden: string[];
  locale: string;
  onToggle: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const es = locale.startsWith('es');
  const label = es ? 'Mis calendarios' : 'My calendars';
  const selected = calendars.filter(calendar => !hidden.includes(calendar.id)).length;
  return <View style={s.filters}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={({ pressed }) => [s.toggle, pressed && s.pressed]}>
      <SlidersHorizontal size={18} color={P.slate} />
      <Text style={s.label}>{label}</Text>
      <Text style={s.summary}>{selected}/{calendars.length}</Text>
      {open ? <ChevronUp size={18} color={P.slate} /> : <ChevronDown size={18} color={P.slate} />}
    </Pressable>
    {open ? <View style={s.options}>{calendars.map(calendar => {
      const checked = !hidden.includes(calendar.id);
      return <Pressable key={calendar.id} accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={calendar.name} onPress={() => onToggle(calendar.id)} style={({ pressed }) => [s.option, pressed && s.pressed]}>
        <View style={[s.checkbox, checked && s.checked]}>{checked ? <Check size={14} color={P.white} /> : null}</View>
        <Text style={s.name}>{calendar.name}</Text>
      </Pressable>;
    })}</View> : null}
  </View>;
}

const s = StyleSheet.create({
  filters: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: P.line },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  label: { flex: 1, color: P.slate, fontFamily: 'Outfit_500Medium', fontSize: 14 },
  summary: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 12, fontVariant: ['tabular-nums'] },
  options: { paddingBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 8 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: P.slate, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: P.slate },
  name: { flex: 1, color: P.ink, fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.6 },
});
