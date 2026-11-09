import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ClipboardCheck, MapPinned } from 'lucide-react-native';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import { LiveFleetMap } from '@/components/LiveFleetMap';
import { useTranslation } from '@/lib/i18n';
import { getFleetMapWorkers, type FleetMapWorker } from '@/lib/fleetMap';
import { startForegroundPolling } from '@/lib/foregroundPolling';
import { supabase } from '@/lib/supabase';
import { ChecksHistoryContent } from './checks';

function FleetMapPanel() {
  const [workers, setWorkers] = useState<FleetMapWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError(false);
    try {
      setWorkers(await getFleetMapWorkers());
    } catch (cause) {
      console.warn('No se pudo cargar el radar móvil:', cause);
      setError(true);
    } finally {
      setLoading(false);
      if (manual) setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    const stopPolling = startForegroundPolling(() => load(), 15_000);
    const channel = supabase
      .channel('mobile-radar-ubicaciones-en-vivo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ubicaciones_usuarios' }, () => {
        void load();
      })
      .subscribe();
    return () => {
      stopPolling();
      void supabase.removeChannel(channel);
    };
  }, [load]));

  return <LiveFleetMap
    workers={workers}
    loading={loading}
    error={error}
    refreshing={refreshing}
    onRefresh={() => void load(true)}
  />;
}

export default function TrackingTab() {
  const headerHeight = useHeaderHeight();
  const { t } = useTranslation();
  const [view, setView] = useState<'map' | 'checks'>('map');

  return <View style={styles.screen}>
    <HeaderCaboSystems seamless showProjectSelector={false} />
    <View style={[styles.trackingArea, { top: headerHeight }]}> 
      <View style={styles.switcher}>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: view === 'map' }}
          onPress={() => setView('map')}
          style={[styles.switchButton, view === 'map' && styles.switchButtonActive]}
        >
          <MapPinned size={19} color={view === 'map' ? '#FFFFFF' : '#343e48'} strokeWidth={2.2} />
          <Text style={[styles.switchText, view === 'map' && styles.switchTextActive]}>{t('tracking.liveMap')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="tab"
          accessibilityState={{ selected: view === 'checks' }}
          onPress={() => setView('checks')}
          style={[styles.switchButton, view === 'checks' && styles.switchButtonActive]}
        >
          <ClipboardCheck size={19} color={view === 'checks' ? '#FFFFFF' : '#343e48'} strokeWidth={2.2} />
          <Text style={[styles.switchText, view === 'checks' && styles.switchTextActive]}>{t('tracking.checks')}</Text>
        </Pressable>
      </View>
      <View style={styles.panel}>
        {view === 'map' ? <FleetMapPanel /> : <ChecksHistoryContent embedded />}
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#E9EEF2' },
  trackingArea: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF' },
  switcher: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: 'rgba(52,62,72,0.10)' },
  switchButton: { flex: 1, height: 42, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(52,62,72,0.07)' },
  switchButtonActive: { backgroundColor: '#f78c26' },
  switchText: { color: '#343e48', fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  switchTextActive: { color: '#FFFFFF', fontFamily: 'Outfit_700Bold' },
  panel: { flex: 1, backgroundColor: '#FFFFFF' },
});
