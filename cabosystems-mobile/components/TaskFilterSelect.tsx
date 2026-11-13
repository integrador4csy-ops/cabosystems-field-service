import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Modal, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions, type ViewInstance } from 'react-native';
import { Check, ChevronDown, X } from 'lucide-react-native';
import { useLanguage } from '@/lib/i18n';

interface Props {
  anchored?: boolean;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export function TaskFilterSelect({ label, value, options, onChange, anchored = false }: Props) {
  const { t: tr } = useInterfaceTranslation();
  const { language } = useLanguage();
  const closeLabel = language === 'en' ? 'Close' : tr("Cerrar");
  const trigger = useRef<ViewInstance>(null);
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const { width, height } = useWindowDimensions();
  useEffect(() => setOpen(false), [width, height]);
  const [open, setOpen] = useState(false);
  return <View style={s.root}>
    <Pressable ref={trigger} accessibilityRole="button" accessibilityLabel={`${label}: ${options.find(option => option.value === value)?.label || ''}`} accessibilityState={{ expanded: open }} onPress={() => { if (anchored) trigger.current?.measureInWindow((x, y, width, height) => { setAnchor({ x, y, width, height }); setOpen(true); }); else setOpen(true); }} style={s.trigger}>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={s.value}>{options.find(option => option.value === value)?.label}</Text><ChevronDown size={14} color="#f78c26" />
    </Pressable>
    <Modal visible={open} statusBarTranslucent={anchored} transparent animationType={anchored ? "fade" : "slide"} onRequestClose={() => setOpen(false)}>
      <View style={anchored ? StyleSheet.absoluteFill : s.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityLabel={closeLabel} onPress={() => setOpen(false)} />
        <View style={[s.sheet, { height: Math.min(520, 64 + options.length * 52) }, anchored && anchor ? [s.dropdown, { left: anchor.x, top: anchor.y + anchor.height + 4, width: anchor.width, height: Math.min(options.length * 52 + 8, 260, height - anchor.y - anchor.height - 24) }] : undefined]} accessibilityViewIsModal>
          {!anchored ? (
            <>
              <View style={s.sheetHandleContainer}>
                <View style={s.sheetHandle} />
              </View>
              <View style={s.heading}>
                <Text accessibilityRole="header" style={s.title}>{label}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={() => setOpen(false)} style={s.close}>
                  <X size={21} color="#343e48" />
                </Pressable>
              </View>
            </>
          ) : null}
          <FlatList data={options} keyExtractor={option => option.value} keyboardShouldPersistTaps="handled" renderItem={({ item }) => {
            const selected = value === item.value;
            return <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              android_ripple={{ color: 'rgba(247, 140, 38, 0.16)' }}
              onPress={() => { onChange(item.value); setOpen(false); }}
              style={({ pressed }) => [
                s.option,
                selected && s.selected,
                Platform.OS !== 'android' && pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[s.optionText, selected && s.selectedText]}>{item.label}</Text>{selected && <Check size={19} color="#FFFFFF" />}
            </Pressable>;
          }} />
        </View>
      </View>
    </Modal>
  </View>;
}

const s = StyleSheet.create({
  dropdown: { position: 'absolute', maxWidth: undefined, maxHeight: undefined, borderRadius: 8, padding: 4, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', elevation: 6, shadowColor: '#000000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 8 },
  root: { flex: 1, minWidth: 0 },
  trigger: { minHeight: 44, paddingHorizontal: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 4 },
  value: { flex: 1, color: '#343e48', fontFamily: 'Outfit_500Medium', fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 0, paddingVertical: 0 },
  sheet: { width: '100%', maxWidth: 540, maxHeight: '80%', backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 16, paddingBottom: 28 },
  sheetHandleContainer: { alignItems: 'center', paddingBottom: 8 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.22)' },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 8, marginBottom: 8 },
  title: { flex: 1, color: '#000000', fontFamily: 'Outfit_600SemiBold', fontSize: 17 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  option: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, marginBottom: 4 },
  selected: { backgroundColor: '#f78c26' },
  optionText: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 14, color: '#343e48' },
  selectedText: { color: '#FFFFFF' },
});
