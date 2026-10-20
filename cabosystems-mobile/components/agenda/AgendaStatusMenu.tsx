import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SlidersHorizontal, Check, X } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import type { AgendaStatus } from '@/lib/agenda';
import type { AgendaCopy } from '@/lib/agendaCopy';

const statuses = ['all', 'pendiente', 'en_proceso', 'completada'] as const;

export function AgendaStatusMenu({ status, counts, copy: c, onSelect }: {
  status: AgendaStatus; counts: Record<AgendaStatus, number>; copy: AgendaCopy; onSelect: (status: AgendaStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const close = () => setOpen(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`${c.statuses}: ${c[status]}`} accessibilityState={{ expanded: open }} onPress={() => setOpen(true)} style={styles.trigger}>
      <SlidersHorizontal size={22} color={status === 'all' ? P.ink : P.accent} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={c.close} onPress={close} />
        <View style={styles.menu} accessibilityViewIsModal>
          <View style={styles.heading}><Text style={styles.title}>{c.statuses}</Text><Pressable accessibilityRole="button" accessibilityLabel={c.close} onPress={close} style={styles.trigger}><X size={21} color={P.slate} /></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled">
            {statuses.map(item => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: item === status }} onPress={() => { onSelect(item); close(); }} style={styles.option}>
              <Text style={[styles.label, item === status && styles.selected]}>{c[item]} ({counts[item]})</Text>
              {item === status ? <Check size={20} color={P.accent} /> : null}
            </Pressable>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  trigger: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 16, backgroundColor: P.overlay },
  menu: { width: '100%', maxWidth: 480, maxHeight: '85%', backgroundColor: P.white, borderRadius: 12, padding: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  title: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 18, color: P.ink },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: 1, borderColor: P.line },
  label: { flex: 1, fontFamily: 'Outfit_400Regular', color: P.slate, fontSize: 16 },
  selected: { fontFamily: 'Outfit_500Medium', color: P.ink },
});
