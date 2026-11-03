import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronDown } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';

const TIMES = Array.from({ length: 96 }, (_, index) => `${String(Math.floor(index / 4)).padStart(2, '0')}:${String(index % 4 * 15).padStart(2, '0')}`);
const ROW_HEIGHT = 44;

export function AgendaTimePicker({ label, value, disabled, locale, onChange }: {
  label: string; value: string; disabled: boolean; locale: string; onChange: (value: string) => void;
}) {
  const button = useRef<ViewInstance>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  useEffect(() => setAnchor(null), [width, height, disabled]);
  const options = useMemo(() => value && !TIMES.includes(value) ? [...TIMES, value].sort() : TIMES, [value]);
  const selectedIndex = Math.max(0, options.indexOf(value));
  const cleanLabel = label.replace(/\s*\(HH:mm\)/gi, '');
  const top = anchor ? anchor.y + anchor.height + 4 : 0;
  const menuHeight = Math.max(ROW_HEIGHT, Math.min(ROW_HEIGHT * 5, height - top - insets.bottom - 12));
  return <View style={s.field}>
    <Text style={s.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{cleanLabel}</Text>
    <Pressable ref={button} accessibilityRole="button" accessibilityLabel={`${cleanLabel}: ${value}`} accessibilityState={{ expanded: Boolean(anchor), disabled }} disabled={disabled}
      onPress={() => button.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }))} style={s.trigger}>
      <Text style={s.value} numberOfLines={1}>{value || '—'}</Text><ChevronDown size={12} color={P.slate} />
    </Pressable>
    <Modal visible={Boolean(anchor)} transparent animationType="none" statusBarTranslucent onRequestClose={() => setAnchor(null)}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={locale.startsWith('en') ? 'Close time list' : 'Cerrar lista de horas'} onPress={() => setAnchor(null)} />
        {anchor ? <View accessibilityViewIsModal style={[s.menu, { left: anchor.x, top, width: anchor.width, height: menuHeight }]}>
          <FlatList data={options} keyExtractor={item => item} initialScrollIndex={selectedIndex} getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
            keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={item} accessibilityState={{ selected: item === value }}
              onPress={() => { onChange(item); setAnchor(null); }} style={[s.option, item === value && s.selected]}><Text style={[s.value, item === value && s.selectedText]}>{item}</Text></Pressable>} />
        </View> : null}
      </View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  field: { flex: 1, minWidth: 0, gap: 8 },
  label: { fontFamily: 'Outfit_500Medium', fontSize: 12, lineHeight: 18, color: P.slate },
  trigger: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 3, paddingHorizontal: 8, borderWidth: 1, borderColor: P.line, borderRadius: 8, backgroundColor: P.white },
  value: { flexShrink: 1, fontFamily: 'Outfit_400Regular', fontSize: 13, color: P.ink },
  menu: { position: 'absolute', backgroundColor: P.white, borderWidth: 1, borderColor: P.line, borderRadius: 8, overflow: 'hidden', elevation: 6, shadowColor: P.ink, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8 },
  option: { height: ROW_HEIGHT, justifyContent: 'center', paddingHorizontal: 8 },
  selected: { backgroundColor: P.accent },
  selectedText: { color: P.white, fontFamily: 'Outfit_600SemiBold' },
});
