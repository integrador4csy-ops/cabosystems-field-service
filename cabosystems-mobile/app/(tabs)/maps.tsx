import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import { LiveFleetMap } from '@/components/LiveFleetMap';
import { getFleetMapWorkers, type FleetMapWorker } from '@/lib/fleetMap';
import { startForegroundPolling } from '@/lib/foregroundPolling';
import { supabase } from '@/lib/supabase';

export default function MapsTab() {
  const headerHeight = useHeaderHeight();
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

  return <View style={styles.screen}>
    <HeaderCaboSystems seamless showProjectSelector={false} />
    <View style={[styles.map, { top: headerHeight }]}>
      <LiveFleetMap
        workers={workers}
        loading={loading}
        error={error}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
      />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#E9EEF2' },
  map: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
