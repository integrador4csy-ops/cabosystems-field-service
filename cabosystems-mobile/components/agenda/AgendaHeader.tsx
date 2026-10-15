import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, TextInput, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { usePathname } from 'expo-router';
import { Image } from 'expo-image';
import { FlashList } from '@shopify/flash-list';
import { ChevronDown, X, Search, Check } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import type { Project } from '@/types/database';
import type { AgendaCopy } from '@/lib/agendaCopy';
import { normalizeAgendaSearch } from '@/lib/agenda';

const logo = require('@/assets/images/Logo-CaboSystems-Field-Service-Dark.png');
export function AgendaHeader({ projects, projectId, onSelect, copy: c }: { projects: Project[]; projectId?: string; onSelect: (project?: Project) => void; copy: AgendaCopy }) {
  const insets = useSafeAreaInsets();
  const focused = usePathname() === '/schedule';
  const [open, setOpen] = useState(false); const [query, setQuery] = useState('');
  const selected = projects.find((project) => project.id === projectId);
  const visible = useMemo(() => projects.filter((project) => normalizeAgendaSearch(`${project.villa} ${project.unidad || ''} ${project.desarrollo}`).includes(normalizeAgendaSearch(query.trim()))), [projects, query]);
  const close = () => { setOpen(false); setQuery(''); };
  return <>
    {focused ? <StatusBar style="dark" /> : null}
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Image source={logo} style={styles.logo} contentFit="contain" contentPosition="left center" />
        <Pressable accessibilityRole="button" accessibilityLabel={`${c.selectProject}: ${selected?.villa || c.allProjects}`} onPress={() => setOpen(true)} style={styles.projectButton}>
          <Text numberOfLines={1} style={styles.projectButtonText}>{selected?.villa || selected?.unidad || c.allProjects}</Text><ChevronDown size={16} color={P.white} />
        </Pressable>
      </View>
    </View>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable accessibilityLabel={c.close} style={StyleSheet.absoluteFill} onPress={close} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.heading}><Text style={styles.title}>{c.selectProject}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.close} onPress={close} style={styles.icon}><X size={22} color={P.slate} /></Pressable></View>
          <View style={styles.search}><Search size={18} color={P.muted} /><TextInput value={query} onChangeText={setQuery} accessibilityLabel={c.searchProject} placeholder={c.searchProject} placeholderTextColor={P.muted} autoCorrect={false} style={styles.input} /></View>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: !projectId }} onPress={() => { onSelect(); close(); }} style={styles.option}><Text style={styles.optionTitle}>{c.allProjects}</Text>{!projectId ? <Check size={19} color={P.ink} /> : null}</Pressable>
          <View style={styles.projects}><FlashList data={visible} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item.id === projectId }} onPress={() => { onSelect(item); close(); }} style={styles.option}>
            <View style={styles.optionCopy}><Text style={styles.optionTitle}>{item.villa || item.unidad}</Text><Text style={styles.optionSubtitle}>{item.desarrollo}</Text></View>{item.id === projectId ? <Check size={19} color={P.ink} /> : null}
          </Pressable>} ListEmptyComponent={<Text style={styles.empty}>{c.noProjects}</Text>} /></View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  header: { overflow: 'hidden', backgroundColor: P.white, borderBottomWidth: 1, borderBottomColor: P.line }, bar: { height: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, logo: { flex: 1, maxWidth: 220, height: 54 }, projectButton: { flexShrink: 1, maxWidth: '48%', minHeight: 44, borderRadius: 22, backgroundColor: P.accent, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12 }, projectButtonText: { flexShrink: 1, color: P.white, fontFamily: 'Outfit_500Medium', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: P.overlay, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }, sheet: { width: '100%', maxWidth: 480, height: '75%', backgroundColor: P.white, borderRadius: 12, padding: 16 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, title: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 19, color: P.ink }, icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  search: { borderWidth: 1, borderColor: P.line, borderRadius: 8, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8, marginVertical: 12 }, input: { flex: 1, minHeight: 44, color: P.ink, fontSize: 14, fontFamily: 'Outfit_400Regular' }, projects: { flex: 1 }, option: { minHeight: 56, paddingVertical: 12, borderBottomWidth: 1, borderColor: P.line, flexDirection: 'row', alignItems: 'center', gap: 12 }, optionCopy: { flex: 1, gap: 3 }, optionTitle: { fontFamily: 'Outfit_500Medium', fontSize: 15, color: P.ink }, optionSubtitle: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: P.slate }, empty: { fontFamily: 'Outfit_400Regular', paddingVertical: 24, color: P.slate, textAlign: 'center' },
});
