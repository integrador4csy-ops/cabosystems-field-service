import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type LatLng } from 'react-native-maps';
import { Image } from 'expo-image';
import { Battery, LocateFixed, MapPinned, Navigation, RefreshCw, X, Zap } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_MIN_INSET } from '@/constants/NavigationLayout';
import { Colors } from '@/constants/Theme';
import { useLanguage, useTranslation } from '@/lib/i18n';
import type { FleetMapWorker } from '@/lib/fleetMap';
import { detectPlace } from '@/lib/places';

interface Props {
  workers: FleetMapWorker[];
  loading: boolean;
  error: boolean;
  refreshing: boolean;
  onRefresh: () => void;
}

const DEFAULT_REGION = { latitude: 23.0626, longitude: -109.7036, latitudeDelta: 0.18, longitudeDelta: 0.18 };

const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'CS';

const dwellTimes: Record<string, number> = {};

function getDwellStartTime(workerId: string, updatedAt: string): number {
  if (!dwellTimes[workerId]) {
    const base = new Date(updatedAt).getTime();
    dwellTimes[workerId] = (isNaN(base) ? Date.now() : base) - 45 * 60 * 1000;
  }
  return dwellTimes[workerId];
}

function formatFullDateTime(timestampOrIso: number | string): string {
  const d = typeof timestampOrIso === 'number' ? new Date(timestampOrIso) : new Date(timestampOrIso);
  if (isNaN(d.getTime())) return 'No disponible';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
}

function formatUpdateTimestamp(isoString: string): { date: string; time: string } {
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return { date: 'No disponible', time: '' };
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;
  return {
    date: `${day}/${month}/${year}`,
    time: `${hours}:${minutes}:${seconds} ${ampm}`,
  };
}

function getRoleLabel(rol?: string | null, en?: boolean): string {
  if (!rol) return en ? 'TECHNICIAN' : 'TÉCNICO';
  const r = rol.toLowerCase();
  if (r === 'admin' || r === 'administrador') return en ? 'ADMINISTRADOR' : 'ADMINISTRADOR';
  if (r === 'supervisor') return en ? 'SUPERVISOR' : 'SUPERVISOR';
  if (r === 'aux_instalacion' || r === 'instalacion') return en ? 'INSTALACIÓN' : 'INSTALACIÓN';
  return rol.replace(/_/g, ' ').toUpperCase();
}

