import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type LatLng } from 'react-native-maps';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pause, Play, Route, UserRound, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_MIN_INSET } from '@/constants/NavigationLayout';
import { Colors } from '@/constants/Theme';
import { getFleetMapWorkers, type FleetMapWorker } from '@/lib/fleetMap';
import { useLanguage } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

type HistoryPoint = LatLng & { time: number; accuracy: number; speed: number };

interface Props { searchQuery: string; overlayTop: number }

const INITIAL_REGION = { latitude: 23.0626, longitude: -109.7036, latitudeDelta: 0.18, longitudeDelta: 0.18 };

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CS';
}

function distanceMeters(a: LatLng, b: LatLng) {
  const radius = 6371e3;
  const p1 = a.latitude * Math.PI / 180;
  const p2 = b.latitude * Math.PI / 180;
  const dp = (b.latitude - a.latitude) * Math.PI / 180;
  const dl = (b.longitude - a.longitude) * Math.PI / 180;
  const value = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function stabilize(rows: any[]): HistoryPoint[] {
  const result: HistoryPoint[] = [];
  let anchor: HistoryPoint | null = null;
  for (const row of rows) {
    const point: HistoryPoint = {
      latitude: Number(row.latitud), longitude: Number(row.longitud),
      time: new Date(row.created_at).getTime(), accuracy: Math.min(Math.max(Number(row.precision) || 25, 5), 150),
      speed: Math.max(0, Number(row.velocidad) || 0),
    };
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) || !Number.isFinite(point.time)) continue;
    if (!anchor) { anchor = point; result.push(point); continue; }
    const uncertainty = Math.min(110, Math.max(12, anchor.accuracy, point.accuracy));
    const reliableMovement = point.speed >= 12 ? point.accuracy <= 80 : point.speed >= 2.5 && point.accuracy <= 25;
    if (!reliableMovement && distanceMeters(anchor, point) <= uncertainty) {
      result.push({ ...point, latitude: anchor.latitude, longitude: anchor.longitude });
    } else {
      anchor = point;
      result.push(point);
    }
  }
  return result.filter((point, index) => index === 0 || point.time - result[index - 1].time >= 15_000);
}

function formatTime(time: number, en: boolean) {
  return new Intl.DateTimeFormat(en ? 'en-US' : 'es-MX', { hour: 'numeric', minute: '2-digit' }).format(new Date(time));
}

