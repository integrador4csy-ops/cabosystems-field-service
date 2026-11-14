import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { ClipboardCheck, MapPinned, Route, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { ChecksHistoryContent } from './checks';
import { LiveFleetMap } from '@/components/LiveFleetMap';
import { MobileRouteHistory } from '@/components/MobileRouteHistory';
import { NotificationCenter } from '@/components/NotificationCenter';
import { ProfileNavButton } from '@/components/ProfileNavButton';
import { getFleetMapWorkers, type FleetMapWorker } from '@/lib/fleetMap';
import { startForegroundPolling } from '@/lib/foregroundPolling';
import { useTranslation } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';
import { EqualSegmentedTabs } from '@/components/EqualSegmentedTabs';

type TrackingView = 'map' | 'checks' | 'history';

const FleetMapPanel = React.memo(function FleetMapPanel({ query, overlayTop, active = true }: { query: string; overlayTop: number; active?: boolean }) {
  const [workers, setWorkers] = useState<FleetMapWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const requestGeneration = useRef(0);

  const load = useCallback(async () => {
    const generation = requestGeneration.current;
    setError(false);
    try {
      const nextWorkers = await getFleetMapWorkers();
      if (generation === requestGeneration.current) setWorkers(nextWorkers);
    } catch (cause) {
      console.warn('No se pudo cargar el radar móvil:', cause);
      if (generation === requestGeneration.current) setError(true);
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    setLoading(true);
    void load();
    const stopPolling = startForegroundPolling(load, 15_000);
    const channelName = `mobile-radar-ubicaciones-en-vivo-${Date.now()}-${requestGeneration.current}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ubicaciones_usuarios' }, load).subscribe();
    return () => {
      requestGeneration.current += 1;
      stopPolling();
      void supabase.removeChannel(channel);
    };
  }, [load, active]);

  const visibleWorkers = useMemo(() => {
    const value = query.trim().toLocaleLowerCase();
    return value ? workers.filter(worker => worker.profile.nombre.toLocaleLowerCase().includes(value)) : workers;
  }, [query, workers]);

  return (
    <View style={styles.mapWrapper}>
      <LiveFleetMap workers={visibleWorkers} loading={loading} error={error} onRefresh={() => void load()} overlayTop={overlayTop} />
    </View>
  );
});

export const TrackingSurface = React.memo(function TrackingSurface() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const pathname = usePathname();
  const isMapsActive = pathname.includes('maps');
  const [view, setView] = useState<TrackingView>('map');
  const [query, setQuery] = useState('');
  const contentTop = insets.top + 118;

  const tabs = [
    { id: 'map' as const, label: t('tracking.liveMap'), icon: MapPinned },
    { id: 'checks' as const, label: t('tracking.checks'), icon: ClipboardCheck },
    { id: 'history' as const, label: t('tracking.routeHistory'), icon: Route },
  ];

  return <View style={styles.screen}>
    <View style={styles.panel}>
      {view === 'map' ? <FleetMapPanel query={query} overlayTop={contentTop + 6} active={isMapsActive} /> : null}
      {view === 'checks' ? <View style={[styles.contentPanel, { paddingTop: contentTop + 10 }]}><ChecksHistoryContent embedded searchQuery={query} /></View> : null}
      {view === 'history' ? <View style={[styles.mapWrapper, styles.overlayPanel]}><MobileRouteHistory searchQuery={query} overlayTop={contentTop + 6} /></View> : null}
    </View>

    <View style={[styles.topHeader, { paddingTop: insets.top + 6 }]}>
      <View style={styles.headerRow}>
        <View style={styles.searchBox}>
          <Search size={18} color="#667085" />
          <TextInput value={query} onChangeText={setQuery} placeholder={t('tracking.search')} placeholderTextColor="#98A2B3" style={styles.searchInput} returnKeyType="search" />
        </View>
        <NotificationCenter />
        <ProfileNavButton />
      </View>

      <View style={styles.switcher}><EqualSegmentedTabs accessibilityLabel={t('tracking.views')} value={view} tabs={tabs} onChange={setView} /></View>
    </View>
  </View>;
});

/**
 * La escena de Tracking monta el mapa dentro del propio navegador de pestañas.
 *
 * Antes el mapa se renderizaba como capa persistente FUERA del navigator y todas las
 * escenas quedaban translúcidas para dejarle ver el fondo. Como React Navigation
 * mantiene montadas las escenas inactivas (detachInactiveScreens={false}), su
 * contenido se pintaba encima del mapa: era el "logo fantasma" que se veía al
 * entrar por primera vez a Tracking. Renderizando el mapa dentro de su escena,
 * la escena enfocada queda por encima de las inactivas y el fantasma desaparece.
 */
export default function TrackingTab() {
  return <TrackingSurface />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#E9EEF2' },
  panel: { ...StyleSheet.absoluteFill, flex: 1, width: '100%', height: '100%' },
  mapWrapper: { flex: 1, width: '100%', height: '100%' },
  overlayPanel: { ...StyleSheet.absoluteFill },
  contentPanel: { ...StyleSheet.absoluteFill, backgroundColor: '#FFFFFF' },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
    paddingHorizontal: 12,
    gap: 8,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBox: {
    flex: 1,
    height: 40,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
  },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0, fontFamily: 'Outfit_500Medium', fontSize: 13, color: '#1E293B' },
  switcher: {
    marginBottom: 8,
  },
});