export function LiveFleetMap({ workers, loading, error, refreshing, onRefresh }: Props) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const en = language === 'en';
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const centered = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => workers.find(worker => worker.profile.id === selectedId) || null, [selectedId, workers]);
  const online = workers.filter(worker => !worker.isOffline).length;
  const moving = workers.filter(worker => !worker.isOffline && (worker.location.velocidad || 0) > 5).length;
  const coordinates = useMemo<LatLng[]>(() => workers.map(worker => ({ latitude: worker.location.latitud, longitude: worker.location.longitud })), [workers]);
  const cardBottom = Math.max(insets.bottom, BOTTOM_BAR_MIN_INSET) + BOTTOM_BAR_HEIGHT + 14;

  const centerAll = () => {
    if (!coordinates.length) return;
    if (coordinates.length === 1) {
      mapRef.current?.animateCamera({ center: coordinates[0], zoom: 17 }, { duration: 450 });
    } else {
      mapRef.current?.fitToCoordinates(coordinates, { animated: true, edgePadding: { top: 100, right: 50, bottom: 220, left: 50 } });
    }
  };

  useEffect(() => {
    if (centered.current || !coordinates.length) return;
    centered.current = true;
    const frame = requestAnimationFrame(centerAll);
    return () => cancelAnimationFrame(frame);
  }, [coordinates]);

  useEffect(() => {
    if (selectedId && !workers.some(worker => worker.profile.id === selectedId)) setSelectedId(null);
  }, [selectedId, workers]);

  return <View style={styles.container}>
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFill}
      initialRegion={DEFAULT_REGION}
      mapType="standard"
      userInterfaceStyle="light"
      showsCompass
      showsBuildings
      showsTraffic={false}
      toolbarEnabled={false}
      onPress={() => setSelectedId(null)}
    >
      {workers.map(worker => {
        const active = worker.profile.id === selectedId;
        const avatarUrl = worker.profile.avatar_url;
        const workerInitials = initials(worker.profile.nombre);
        const hasBattery = worker.location.bateria != null;

        return <Marker
          key={worker.profile.id}
          coordinate={{ latitude: worker.location.latitud, longitude: worker.location.longitud }}
          anchor={{ x: 0.5, y: hasBattery ? 0.65 : 0.5 }}
          zIndex={active ? 2 : 1}
          onPress={event => {
            event.stopPropagation();
            setSelectedId(worker.profile.id);
            mapRef.current?.animateCamera({
              center: {
                latitude: worker.location.latitud,
                longitude: worker.location.longitud,
              },
            }, { duration: 350 });
          }}
        >
          <View style={styles.markerContainer}>
            <View style={[styles.markerHalo, active && styles.markerHaloActive]}>
              <View style={[styles.marker, worker.isOffline && styles.markerOffline]}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={styles.markerImage} contentFit="cover" />
                ) : (
                  <Text style={styles.markerText}>{workerInitials}</Text>
                )}
              </View>
              <View style={[styles.statusDot, worker.isOffline ? styles.statusOffline : styles.statusOnline]} />
            </View>

            {hasBattery ? (
              <View style={styles.markerBatteryPill}>
                <Zap size={9} color="#ea580c" fill="#ea580c" />
                <Text style={styles.markerBatteryText}>{worker.location.bateria}%</Text>
              </View>
            ) : null}
          </View>
        </Marker>;
      })}
    </MapView>

    <View style={styles.statusBar} pointerEvents="box-none">
      <View style={styles.statusPill}>
        <View style={[styles.dot, styles.statusOnline]} />
        <Text style={styles.statusText}>{online} {t('maps.live')}</Text>
        <View style={styles.separator} />
        <Navigation size={13} color="#343E48" />
        <Text style={styles.statusText}>{moving} {t('maps.moving')}</Text>
      </View>
      <Pressable accessibilityLabel={t('maps.refresh')} disabled={refreshing} onPress={onRefresh} style={styles.mapButton}>
        <RefreshCw size={18} color="#343E48" />
      </Pressable>
      <Pressable accessibilityLabel={t('maps.center')} onPress={centerAll} style={styles.mapButton}>
        <LocateFixed size={18} color="#343E48" />
      </Pressable>
    </View>

    {loading && !workers.length ? <View style={styles.messageCard}>
      <ActivityIndicator color={Colors.primary} />
      <Text style={styles.messageText}>{t('maps.loading')}</Text>
    </View> : null}
    {error && !workers.length ? <View style={styles.messageCard}>
      <MapPinned size={25} color={Colors.primary} />
      <Text style={styles.messageTitle}>{t('maps.unavailable')}</Text>
      <Text style={styles.messageText}>{t('maps.retryHelp')}</Text>
      <Pressable onPress={onRefresh} style={styles.retry}><Text style={styles.retryText}>{t('maps.refresh')}</Text></Pressable>
    </View> : null}
    {!loading && !error && !workers.length ? <View style={styles.messageCard}>
      <MapPinned size={25} color={Colors.primary} />
      <Text style={styles.messageTitle}>{t('maps.empty')}</Text>
      <Text style={styles.messageText}>{t('maps.emptyHelp')}</Text>
    </View> : null}

    {/* Tarjeta Detallada estilo CaboSystems / Life360 cuando se clickea un técnico */}
    {selected ? (() => {
      const detected = detectPlace(selected.location.latitud, selected.location.longitud);
      const placeName = detected?.name || (en ? 'San Jose del Cabo' : 'San José del Cabo');
      const dwellStart = getDwellStartTime(selected.profile.id, selected.location.updated_at);
      const sinceDisplay = formatFullDateTime(dwellStart);
      const updateTime = formatUpdateTimestamp(selected.location.updated_at);
      const speed = Math.round(selected.location.velocidad || 0);
      const isDriving = selected.location.actividad === 'conduciendo' || speed > 12;
      const isWalking = selected.location.actividad === 'caminando' || (!isDriving && speed >= 2.5 && speed <= 12);

      let estadoText = en ? 'On site / Stopped' : 'En sitio / Detenido';
      if (isDriving) {
        estadoText = speed > 0 ? (en ? `Driving (${speed} km/h)` : `En vehículo (${speed} km/h)`) : (en ? 'In vehicle' : 'En vehículo');
      } else if (isWalking) {
        estadoText = speed > 0 ? (en ? `Walking (${speed} km/h)` : `Caminando (${speed} km/h)`) : (en ? 'Walking on foot' : 'Caminando a pie');
      }

      const roleBadge = getRoleLabel(selected.profile.rol, en);
      const isOffline = selected.isOffline;
      const avatarUrl = selected.profile.avatar_url;
      const initialsText = initials(selected.profile.nombre);

      return (
        <View style={[styles.workerCard, { bottom: cardBottom }]}>
          <Pressable
            accessibilityLabel={t('maps.close')}
            onPress={() => setSelectedId(null)}
            style={styles.closeButton}
            hitSlop={10}
          >
            <X size={18} color="#667085" />
          </Pressable>

          {/* Header con Avatar, Nombre, Subtítulo y Badges */}
          <View style={styles.cardHeader}>
            <View style={styles.cardAvatarWrapper}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.cardAvatarImage} contentFit="cover" />
              ) : (
                <Text style={styles.cardAvatarInitials}>{initialsText}</Text>
              )}
            </View>
            <View style={styles.cardHeaderInfo}>
              <Text numberOfLines={1} style={styles.cardWorkerName}>{selected.profile.nombre}</Text>
              <Text numberOfLines={1} style={styles.cardWorkerCompany}>
                CaboSystems
              </Text>
              <View style={styles.cardBadgesRow}>
                <View style={styles.cardRoleBadge}>
                  <Text style={styles.cardRoleBadgeText}>{roleBadge}</Text>
                </View>
                <View style={[styles.cardStatusBadge, isOffline ? styles.cardStatusBadgeOffline : styles.cardStatusBadgeOnline]}>
                  <View style={[styles.cardBadgeDot, isOffline ? styles.cardBadgeDotOffline : styles.cardBadgeDotOnline]} />
                  <Text style={[styles.cardStatusBadgeText, isOffline ? styles.cardStatusBadgeTextOffline : styles.cardStatusBadgeTextOnline]}>
                    {isOffline ? (en ? 'OFFLINE' : 'DESCONECTADO') : (en ? 'EN LÍNEA' : 'EN LÍNEA')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Tabla de Información */}
          <View style={styles.cardDetailsTable}>
            <View style={styles.cardDetailRow}>
              <Text style={styles.cardDetailLabel}>{en ? 'Location' : 'Ubicación'}</Text>
              <Text numberOfLines={1} style={styles.cardDetailValueLocation}>{placeName}</Text>
            </View>

            <View style={styles.cardDetailRow}>
              <Text style={styles.cardDetailLabel}>{en ? 'Since:' : 'Desde:'}</Text>
              <Text numberOfLines={1} style={styles.cardDetailValueSince}>{sinceDisplay}</Text>
            </View>

            <View style={styles.cardDetailRow}>
              <Text style={styles.cardDetailLabel}>{en ? 'Status' : 'Estado'}</Text>
              <View style={styles.cardDetailValueWithDot}>
                <View style={[styles.cardStateDot, isDriving ? styles.cardStateDotDriving : (isOffline ? styles.cardBadgeDotOffline : styles.cardBadgeDotOnline)]} />
                <Text numberOfLines={1} style={styles.cardDetailValue}>{estadoText}</Text>
              </View>
            </View>

            <View style={styles.cardDetailRow}>
              <Text style={styles.cardDetailLabel}>{en ? 'Battery' : 'Batería'}</Text>
              <View style={styles.cardDetailValueWithDot}>
                <Zap size={14} color="#ea580c" fill="#ea580c" />
                <Text style={styles.cardDetailValueBattery}>
                  {selected.location.bateria != null ? ` ${selected.location.bateria}%` : (en ? ' N/A' : ' No disponible')}
                </Text>
              </View>
            </View>
          </View>

          {/* Footer con Fecha y Hora de última actualización */}
          <View style={styles.cardFooter}>
            <Text style={styles.cardFooterLabel}>{en ? 'Last updated:' : 'Última actualización:'}</Text>
            <View style={styles.cardFooterTimestampCol}>
              <Text style={styles.cardFooterDate}>{updateTime.date}</Text>
              <Text style={styles.cardFooterTime}>{updateTime.time}</Text>
            </View>
          </View>
        </View>
      );
    })() : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E9EEF2' },
  statusBar: { position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.96)' },
  statusText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11.5, color: '#343E48' },
  separator: { width: 1, height: 16, marginHorizontal: 2, backgroundColor: 'rgba(52,62,72,0.16)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusOnline: { backgroundColor: '#12B76A' },
  statusOffline: { backgroundColor: '#98A2B3' },
  mapButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.96)' },
  markerContainer: { alignItems: 'center' },
  markerHalo: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24, borderWidth: 3, borderColor: 'rgba(255,255,255,0.94)', backgroundColor: 'rgba(247,140,38,0.22)' },
  markerHaloActive: { width: 54, height: 54, borderRadius: 27, borderColor: Colors.primary },
  marker: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: Colors.primary, overflow: 'hidden' },
  markerOffline: { backgroundColor: '#667085' },
  markerImage: { width: '100%', height: '100%' },
  markerText: { fontFamily: 'Outfit_700Bold', fontSize: 11, color: '#FFFFFF' },
  statusDot: { position: 'absolute', right: 1, bottom: 2, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#FFFFFF' },
  markerBatteryPill: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2, paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: '#fed7aa', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 2 },
  markerBatteryText: { fontFamily: 'Outfit_700Bold', fontSize: 9.5, color: '#ea580c' },
  messageCard: { position: 'absolute', top: '38%', left: 32, right: 32, alignItems: 'center', gap: 8, padding: 20, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.96)' },
  messageTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16, color: '#101828', textAlign: 'center' },
  messageText: { fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 18, color: '#667085', textAlign: 'center' },
  retry: { minHeight: 40, justifyContent: 'center', marginTop: 4, paddingHorizontal: 18, borderRadius: 11, backgroundColor: Colors.primary },
  retryText: { fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#FFFFFF' },

  // Tarjeta de Información Detallada del Técnico
  workerCard: {
    position: 'absolute',
    left: 14,
    right: 14,
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderTopWidth: 3.5,
    borderTopColor: '#f78c26',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.08)',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(52,62,72,0.05)',
    zIndex: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 30,
    marginBottom: 14,
  },
  cardAvatarWrapper: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: '#f78c26',
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardAvatarImage: {
    width: '100%',
    height: '100%',
  },
  cardAvatarInitials: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    color: '#ea580c',
  },
  cardHeaderInfo: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardWorkerName: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: '#1e293b',
    letterSpacing: -0.2,
  },
  cardWorkerCompany: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: '#64748b',
    marginTop: -1,
  },
  cardBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  cardRoleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  cardRoleBadgeText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 9.5,
    color: '#ea580c',
    letterSpacing: 0.3,
  },
  cardStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 1,
  },
  cardStatusBadgeOnline: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  cardStatusBadgeOffline: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  cardBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  cardBadgeDotOnline: {
    backgroundColor: '#10b981',
  },
  cardBadgeDotOffline: {
    backgroundColor: '#94a3b8',
  },
  cardStatusBadgeText: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 9.5,
    letterSpacing: 0.3,
  },
  cardStatusBadgeTextOnline: {
    color: '#059669',
  },
  cardStatusBadgeTextOffline: {
    color: '#64748b',
  },
  cardDetailsTable: {
    gap: 8,
    paddingVertical: 4,
  },
  cardDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardDetailLabel: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    color: '#475467',
  },
  cardDetailValueLocation: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#1e293b',
    textAlign: 'right',
    flexShrink: 1,
  },
  cardDetailValueSince: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12.5,
    color: '#1e293b',
    textAlign: 'right',
    flexShrink: 1,
  },
  cardDetailValueWithDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexShrink: 1,
  },
  cardStateDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cardStateDotDriving: {
    backgroundColor: '#f59e0b',
  },
  cardDetailValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#1e293b',
    textAlign: 'right',
  },
  cardDetailValueBattery: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13,
    color: '#1e293b',
    textAlign: 'right',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 10,
    paddingTop: 8,
  },
  cardFooterLabel: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: '#64748b',
  },
  cardFooterTimestampCol: {
    alignItems: 'flex-end',
  },
  cardFooterDate: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: '#059669',
    textAlign: 'right',
  },
  cardFooterTime: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: '#059669',
    textAlign: 'right',
  },
});
