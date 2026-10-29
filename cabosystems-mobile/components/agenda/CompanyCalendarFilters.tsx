import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import { CalendarColorPicker } from './CalendarColorPicker';

export const CompanyCalendarFilters = React.memo(function CompanyCalendarFilters({ calendars, hidden, locale, onToggle, colors = {}, loadingColors, colorsFailed, onRetryColors, onSaveColor }: {
  calendars: { id: string; name: string; backgroundColor?: string | null }[];
  hidden: string[]; locale: string; onToggle: (id: string) => void;
  colors?: Record<string, string>; loadingColors?: boolean; colorsFailed?: boolean;
  onRetryColors?: () => Promise<void>; onSaveColor?: (id: string, color: string | null) => Promise<void>;
}) {
  const button = useRef<ViewInstance>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const editingCalendar = calendars.find(calendar => calendar.id === editing);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => setAnchor(null), [width, height]);
  const es = locale.startsWith('es');
  const label = es ? 'Calendarios' : 'Calendars';
  const selected = calendars.filter(calendar => !hidden.includes(calendar.id)).length;
  const menuWidth = Math.min(300, width - 32);
  const menuHeight = Math.min(editingCalendar ? 480 : 360, editingCalendar ? 480 : Math.max(64, calendars.length * 60 + 56), height - insets.top - insets.bottom - 32);
  const open = () => { setEditing(null); button.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height })); };
  return <View>
    <Pressable ref={button} accessibilityRole="button" accessibilityLabel={`${label}: ${selected}/${calendars.length}`} accessibilityState={{ expanded: Boolean(anchor) }} onPress={open} style={({ pressed }) => [s.toggle, pressed && s.pressed]}>
      <Text style={s.label}>{label}</Text><Text style={s.summary}>{selected}/{calendars.length}</Text>
      {anchor ? <ChevronUp size={14} color={P.accent} /> : <ChevronDown size={14} color={P.accent} />}
    </Pressable>
    <Modal visible={Boolean(anchor)} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setAnchor(null)}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable accessibilityRole="button" accessibilityLabel={es ? 'Cerrar calendarios' : 'Close calendars'} onPress={() => setAnchor(null)} style={StyleSheet.absoluteFill} />
        {anchor && <View accessibilityViewIsModal style={[s.options, { width: menuWidth, height: menuHeight,
          left: Math.max(16, Math.min(anchor.x + anchor.width - menuWidth, width - menuWidth - 16)),
          top: Math.max(insets.top + 8, Math.min(anchor.y + anchor.height + 6, height - menuHeight - insets.bottom - 16)),
        }]}>
          {editingCalendar && onSaveColor ? <CalendarColorPicker key={editingCalendar.id} calendar={editingCalendar} initialColor={colors[editingCalendar.id] || editingCalendar.backgroundColor || P.slate} locale={locale} onClose={() => setEditing(null)} onSave={onSaveColor} /> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.optionList}>
            {onSaveColor && <Text style={s.help}>{es ? 'Tus colores · toca un círculo para cambiarlo' : 'Your colors · tap a circle to change it'}</Text>}
            {colorsFailed && <Pressable accessibilityRole="button" onPress={() => void onRetryColors?.()} style={s.retry}><Text style={s.help}>{es ? 'No se pudieron cargar tus colores. Reintentar.' : 'Could not load your colors. Retry.'}</Text></Pressable>}
            {!calendars.length && <Text style={s.name}>{es ? 'No hay calendarios disponibles.' : 'No calendars available.'}</Text>}
            {calendars.map(calendar => {
              const checked = !hidden.includes(calendar.id);
              return <View key={calendar.id} style={s.option}><Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={calendar.name} onPress={() => onToggle(calendar.id)} style={({ pressed }) => [s.optionLabel, pressed && s.pressed]}>
                <View style={[s.checkbox, checked && s.checked]}>{checked && <Check size={14} color={P.white} />}</View>
                <Text style={s.name}>{calendar.name}</Text>
              </Pressable>{onSaveColor ? <Pressable accessibilityRole="button" accessibilityLabel={`${es ? 'Cambiar color de' : 'Change color for'} ${calendar.name}`} disabled={loadingColors || colorsFailed} onPress={() => setEditing(calendar.id)} style={s.colorButton}><View style={[s.colorDot, { backgroundColor: colors[calendar.id] || calendar.backgroundColor || P.slate }]} /></Pressable> : null}</View>;
            })}
          </ScrollView>}
        </View>}
      </View>
    </Modal>
  </View>;
});

const s = StyleSheet.create({
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: 9, borderWidth: 1, borderColor: P.line, borderRadius: 9, backgroundColor: P.white },
  label: { color: P.slate, fontFamily: 'Outfit_500Medium', fontSize: 12 },
  summary: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 11, fontVariant: ['tabular-nums'] },
  options: { position: 'absolute', borderWidth: 1, borderColor: P.line, borderRadius: 12, backgroundColor: P.white, shadowColor: P.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5 },
  optionList: { padding: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, padding: 8 },
  optionLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  colorButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, colorDot: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, borderColor: P.line },
  help: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: P.slate, lineHeight: 18, padding: 6 }, retry: { minHeight: 44, justifyContent: 'center' },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: P.slate, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checked: { backgroundColor: P.slate },
  name: { flex: 1, color: P.ink, fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20 },
  pressed: { opacity: 0.6 },
});
