import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight, LogIn, LogOut, RefreshCw, X } from 'lucide-react-native';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_MIN_INSET } from '@/constants/NavigationLayout';
import { useAuth } from '@/lib/auth';
import { useLanguage, useTranslation } from '@/lib/i18n';
import { getAdminCheckHistory, type AdminCheckHistoryItem } from '@/lib/api';

type HistoryRow =
  | { kind: 'person'; key: string; userId: string; name: string; avatar: string | null; count: number }
  | { kind: 'check'; key: string; item: AdminCheckHistoryItem };

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const moveDay = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);

const PersonHeader = React.memo(function PersonHeader({ row }: { row: Extract<HistoryRow, { kind: 'person' }> }) {
  return (
    <View style={styles.personHeader}>
      <View style={styles.avatar}>
        {row.avatar ? <Image source={{ uri: row.avatar }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={styles.avatarText}>{row.name.slice(0, 2).toUpperCase()}</Text>}
      </View>
      <View style={styles.personText}>
        <Text style={styles.personName}>{row.name}</Text>
        <Text style={styles.personCount}>{row.count} {row.count === 1 ? 'registro' : 'registros'}</Text>
      </View>
    </View>
  );
});

const CheckCard = React.memo(function CheckCard({ item, onPhoto, en }: { item: AdminCheckHistoryItem; onPhoto: (item: AdminCheckHistoryItem) => void; en: boolean }) {
  const isOut = item.check_type === 'check_out';
  const time = new Date(item.checked_at).toLocaleTimeString(en ? 'en-US' : 'es-MX', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={styles.checkCard}>
      <Pressable accessibilityRole="imagebutton" onPress={() => onPhoto(item)} style={styles.photoButton}>
        <Image source={{ uri: item.photo_url }} style={styles.photo} contentFit="cover" transition={150} />
      </Pressable>
      <View style={styles.checkBody}>
        <View style={styles.checkHeading}>
          <View style={[styles.typeIcon, isOut && styles.typeIconOut]}>{isOut ? <LogOut size={17} color="#FFFFFF" /> : <LogIn size={17} color="#FFFFFF" />}</View>
          <View style={{ flex: 1 }}>
            <Text style={styles.checkType}>{isOut ? 'Check-out' : 'Check-in'}</Text>
            <Text style={styles.checkTime}>{time}</Text>
          </View>
        </View>
        <Text style={styles.villa} numberOfLines={1}>{item.villa}</Text>
        <Text style={styles.development} numberOfLines={1}>{item.development}</Text>
        {item.comments ? <Text style={styles.comments} numberOfLines={2}>{item.comments}</Text> : null}
      </View>
    </View>
  );
});

export function ChecksHistoryContent({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const { t: tr } = useTranslation();
  const { language } = useLanguage();
  const en = language === 'en';
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [day, setDay] = useState(() => new Date());
  const [items, setItems] = useState<AdminCheckHistoryItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoItem, setPhotoItem] = useState<AdminCheckHistoryItem | null>(null);
  const isAdmin = profile?.rol === 'admin' || profile?.rol === 'supervisor_instalacion' || profile?.rol === 'aux_operaciones';

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true); setError('');
    try { setItems(await getAdminCheckHistory(dayKey(day))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : tr('No se pudo cargar el historial de checks.')); }
    finally { setLoading(false); }
  }, [day, isAdmin, tr]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const people = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar: string | null }>();
    for (const item of items) map.set(item.technician_id, { id: item.technician_id, name: item.technician_name, avatar: item.technician_avatar_url });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  useEffect(() => {
    if (selectedUser && !people.some((person) => person.id === selectedUser)) setSelectedUser(null);
  }, [people, selectedUser]);

  const rows = useMemo<HistoryRow[]>(() => {
    const visible = selectedUser ? items.filter((item) => item.technician_id === selectedUser) : items;
    const groups = new Map<string, AdminCheckHistoryItem[]>();
    for (const item of visible) {
      const group = groups.get(item.technician_id) || [];
      group.push(item); groups.set(item.technician_id, group);
    }
    const result: HistoryRow[] = [];
    for (const group of groups.values()) {
      const first = group[0];
      result.push({ kind: 'person', key: `person-${first.technician_id}`, userId: first.technician_id, name: first.technician_name, avatar: first.technician_avatar_url, count: group.length });
      for (const item of group) result.push({ kind: 'check', key: item.id, item });
    }
    return result;
  }, [items, selectedUser]);

  const dateLabel = dayKey(day) === dayKey(new Date()) ? tr('Hoy') : day.toLocaleDateString(en ? 'en-US' : 'es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const contentBottom = Math.max(insets.bottom, BOTTOM_BAR_MIN_INSET) + BOTTOM_BAR_HEIGHT + 24;

  if (!isAdmin) return <View style={styles.center}><Text style={styles.emptyTitle}>{tr('Acceso administrativo requerido')}</Text></View>;

  return (
    <View style={styles.screen}>
      {!embedded ? <View style={{ height: headerHeight }}><HeaderCaboSystems showProjectSelector={false} /></View> : null}
      <View style={styles.titleBlock}>
        <Text style={styles.title}>{tr('Historial de checks')}</Text>
        <Text style={styles.subtitle}>{tr('Evidencias de check-in y check-out por técnico y día.')}</Text>
      </View>
      <View style={styles.dateBar}>
        <Pressable accessibilityLabel={tr('Día anterior')} style={styles.dateArrow} onPress={() => setDay((current) => moveDay(current, -1))}><ChevronLeft size={21} color="#343e48" /></Pressable>
        <Text style={styles.dateText}>{dateLabel}</Text>
        <Pressable accessibilityLabel={tr('Día siguiente')} disabled={dayKey(day) === dayKey(new Date())} style={[styles.dateArrow, dayKey(day) === dayKey(new Date()) && styles.disabled]} onPress={() => setDay((current) => moveDay(current, 1))}><ChevronRight size={21} color="#343e48" /></Pressable>
        <Pressable accessibilityLabel={tr('Actualizar')} style={styles.refresh} onPress={() => void load()}><RefreshCw size={19} color="#FFFFFF" /></Pressable>
      </View>
      {people.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleFilters}>
        <Pressable onPress={() => setSelectedUser(null)} style={[styles.filterChip, !selectedUser && styles.filterChipActive]}><Text style={[styles.filterText, !selectedUser && styles.filterTextActive]}>{tr('Todos')}</Text></Pressable>
        {people.map((person) => <Pressable key={person.id} onPress={() => setSelectedUser(person.id)} style={[styles.filterChip, selectedUser === person.id && styles.filterChipActive]}><Text style={[styles.filterText, selectedUser === person.id && styles.filterTextActive]}>{person.name}</Text></Pressable>)}
      </ScrollView> : null}
      {loading ? <View style={styles.center}><ActivityIndicator color="#f78c26" /></View> : error ? <View style={styles.center}><Text style={styles.emptyTitle}>{tr('No se pudo cargar')}</Text><Text style={styles.emptyText}>{error}</Text><Pressable style={styles.retry} onPress={() => void load()}><Text style={styles.retryText}>{tr('Reintentar')}</Text></Pressable></View> : !rows.length ? <View style={styles.center}><Text style={styles.emptyTitle}>{tr('Sin checks este día')}</Text><Text style={styles.emptyText}>{tr('Cuando un técnico registre una entrada o salida aparecerá aquí con su evidencia.')}</Text></View> :
        <FlashList data={rows} keyExtractor={(row) => row.key} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: contentBottom }} renderItem={({ item }) => item.kind === 'person' ? <PersonHeader row={item} /> : <CheckCard item={item.item} onPhoto={setPhotoItem} en={en} />} />}
      <Modal visible={Boolean(photoItem)} animationType="fade" transparent onRequestClose={() => setPhotoItem(null)}>
        <View style={styles.photoOverlay}>
          <Pressable accessibilityLabel={tr('Cerrar')} style={styles.photoClose} onPress={() => setPhotoItem(null)}><X size={24} color="#FFFFFF" /></Pressable>
          {photoItem ? <Image source={{ uri: photoItem.photo_url }} style={styles.fullPhoto} contentFit="contain" /> : null}
          {photoItem ? <Text style={styles.photoCaption}>{photoItem.technician_name} · {photoItem.villa} · {new Date(photoItem.checked_at).toLocaleString(en ? 'en-US' : 'es-MX')}</Text> : null}
        </View>
      </Modal>
    </View>
  );
}

