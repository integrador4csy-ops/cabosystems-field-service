import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Location from 'expo-location';
import { ChevronDown, ChevronUp, LocateFixed, MapPin, Navigation } from 'lucide-react-native';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import { BorderRadius, Colors, Spacing } from '@/constants/Theme';
import { getVillaLocations, type VillaLocation } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import {
  distanceBetweenCoordinatesMeters,
  isInsideVillaGeofence,
  villaGeofenceRadius,
} from '@/lib/villaGeofence';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatDistance(distanceMeters: number): string {
  return distanceMeters >= 1000
    ? `${(distanceMeters / 1000).toFixed(1)} km`
    : `${Math.round(distanceMeters)} m`;
}

interface VillaLocationRowProps {
  item: VillaLocation;
  expanded: boolean;
  checking: boolean;
  distanceMeters: number | null;
  onToggle: (id: string) => void;
  onCheck: (id: string) => void;
  onOpenMaps: (id: string) => void;
}

const VillaLocationRow = memo(function VillaLocationRow({
  item,
  expanded,
  checking,
  distanceMeters,
  onToggle,
  onCheck,
  onOpenMaps,
}: VillaLocationRowProps) {
  const { t } = useTranslation();
  const isInside = distanceMeters === null ? null : isInsideVillaGeofence(item, distanceMeters);

  return <View style={[styles.locationRow, expanded && styles.locationRowExpanded]}>
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={`${item.desarrollo}, ${item.villa}`}
      onPress={() => onToggle(item.id)}
      style={({ pressed }) => [styles.rowTrigger, pressed ? styles.rowPressed : null]}
    >
      <View style={styles.pinBox}><MapPin size={20} color={Colors.primary} /></View>
      <View style={styles.villaIdentity}>
        <Text numberOfLines={1} style={styles.villaName}>{item.villa}</Text>
        <Text numberOfLines={1} style={styles.developmentName}>{item.desarrollo}</Text>
      </View>
      <View style={styles.chevronBox}>
        {expanded ? <ChevronUp size={19} color={Colors.brandSlate} /> : <ChevronDown size={19} color={Colors.brandSlate} />}
      </View>
    </Pressable>

    {expanded ? <View style={styles.expandedContent}>
      <View style={styles.geofenceSummary}>
        <View>
          <Text style={styles.summaryLabel}>{t('locations.geofenceRadius')}</Text>
          <Text style={styles.summaryValue}>{villaGeofenceRadius(item)} m</Text>
        </View>
        {distanceMeters !== null ? <View style={styles.distanceBlock}>
          <Text style={styles.summaryLabel}>{t('locations.distance')}</Text>
          <Text style={styles.summaryValue}>{formatDistance(distanceMeters)}</Text>
        </View> : null}
      </View>

      {isInside !== null ? <View style={[styles.statusBox, isInside ? styles.statusInside : styles.statusOutside]}>
        <Text style={[styles.statusTitle, isInside ? styles.statusTitleInside : null]}>
          {isInside ? t('locations.inside') : t('locations.outside')}
        </Text>
        <Text style={[styles.statusText, isInside ? styles.statusTextInside : null]}>
          {isInside ? t('locations.insideHelp') : t('locations.outsideHelp')}
        </Text>
      </View> : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={checking}
          onPress={() => onCheck(item.id)}
          style={({ pressed }) => [styles.secondaryButton, pressed ? styles.buttonPressed : null]}
        >
          {checking ? <ActivityIndicator size="small" color={Colors.brandSlate} /> : <LocateFixed size={18} color={Colors.brandSlate} />}
          <Text style={styles.secondaryButtonText}>{checking ? t('locations.checking') : t('locations.check')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpenMaps(item.id)}
          style={({ pressed }) => [styles.primaryButton, pressed ? styles.buttonPressed : null]}
        >
          <Navigation size={18} color="#FFFFFF" />
          <Text style={styles.primaryButtonText}>{t('locations.openMaps')}</Text>
        </Pressable>
      </View>
    </View> : null}
  </View>;
});
export default function VillaLocationsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [locations, setLocations] = useState<VillaLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [distances, setDistances] = useState<Record<string, number>>({});

  const locationsById = useMemo(() => new Map(locations.map(item => [item.id, item])), [locations]);
  const listContentStyle = useMemo(() => ({
    paddingTop: headerHeight + Spacing.sm,
    paddingBottom: insets.bottom + Spacing.xl,
    paddingHorizontal: Spacing.md,
  }), [headerHeight, insets.bottom]);

  const loadLocations = useCallback(async (manual = false) => {
    manual ? setRefreshing(true) : setLoading(true);
    setLoadError(false);
    try {
      const data = await getVillaLocations();
      setLocations(data);
      setExpandedId(previous => previous && data.some(item => item.id === previous) ? previous : null);
    } catch (error) {
      console.warn('Error loading villa locations:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadLocations(); }, [loadLocations]);

  const toggleLocation = useCallback((id: string) => {
    setExpandedId(previous => previous === id ? null : id);
  }, []);

  const checkGeofence = useCallback(async (id: string) => {
    const villa = locationsById.get(id);
    if (!villa) return;
    try {
      setCheckingId(id);
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(t('locations.permissionTitle'), t('locations.permissionMessage'));
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const distance = distanceBetweenCoordinatesMeters(
        { latitude: current.coords.latitude, longitude: current.coords.longitude },
        { latitude: villa.latitud, longitude: villa.longitud },
      );
      setDistances(previous => ({ ...previous, [id]: distance }));
    } catch {
      Alert.alert(t('locations.errorTitle'), t('locations.locationError'));
    } finally {
      setCheckingId(null);
    }
  }, [locationsById, t]);

  const openDirections = useCallback(async (id: string) => {
    const villa = locationsById.get(id);
    if (!villa) return;
    const destination = `${villa.latitud},${villa.longitud}`;
    const fallbackUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    const nativeUrl = Platform.select({
      ios: `maps://?daddr=${encodeURIComponent(destination)}&dirflg=d`,
      android: `google.navigation:q=${encodeURIComponent(destination)}`,
    });
    try {
      if (nativeUrl && (await Linking.canOpenURL(nativeUrl))) await Linking.openURL(nativeUrl);
      else await Linking.openURL(fallbackUrl);
    } catch {
      Alert.alert(t('locations.errorTitle'), t('locations.mapsError'));
    }
  }, [locationsById, t]);

  const renderLocation = useCallback(({ item }: { item: VillaLocation }) => <VillaLocationRow
    item={item}
    expanded={expandedId === item.id}
    checking={checkingId === item.id}
    distanceMeters={distances[item.id] ?? null}
    onToggle={toggleLocation}
    onCheck={checkGeofence}
    onOpenMaps={openDirections}
  />, [checkingId, checkGeofence, distances, expandedId, openDirections, toggleLocation]);

  return <View style={styles.screen}>
    <HeaderCaboSystems seamless showProjectSelector={false} />
    <FlashList
      data={locations}
      extraData={{ expandedId, checkingId, distances }}
      keyExtractor={item => item.id}
      renderItem={renderLocation}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={listContentStyle}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadLocations(true)} colors={[Colors.primary]} tintColor={Colors.primary} />}
      ListHeaderComponent={<View style={styles.heading}>
        <Text accessibilityRole="header" style={styles.title}>{t('locations.title')}</Text>
        <Text style={styles.subtitle}>{t('locations.subtitle')}</Text>
      </View>}
      ListEmptyComponent={loading ? <View style={styles.centerState}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.stateText}>{t('locations.loading')}</Text>
      </View> : loadError ? <View accessibilityRole="alert" style={styles.centerState}>
        <MapPin size={24} color={Colors.brandSlate} />
        <Text style={styles.stateText}>{t('locations.loadError')}</Text>
        <Pressable accessibilityRole="button" onPress={() => void loadLocations()} style={styles.retryButton}>
          <Text style={styles.retryText}>{t('locations.retry')}</Text>
        </Pressable>
      </View> : <View style={styles.centerState}>
        <MapPin size={24} color={Colors.brandSlate} />
        <Text style={styles.stateText}>{t('locations.noVillas')}</Text>
      </View>}
    />
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  heading: { gap: 4, paddingBottom: Spacing.lg },
  title: { fontFamily: 'Outfit_700Bold', fontSize: 24, lineHeight: 31, color: '#000000' },
  subtitle: { maxWidth: 520, fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20, color: Colors.brandSlate },
  locationRow: { marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(52,62,72,0.14)', borderRadius: BorderRadius.lg, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  locationRowExpanded: { borderColor: 'rgba(247,140,38,0.44)' },
  rowTrigger: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  rowPressed: { backgroundColor: 'rgba(52,62,72,0.04)' },
  pinBox: { width: 44, height: 44, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(247,140,38,0.12)' },
  villaIdentity: { flex: 1, minWidth: 0, gap: 2 },
  villaName: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#000000' },
  developmentName: { fontFamily: 'Outfit_400Regular', fontSize: 12.5, color: Colors.brandSlate },
  chevronBox: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  expandedContent: { gap: Spacing.md, paddingHorizontal: 14, paddingTop: 2, paddingBottom: 14, borderTopWidth: 1, borderColor: 'rgba(52,62,72,0.10)' },
  geofenceSummary: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.md, paddingTop: 14 },
  distanceBlock: { alignItems: 'flex-end' },
  summaryLabel: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: Colors.brandSlate },
  summaryValue: { fontFamily: 'Outfit_700Bold', fontSize: 17, color: '#000000' },
  statusBox: { gap: 3, padding: 12, borderRadius: 12, borderCurve: 'continuous', backgroundColor: 'rgba(52,62,72,0.08)' },
  statusInside: { backgroundColor: '#000000' },
  statusOutside: { borderWidth: 1, borderColor: 'rgba(52,62,72,0.18)' },
  statusTitle: { fontFamily: 'Outfit_700Bold', fontSize: 13, color: Colors.brandSlate },
  statusTitleInside: { color: '#FFFFFF' },
  statusText: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 17, color: Colors.brandSlate },
  statusTextInside: { color: '#FFFFFF' },
  actions: { gap: 9 },
  secondaryButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.brandSlate, borderRadius: 11, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13.5, color: Colors.brandSlate },
  primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 11, borderCurve: 'continuous', backgroundColor: Colors.primary },
  primaryButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 13.5, color: '#FFFFFF' },
  buttonPressed: { opacity: 0.76 },
  centerState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', gap: 10, padding: Spacing.lg },
  stateText: { maxWidth: 280, fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 18, textAlign: 'center', color: Colors.brandSlate },
  retryButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, borderCurve: 'continuous', backgroundColor: Colors.primary },
  retryText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13, color: '#FFFFFF' },
});
