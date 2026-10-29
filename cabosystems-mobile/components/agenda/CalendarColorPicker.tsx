import React, { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronLeft } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import { CALENDAR_COLOR_PALETTE, validCalendarColor } from '@/lib/calendarColorPreferences';

export function CalendarColorPicker({ calendar, initialColor, locale, onClose, onSave }: {
  calendar: { id: string; name: string }; initialColor: string; locale: string;
  onClose: () => void; onSave: (id: string, color: string | null) => Promise<void>;
}) {
  const en = locale.startsWith('en'); const lock = useRef(false);
  const [draft, setDraft] = useState<string | null>(initialColor);
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const save = async () => {
    if (lock.current || draft !== null && !validCalendarColor(draft)) return;
    lock.current = true; setSaving(true); setError('');
    try { await onSave(calendar.id, draft); onClose(); }
    catch { setError(en ? 'Could not save your color. Try again.' : 'No se pudo guardar tu color. Intenta de nuevo.'); }
    finally { lock.current = false; setSaving(false); }
  };
  return <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Back to calendars' : 'Volver a calendarios'} disabled={saving} onPress={onClose} style={s.back}><ChevronLeft size={18} color={P.ink} /><Text style={s.title}>{calendar.name}</Text></Pressable>
    <Text style={s.help}>{en ? 'This color is only for your account.' : 'Este color es solo para tu cuenta.'}</Text>
    <View style={s.palette}>{CALENDAR_COLOR_PALETTE.map(color => {
      const selected = draft?.toLowerCase() === color;
      return <Pressable key={color} accessibilityRole="radio" accessibilityLabel={color} accessibilityState={{ selected, disabled: saving }} disabled={saving} onPress={() => setDraft(color)} style={[s.swatch, { backgroundColor: color }, selected && s.selected]}>
        {selected && <View style={s.mark}><Check size={13} color={P.ink} /></View>}
      </Pressable>;
    })}</View>
    <Text style={s.label}>{en ? 'Custom color' : 'Color personalizado'}</Text>
    <View style={s.inputRow}><View style={[s.preview, { backgroundColor: draft && validCalendarColor(draft) ? draft : P.white }]} /><TextInput accessibilityLabel={en ? 'Hex color, for example #F78C26' : 'Color hexadecimal, por ejemplo #F78C26'} value={draft || ''} onChangeText={setDraft} editable={!saving} maxLength={7} autoCorrect={false} autoCapitalize="characters" placeholder="#F78C26" placeholderTextColor={P.slate} style={s.input} /></View>
    <Pressable accessibilityRole="button" disabled={saving} onPress={() => setDraft(null)} style={s.reset}><Text style={s.resetText}>{en ? 'Use original color' : 'Usar color original'}</Text></Pressable>
    {draft === null && <Text style={s.help}>{en ? 'The original color will be restored.' : 'Se restaurará el color original.'}</Text>}
    {error ? <Text accessibilityRole="alert" style={s.help}>{error}</Text> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={en ? 'Save my color' : 'Guardar mi color'} disabled={saving || draft !== null && !validCalendarColor(draft)} onPress={() => void save()} style={({ pressed }) => [s.save, (saving || draft !== null && !validCalendarColor(draft)) && s.disabled, pressed && { opacity: 0.8 }]}>{saving ? <ActivityIndicator color={P.ink} /> : <Text style={s.saveText}>{en ? 'Save color' : 'Guardar color'}</Text>}</Pressable>
  </ScrollView>;
}
const s = StyleSheet.create({
  content: { padding: 14, gap: 12 }, back: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, color: P.ink, fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 21 },
  help: { color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18 },
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center' },
  selected: { borderWidth: 2, borderColor: P.ink }, mark: { width: 19, height: 19, backgroundColor: P.white, borderRadius: 10, borderWidth: 1, borderColor: P.ink, alignItems: 'center', justifyContent: 'center' },
  label: { color: P.ink, fontFamily: 'Outfit_500Medium', fontSize: 13 }, inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  preview: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: P.line },
  input: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: P.line, borderRadius: 8, paddingHorizontal: 10, color: P.ink, fontFamily: 'Outfit_400Regular', fontSize: 14 },
  reset: { minHeight: 44, justifyContent: 'center' }, resetText: { color: P.slate, textDecorationLine: 'underline', fontFamily: 'Outfit_500Medium', fontSize: 13 },
  save: { minHeight: 48, borderRadius: 8, backgroundColor: P.accent, alignItems: 'center', justifyContent: 'center' }, saveText: { color: P.ink, fontFamily: 'Outfit_600SemiBold', fontSize: 14 }, disabled: { opacity: 0.4 },
});