export default function ChecksHistoryScreen() {
  return <ChecksHistoryContent />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  titleBlock: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { color: '#000000', fontFamily: 'Outfit_700Bold', fontSize: 27, lineHeight: 34 },
  subtitle: { color: 'rgba(52,62,72,0.76)', fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 21, marginTop: 2 },
  dateBar: { marginHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 7, borderRadius: 16, backgroundColor: 'rgba(52,62,72,0.06)' },
  dateArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFFFFF' },
  dateText: { flex: 1, color: '#000000', fontFamily: 'Outfit_700Bold', fontSize: 15, textAlign: 'center', textTransform: 'capitalize' },
  refresh: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#f78c26' },
  disabled: { opacity: 0.35 },
  peopleFilters: { paddingHorizontal: 18, paddingVertical: 12, gap: 8 },
  filterChip: { height: 38, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 19, borderWidth: 1, borderColor: 'rgba(52,62,72,0.18)', backgroundColor: '#FFFFFF' },
  filterChipActive: { backgroundColor: '#343e48', borderColor: '#343e48' },
  filterText: { color: '#343e48', fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  filterTextActive: { color: '#FFFFFF' },
  personHeader: { flexDirection: 'row', alignItems: 'center', paddingTop: 16, paddingBottom: 9 },
  avatar: { width: 42, height: 42, overflow: 'hidden', borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(247,140,38,0.16)' },
  avatarText: { color: '#343e48', fontFamily: 'Outfit_700Bold', fontSize: 13 },
  personText: { flex: 1, marginLeft: 11 },
  personName: { color: '#000000', fontFamily: 'Outfit_700Bold', fontSize: 17 },
  personCount: { color: 'rgba(52,62,72,0.65)', fontFamily: 'Outfit_400Regular', fontSize: 13 },
  checkCard: { flexDirection: 'row', marginBottom: 10, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(52,62,72,0.12)', backgroundColor: '#FFFFFF' },
  photoButton: { width: 106, height: 116, overflow: 'hidden', borderRadius: 12, backgroundColor: 'rgba(52,62,72,0.07)' },
  photo: { width: '100%', height: '100%' },
  checkBody: { flex: 1, paddingLeft: 12 },
  checkHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typeIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f78c26' },
  typeIconOut: { backgroundColor: '#343e48' },
  checkType: { color: '#000000', fontFamily: 'Outfit_700Bold', fontSize: 15 },
  checkTime: { color: 'rgba(52,62,72,0.68)', fontFamily: 'Outfit_500Medium', fontSize: 12 },
  villa: { color: '#343e48', fontFamily: 'Outfit_700Bold', fontSize: 15, marginTop: 10 },
  development: { color: 'rgba(52,62,72,0.68)', fontFamily: 'Outfit_400Regular', fontSize: 13 },
  comments: { color: 'rgba(52,62,72,0.8)', fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 16, marginTop: 5 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 8 },
  emptyTitle: { color: '#000000', fontFamily: 'Outfit_700Bold', fontSize: 19, textAlign: 'center' },
  emptyText: { color: 'rgba(52,62,72,0.72)', fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 21, textAlign: 'center' },
  retry: { marginTop: 8, borderRadius: 12, backgroundColor: '#f78c26', paddingHorizontal: 20, paddingVertical: 12 },
  retryText: { color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 15 },
  photoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.94)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  photoClose: { position: 'absolute', zIndex: 2, top: 54, right: 20, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(52,62,72,0.86)' },
  fullPhoto: { width: '100%', height: '78%' },
  photoCaption: { color: '#FFFFFF', fontFamily: 'Outfit_500Medium', fontSize: 14, textAlign: 'center', marginTop: 12 },
});
