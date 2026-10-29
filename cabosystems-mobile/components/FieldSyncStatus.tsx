import React, { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fieldOutboxSummary, retryFieldSync, subscribeFieldSync } from '@/lib/fieldSync';
import { useTranslation } from '@/lib/i18n';

export function FieldSyncStatus({ owner }: { owner: string }) {
  const insets = useSafeAreaInsets();
  const { language } = useTranslation(); const en = language === 'en';
  const [state, setState] = useState({ owner: '', count: 0, blocked: 0, error: null as string | null });
  useEffect(() => {
    if (!owner || Platform.OS === 'web') return;
    let active = true; let revision = 0;
    const refresh = async () => {
      const request = ++revision;
      try { const summary = await fieldOutboxSummary(owner); if (active && request === revision) setState({ owner, ...summary }); }
      catch { if (active && request === revision) setState({ owner, count: 0, blocked: 1, error: en ? 'Unable to read saved check-ins.' : 'No se pudieron leer los registros guardados.' }); }
    };
    const unsubscribe = subscribeFieldSync(() => { void refresh(); }); void refresh();
    return () => { active = false; unsubscribe(); };
  }, [owner, en]);
  if (state.owner !== owner || !state.count && !state.blocked) return null;
  const title = state.blocked ? (en ? 'Check-ins need review' : 'Registros por revisar') : `${en ? 'Pending check-ins' : 'Registros por enviar'}: ${state.count}`;
  const retry = async () => {
    try { await retryFieldSync(owner); }
    catch { Alert.alert(en ? 'Unable to retry' : 'No se pudo reintentar', en ? 'Your saved records have not been deleted.' : 'Tus registros guardados no se han eliminado.'); }
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityLiveRegion="polite" style={[styles.notice, { bottom: insets.bottom + 90 }]} onPress={() => Alert.alert(title,
    state.error || (en ? 'Saved on this device. They will be sent when the app is open and connected.' : 'Guardados en este dispositivo. Se enviarán con la app abierta y conectada.'),
    [{ text: en ? 'Close' : 'Cerrar', style: 'cancel' }, { text: en ? 'Retry' : 'Reintentar', onPress: () => { void retry(); } }])}>
    <Text style={styles.text}>{title}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  notice: { position: 'absolute', left: 16, right: 16, backgroundColor: '#343e48', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 8 },
  text: { color: '#FFFFFF', fontFamily: 'Outfit_500Medium', fontSize: 14 },
});