export function MobileRouteHistory({ searchQuery, overlayTop }: Props) {
  const { language } = useLanguage();
  const [mapReady, setMapReady] = useState(false);
  const en = language === 'en';
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [workers, setWorkers] = useState<FleetMapWorker[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [day, setDay] = useState(() => dateKey(new Date()));
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [cursor, setCursor] = useState(0);

  const filteredWorkers = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return query ? workers.filter(worker => worker.profile.nombre.toLocaleLowerCase().includes(query)) : workers;
  }, [searchQuery, workers]);

  const selectedWorker = useMemo(() => {
    return workers.find(w => w.profile.id === selectedId) || null;
  }, [workers, selectedId]);

  useEffect(() => { void getFleetMapWorkers().then(setWorkers).catch(() => setWorkers([])); }, []);
  useEffect(() => {
    if (filteredWorkers.length && !filteredWorkers.some(worker => worker.profile.id === selectedId)) setSelectedId(filteredWorkers[0].profile.id);
  }, [filteredWorkers, selectedId]);

  const loadHistory = useCallback(async () => {
    if (!selectedId) { setPoints([]); setLoading(false); return; }
    setLoading(true); setPlaying(false); setCursor(0);
    const start = new Date(`${day}T00:00:00`);
    const end = new Date(`${day}T23:59:59.999`);
    const { data } = await supabase.from('historial_ubicaciones').select('latitud,longitud,precision,velocidad,created_at')
      .eq('usuario_id', selectedId).gte('created_at', start.toISOString()).lte('created_at', end.toISOString()).order('created_at');
    setPoints(stabilize(data || []));
    setLoading(false);
  }, [day, selectedId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);
  useEffect(() => {
    if (!playing || points.length < 2) return;
    const timer = setInterval(() => setCursor(current => {
      if (current >= points.length - 1) { setPlaying(false); return current; }
      return current + 1;
    }), 650);
    return () => clearInterval(timer);
  }, [playing, points.length]);
  useEffect(() => {
    if (!mapReady || !points.length) return;
    const unique = points.filter((point, index) => index === 0 || point.latitude !== points[index - 1].latitude || point.longitude !== points[index - 1].longitude);
    const timer = setTimeout(() => {
      try {
        if (unique.length === 1) {
          mapRef.current?.animateCamera({ center: unique[0], zoom: 16 }, { duration: 350 });
        } else {
          mapRef.current?.fitToCoordinates(unique, { animated: true, edgePadding: { top: overlayTop + 130, right: 40, bottom: 170, left: 40 } });
        }
      } catch {}
    }, 200);
    return () => clearTimeout(timer);
  }, [mapReady, overlayTop, points]);

  const moveDay = (offset: number) => {
    const next = new Date(`${day}T12:00:00`); next.setDate(next.getDate() + offset); setDay(dateKey(next));
  };
  const current = points[Math.min(cursor, Math.max(0, points.length - 1))];
  const bottom = Math.max(insets.bottom, BOTTOM_BAR_MIN_INSET) + BOTTOM_BAR_HEIGHT + 12;

  return <View style={styles.container}>
    <MapView
      provider={PROVIDER_GOOGLE}
      ref={mapRef}
      style={styles.map}
      initialRegion={INITIAL_REGION}
      mapType="standard"
      userInterfaceStyle="light"
      toolbarEnabled={false}
      onMapReady={() => setMapReady(true)}
    >
      {points.length > 1 ? <Polyline coordinates={points} strokeColor="#94A3B8" strokeWidth={3} /> : null}
      {cursor > 0 ? <Polyline coordinates={points.slice(0, cursor + 1)} strokeColor={Colors.primary} strokeWidth={5} /> : null}
      {current ? <Marker coordinate={current} anchor={{ x: 0.5, y: 0.5 }}>
        <View style={styles.personMarker}><UserRound size={19} color="#FFFFFF" strokeWidth={2.2} /></View>
      </Marker> : null}
    </MapView>

    <View style={[styles.filters, { top: overlayTop + 8 }]}>
      <View style={styles.topControlsRow}>
        <View style={styles.dateRow}>
          <Pressable onPress={() => moveDay(-1)} style={styles.dateButton} accessibilityLabel={en ? 'Previous day' : 'Día anterior'}>
            <ChevronLeft size={17} color="#343E48" />
          </Pressable>
          <Text style={styles.dateText}>{day}</Text>
          <Pressable disabled={day >= dateKey(new Date())} onPress={() => moveDay(1)} style={styles.dateButton} accessibilityLabel={en ? 'Next day' : 'Día siguiente'}>
            <ChevronRight size={17} color={day >= dateKey(new Date()) ? '#CBD5E1' : '#343E48'} />
          </Pressable>
        </View>

        <Pressable
          onPress={() => setListOpen(prev => !prev)}
          style={[styles.techTrigger, listOpen && styles.techTriggerActive]}
          accessibilityRole="button"
          accessibilityLabel={en ? 'Select technician' : 'Seleccionar técnico'}
        >
          <UserRound size={15} color={listOpen ? '#FFFFFF' : '#f78c26'} strokeWidth={2.4} />
          <Text numberOfLines={1} style={[styles.techTriggerText, listOpen && styles.techTriggerTextActive]}>
            {selectedWorker?.profile?.nombre || (en ? 'Select technician' : 'Seleccionar técnico')}
          </Text>
          {listOpen ? (
            <ChevronUp size={14} color={listOpen ? '#FFFFFF' : '#343E48'} />
          ) : (
            <ChevronDown size={14} color="#343E48" />
          )}
        </Pressable>
      </View>

      {listOpen && (
        <View style={styles.checklistCard}>
          <View style={styles.checklistHeader}>
            <View style={styles.checklistHeaderLeft}>
              <View style={styles.checklistIconCircle}>
                <Users size={14} color="#f78c26" strokeWidth={2.4} />
              </View>
              <Text style={styles.checklistTitle}>{en ? 'Technicians' : 'Técnicos'}</Text>
            </View>
            <View style={styles.checklistBadge}>
              <Text style={styles.checklistBadgeText}>{filteredWorkers.length}</Text>
            </View>
          </View>
          <ScrollView
            nestedScrollEnabled
            style={styles.checklistScroll}
            contentContainerStyle={styles.checklistScrollContent}
            showsVerticalScrollIndicator={filteredWorkers.length > 4}
          >
            {filteredWorkers.map(worker => {
              const isSelected = selectedId === worker.profile.id;
              const name = worker.profile.nombre;
              return (
                <Pressable
                  key={worker.profile.id}
                  onPress={() => {
                    setSelectedId(worker.profile.id);
                    setListOpen(false);
                  }}
                  style={[styles.checklistItem, isSelected && styles.checklistItemActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={[styles.avatarCircle, isSelected && styles.avatarCircleActive]}>
                    <Text style={[styles.avatarLetter, isSelected && styles.avatarLetterActive]}>{initials(name)}</Text>
                  </View>
                  <Text numberOfLines={1} style={[styles.checklistItemText, isSelected && styles.checklistItemTextActive]}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>

    {loading ? <View style={styles.empty}><ActivityIndicator color={Colors.primary} /></View> : !points.length ? <View style={styles.empty}><Route size={24} color={Colors.primary} /><Text style={styles.emptyTitle}>{en ? 'No route recorded' : 'Sin ruta registrada'}</Text><Text style={styles.emptyText}>{en ? 'Choose another technician or date.' : 'Selecciona otro técnico o fecha.'}</Text></View> : null}

    {points.length ? <View style={[styles.playback, { bottom }]}>
      <Pressable onPress={() => { if (cursor >= points.length - 1) setCursor(0); setPlaying(value => !value); }} style={styles.playButton}>{playing ? <Pause size={16} color="#FFFFFF" /> : <Play size={16} color="#FFFFFF" />}</Pressable>
      <Text style={styles.time}>{formatTime(current.time, en)}</Text>
      <View style={styles.track}><View style={[styles.progress, { width: `${points.length < 2 ? 100 : cursor / (points.length - 1) * 100}%` }]} /></View>
      <Text style={styles.time}>{formatTime(points[points.length - 1].time, en)}</Text>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFill, flex: 1, width: '100%', height: '100%', backgroundColor: '#E9EEF2' },
  map: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  filters: { position: 'absolute', left: 12, right: 12, gap: 7, zIndex: 30 },
  topControlsRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dateRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: 'rgba(52,62,72,0.12)', overflow: 'hidden', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  dateButton: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  dateText: { minWidth: 84, fontFamily: 'Outfit_600SemiBold', fontSize: 11.5, color: '#343E48', textAlign: 'center' },
  techTrigger: { flex: 1, height: 36, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.96)', borderWidth: 1, borderColor: 'rgba(52,62,72,0.12)', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
  techTriggerActive: { backgroundColor: '#343E48', borderColor: '#343E48' },
  techTriggerText: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 12, color: '#343E48' },
  techTriggerTextActive: { color: '#FFFFFF' },
  checklistCard: { borderRadius: 14, borderWidth: 1, borderColor: 'rgba(52,62,72,0.12)', backgroundColor: '#FFFFFF', overflow: 'hidden', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 6 },
  checklistHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(52,62,72,0.08)', backgroundColor: '#FAFAFB' },
  checklistHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  checklistIconCircle: { width: 24, height: 24, borderRadius: 6, backgroundColor: 'rgba(247,140,38,0.12)', alignItems: 'center', justifyContent: 'center' },
  checklistTitle: { fontFamily: 'Outfit_700Bold', fontSize: 13, color: '#000000' },
  checklistBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(52,62,72,0.08)' },
  checklistBadgeText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11, color: '#343E48' },
  checklistScroll: { maxHeight: 220 },
  checklistScrollContent: { paddingVertical: 4 },
  checklistItem: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, paddingHorizontal: 14 },
  checklistItemActive: { backgroundColor: '#FFF7ED' },
  avatarCircle: { width: 30, height: 30, borderRadius: 15, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(52,62,72,0.08)' },
  avatarCircleActive: { backgroundColor: 'rgba(247,140,38,0.18)' },
  avatarLetter: { color: '#343E48', fontFamily: 'Outfit_700Bold', fontSize: 11.5 },
  avatarLetterActive: { color: '#f78c26' },
  checklistItemText: { flex: 1, color: '#343E48', fontFamily: 'Outfit_500Medium', fontSize: 13.5 },
  checklistItemTextActive: { color: '#000000', fontFamily: 'Outfit_700Bold' },
  personMarker: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: Colors.primary, elevation: 5 },
  empty: { position: 'absolute', top: '42%', left: 40, right: 40, alignItems: 'center', gap: 6, borderRadius: 16, padding: 18, backgroundColor: 'rgba(255,255,255,0.94)' },
  emptyTitle: { fontFamily: 'Outfit_700Bold', fontSize: 14, color: '#1E293B' },
  emptyText: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: '#64748B' },
  playback: { position: 'absolute', left: 12, right: 12, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, borderRadius: 13, paddingHorizontal: 7, backgroundColor: 'rgba(255,255,255,0.96)', elevation: 5 },
  playButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: Colors.primary },
  time: { width: 47, fontFamily: 'Outfit_600SemiBold', fontSize: 10, color: '#475569', textAlign: 'center' },
  track: { flex: 1, height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: '#CBD5E1' },
  progress: { height: '100%', borderRadius: 2, backgroundColor: Colors.primary },
});
