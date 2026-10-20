import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { AgendaPalette as P } from '@/constants/Theme';

export function CompanyChoice({ label, value, options, disabled = false, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; disabled?: boolean; onChange: (value: string) => void;
}) {
  return <View style={s.field}><Text style={s.label}>{label}</Text>{disabled ? <Text style={s.readonly}>{options.find(option => option.value === value)?.label}</Text> : <View style={s.options} accessibilityRole="radiogroup" accessibilityLabel={label}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.value }} onPress={() => onChange(option.value)} style={[s.option, value === option.value && s.selected]}><Text style={[s.text, value === option.value && s.selectedText]}>{option.label}</Text></Pressable>)}</View>}</View>;
}
const s = StyleSheet.create({
  field: { gap: 8 }, label: { fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 13 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: P.line }, selected: { borderColor: P.accent, backgroundColor: P.wash },
  text: { fontFamily: 'Outfit_400Regular', color: P.slate, fontSize: 14 }, selectedText: { color: P.ink, fontFamily: 'Outfit_600SemiBold' }, readonly: { fontFamily: 'Outfit_400Regular', color: P.ink, fontSize: 15, lineHeight: 22 },
});
