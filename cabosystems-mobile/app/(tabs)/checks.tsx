import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LogIn, LogOut, RefreshCw, Users, X } from 'lucide-react-native';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import { BOTTOM_BAR_HEIGHT, BOTTOM_BAR_MIN_INSET } from '@/constants/NavigationLayout';
import { useAuth } from '@/lib/auth';
import { useLanguage, useTranslation } from '@/lib/i18n';
import { getAdminCheckHistory, type AdminCheckHistoryItem } from '@/lib/api';

interface TechnicianGroup {
  technician_id: string;
  technician_name: string;
  technician_avatar_url: string | null;
  items: AdminCheckHistoryItem[];
}

const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const moveDay = (date: Date, amount: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12);

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'CS';
}

const CheckCard = React.memo(function CheckCard({
  item,
  onPhoto,
  en,
}: {
  item: AdminCheckHistoryItem;
  onPhoto: (item: AdminCheckHistoryItem) => void;
  en: boolean;
}) {
  const isOut = item.check_type === 'check_out';
  const time = new Date(item.checked_at).toLocaleTimeString(en ? 'en-US' : 'es-MX', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={styles.checkCard}>
      <Pressable accessibilityRole="imagebutton" onPress={() => onPhoto(item)} style={styles.photoButton}>
        <Image source={{ uri: item.photo_url }} style={styles.photo} contentFit="cover" transition={150} />
      </Pressable>
      <View style={styles.checkBody}>
        <View style={styles.checkHeading}>
          <View style={[styles.typeIcon, isOut && styles.typeIconOut]}>
            {isOut ? <LogOut size={16} color="#FFFFFF" /> : <LogIn size={16} color="#FFFFFF" />}
          </View>
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

export function ChecksHistoryContent({
  embedded = false,
  searchQuery = '',
}: {
  embedded?: boolean;
  searchQuery?: string;
}) {
  const { profile } = useAuth();
  const { t: tr } = useTranslation();
  const { language } = useLanguage();
  const en = language === 'en';
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [day, setDay] = useState(() => new Date());
  const [items, setItems] = useState<AdminCheckHistoryItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoItem, setPhotoItem] = useState<AdminCheckHistoryItem | null>(null);
  const isAdmin = profile?.rol === 'admin' || profile?.rol === 'supervisor_instalacion' || profile?.rol === 'aux_operaciones';

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError('');
    try {
      setItems(await getAdminCheckHistory(dayKey(day)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr('No se pudo cargar el historial de checks.'));
    } finally {
      setLoading(false);
    }
  }, [day, isAdmin, tr]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const people = useMemo(() => {
    const map = new Map<string, { id: string; name: string; avatar: string | null }>();
    for (const item of items) {
      map.set(item.technician_id, {
        id: item.technician_id,
        name: item.technician_name,
        avatar: item.technician_avatar_url,
      });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  useEffect(() => {
    if (selectedUser && !people.some((person) => person.id === selectedUser)) {
      setSelectedUser(null);
    }
    setSelectedUserIds((prev) => prev.filter((id) => people.some((p) => p.id === id)));
  }, [people, selectedUser]);

  const toggleSelectAll = useCallback(() => {
    setSelectedUser(null);
    setSelectedUserIds([]);
  }, []);

  const toggleTechnicianSelection = useCallback((id: string) => {
    setSelectedUser((prev) => (prev === id ? null : id));
    setSelectedUserIds((prev) => (prev.includes(id) && prev.length === 1 ? [] : [id]));
  }, []);

  const groups = useMemo<TechnicianGroup[]>(() => {
    let visible = items;
    if (selectedUser) {
      visible = visible.filter((item) => item.technician_id === selectedUser);
    } else if (selectedUserIds.length > 0 && selectedUserIds.length < people.length) {
      visible = visible.filter((item) => selectedUserIds.includes(item.technician_id));
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      visible = visible.filter((item) =>
        item.technician_name.toLowerCase().includes(q) ||
        item.villa.toLowerCase().includes(q) ||
        item.development.toLowerCase().includes(q)
      );
    }
    const groups = new Map<string, TechnicianGroup>();
    for (const item of visible) {
      let entry = groups.get(item.technician_id);
      if (!entry) {
        entry = {
          technician_id: item.technician_id,
          technician_name: item.technician_name,
          technician_avatar_url: item.technician_avatar_url,
          items: [],
        };
        groups.set(item.technician_id, entry);
      }
      entry.items.push(item);
    }
    return [...groups.values()].sort((a, b) => a.technician_name.localeCompare(b.technician_name));
  }, [items, selectedUser, selectedUserIds, searchQuery, people.length]);

  const totalChecks = useMemo(() => groups.reduce((acc, g) => acc + g.items.length, 0), [groups]);

  const toggleTechnician = useCallback((id: string) => {
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const allExpanded = useMemo(() => {
    return groups.length > 0 && groups.every((g) => Boolean(expandedMap[g.technician_id]));
  }, [groups, expandedMap]);

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedMap({});
    } else {
      const next: Record<string, boolean> = {};
      for (const g of groups) next[g.technician_id] = true;
      setExpandedMap(next);
    }
  }, [allExpanded, groups]);

  const dateLabel = dayKey(day) === dayKey(new Date())
    ? tr('Hoy')
    : day.toLocaleDateString(en ? 'en-US' : 'es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const contentBottom = Math.max(insets.bottom, BOTTOM_BAR_MIN_INSET) + BOTTOM_BAR_HEIGHT + 28;

  if (!isAdmin) {
    return (
      <View style={styles.centerFull}>
        <Text style={styles.emptyTitle}>{tr('Acceso administrativo requerido')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {!embedded ? (
        <View style={{ height: headerHeight }}>
          <HeaderCaboSystems seamless showProjectSelector={false} />
        </View>
      ) : null}

      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={[styles.mainScrollContent, { paddingBottom: contentBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {!embedded ? (
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{tr('Historial de checks')}</Text>
            <Text style={styles.subtitle}>{tr('Evidencias de check-in y check-out por técnico y día.')}</Text>
          </View>
        ) : null}

        <View style={styles.filterBarContainer}>
          <View style={styles.filterBar}>
            {/* 1. Date navigator */}
            <View style={styles.filterDateGroup}>
              <Pressable
                accessibilityLabel={tr('Día anterior')}
                style={styles.filterDateBtn}
                onPress={() => setDay((current) => moveDay(current, -1))}
              >
                <ChevronLeft size={16} color="#343E48" />
              </Pressable>
              <Text style={styles.filterDateText} numberOfLines={1}>{dateLabel}</Text>
              <Pressable
                accessibilityLabel={tr('Día siguiente')}
                disabled={dayKey(day) === dayKey(new Date())}
                style={[styles.filterDateBtn, dayKey(day) === dayKey(new Date()) && styles.disabled]}
                onPress={() => setDay((current) => moveDay(current, 1))}
              >
                <ChevronRight size={16} color="#343E48" />
              </Pressable>
            </View>

            <View style={styles.filterSeparator} />

            {/* 2. Technicians dropdown trigger */}
            {people.length ? (
              <Pressable
                onPress={() => setChecklistExpanded((prev) => !prev)}
                style={styles.filterTechBtn}
                accessibilityRole="button"
                accessibilityLabel={tr('Filtrar por técnico')}
              >
                <Users size={13} color="#f78c26" strokeWidth={2.4} />
                <Text style={styles.filterTechText} numberOfLines={1}>
                  {selectedUser
                    ? (people.find((p) => p.id === selectedUser)?.name.split(' ')[0] || tr('Técnico'))
                    : selectedUserIds.length > 0 && selectedUserIds.length < people.length
                    ? `${selectedUserIds.length}/${people.length}`
                    : `${tr('Todos')} (${people.length})`}
                </Text>
                {checklistExpanded ? (
                  <ChevronUp size={14} color="#64748B" />
                ) : (
                  <ChevronDown size={14} color="#64748B" />
                )}
              </Pressable>
            ) : null}

            {people.length ? <View style={styles.filterSeparator} /> : null}

            {/* 3. Refresh button */}
            <Pressable
              accessibilityLabel={tr('Actualizar')}
              style={styles.filterRefreshBtn}
              onPress={() => void load()}
            >
              <RefreshCw size={14} color="#f78c26" />
            </Pressable>
          </View>

          {/* Technicians dropdown list if expanded */}
          {people.length && checklistExpanded ? (
            <View style={styles.dropdownCard}>
              <Pressable
                onPress={() => {
                  toggleSelectAll();
                  setChecklistExpanded(false);
                }}
                style={[
                  styles.checklistItem,
                  !selectedUser && styles.checklistItemActive,
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.checklistAvatar, !selectedUser && styles.checklistAvatarActive]}>
                  <Users size={14} color={!selectedUser ? '#f78c26' : '#343E48'} />
                </View>
                <Text style={[
                  styles.checklistItemTextBold,
                  !selectedUser && styles.checklistItemTextBoldActive,
                ]}>
                  {tr('Todos los técnicos')} ({people.length})
                </Text>
              </Pressable>

              <View style={styles.checklistDivider} />

              <ScrollView
                nestedScrollEnabled
                style={styles.checklistScroll}
                contentContainerStyle={styles.checklistScrollContent}
                showsVerticalScrollIndicator={people.length > 5}
              >
                {people.map((person) => {
                  const isSelected = selectedUser === person.id;
                  return (
                    <Pressable
                      key={person.id}
                      onPress={() => {
                        toggleTechnicianSelection(person.id);
                        setChecklistExpanded(false);
                      }}
                      style={[
                        styles.checklistItem,
                        isSelected && styles.checklistItemActive,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <View style={[styles.checklistAvatar, isSelected && styles.checklistAvatarActive]}>
                        {person.avatar ? (
                          <Image source={{ uri: person.avatar }} style={styles.checklistAvatarImg} contentFit="cover" />
                        ) : (
                          <Text style={[styles.checklistAvatarText, isSelected && styles.checklistAvatarTextActive]}>
                            {initials(person.name)}
                          </Text>
                        )}
                      </View>
                      <Text numberOfLines={1} style={[styles.checklistItemText, isSelected && styles.checklistItemTextActive]}>
                        {person.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>

        {loading && !groups.length ? (
          <View style={{ paddingVertical: 48 }} />
        ) : error ? (
          <View style={styles.centerMessage}>
            <Text style={styles.emptyTitle}>{tr('No se pudo cargar')}</Text>
            <Text style={styles.emptyText}>{error}</Text>
            <Pressable style={styles.retry} onPress={() => void load()}>
              <Text style={styles.retryText}>{tr('Reintentar')}</Text>
            </Pressable>
          </View>
        ) : !groups.length ? (
          <View style={styles.centerMessage}>
            <Text style={styles.emptyTitle}>{tr('Sin checks este día')}</Text>
            <Text style={styles.emptyText}>{tr('Cuando un técnico registre una entrada o salida aparecerá aquí con su evidencia.')}</Text>
          </View>
        ) : (
          <View style={styles.groupsContainer}>
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>
                {groups.length} {groups.length === 1 ? tr('técnico') : tr('técnicos')} · {totalChecks} {totalChecks === 1 ? tr('registro') : tr('registros')}
              </Text>
              {groups.length > 1 ? (
                <Pressable onPress={toggleAll} hitSlop={8}>
                  <Text style={styles.toggleAllText}>
                    {allExpanded ? tr('Colapsar todos') : tr('Desplegar todos')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {groups.map((group) => {
              const isExpanded = Boolean(expandedMap[group.technician_id]);
              return (
                <View key={group.technician_id} style={styles.technicianCard}>
                  <Pressable
                    onPress={() => toggleTechnician(group.technician_id)}
                    style={styles.accordionHeader}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                  >
                    <View style={styles.avatar}>
                      {group.technician_avatar_url ? (
                        <Image source={{ uri: group.technician_avatar_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
                      ) : (
                        <Text style={styles.avatarText}>{group.technician_name.slice(0, 2).toUpperCase()}</Text>
                      )}
                    </View>
                    <View style={styles.personText}>
                      <Text style={styles.personName} numberOfLines={1}>{group.technician_name}</Text>
                      <Text style={styles.personCount}>
                        {group.items.length} {group.items.length === 1 ? tr('registro') : tr('registros')}
                      </Text>
                    </View>
                    <View style={styles.accordionChevron}>
                      {isExpanded ? <ChevronUp size={18} color="#343E48" /> : <ChevronDown size={18} color="#343E48" />}
                    </View>
                  </Pressable>

                  {isExpanded ? (
                    <View style={styles.accordionContent}>
                      {group.items.map((item) => (
                        <CheckCard key={item.id} item={item} onPhoto={setPhotoItem} en={en} />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <Modal visible={Boolean(photoItem)} animationType="fade" transparent onRequestClose={() => setPhotoItem(null)}>
        <View style={styles.photoOverlay}>
          <Pressable accessibilityLabel={tr('Cerrar')} style={styles.photoClose} onPress={() => setPhotoItem(null)}>
            <X size={24} color="#FFFFFF" />
          </Pressable>
          {photoItem ? <Image source={{ uri: photoItem.photo_url }} style={styles.fullPhoto} contentFit="contain" /> : null}
          {photoItem ? (
            <Text style={styles.photoCaption}>
              {photoItem.technician_name} · {photoItem.villa} · {new Date(photoItem.checked_at).toLocaleString(en ? 'en-US' : 'es-MX')}
            </Text>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

export default function ChecksHistoryScreen() {
  return <ChecksHistoryContent />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    paddingTop: 4,
  },
  titleBlock: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  titleBlockEmbedded: {
    paddingTop: 10,
    paddingBottom: 8,
  },
  title: {
    color: '#000000',
    fontFamily: 'Outfit_700Bold',
    fontSize: 25,
    lineHeight: 32,
  },
  subtitle: {
    color: 'rgba(52,62,72,0.76)',
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  filterBarContainer: {
    marginHorizontal: 14,
    marginBottom: 6,
  },
  filterBar: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.12)',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    paddingHorizontal: 4,
  },
  filterDateGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  filterDateBtn: {
    width: 26,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  filterDateText: {
    minWidth: 54,
    textAlign: 'center',
    color: '#1E293B',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  filterSeparator: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(52,62,72,0.10)',
    marginHorizontal: 2,
  },
  filterTechBtn: {
    flex: 1,
    minWidth: 0,
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderRadius: 7,
  },
  filterTechText: {
    flex: 1,
    color: '#1E293B',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
  },
  filterRefreshBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 7,
  },
  dropdownCard: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.12)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  disabled: {
    opacity: 0.35,
  },
  checklistBody: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(52,62,72,0.08)',
    backgroundColor: '#FAFAFB',
  },
  checklistScroll: {
    maxHeight: 220,
  },
  checklistScrollContent: {
    paddingVertical: 4,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  checklistItemActive: {
    backgroundColor: '#FFF7ED',
  },
  checklistAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,62,72,0.08)',
  },
  checklistAvatarActive: {
    backgroundColor: 'rgba(247,140,38,0.18)',
  },
  checklistAvatarImg: {
    width: '100%',
    height: '100%',
  },
  checklistAvatarText: {
    color: '#343E48',
    fontFamily: 'Outfit_700Bold',
    fontSize: 11.5,
  },
  checklistAvatarTextActive: {
    color: '#f78c26',
  },
  checklistItemText: {
    flex: 1,
    color: '#343E48',
    fontFamily: 'Outfit_500Medium',
    fontSize: 13.5,
  },
  checklistItemTextActive: {
    color: '#000000',
    fontFamily: 'Outfit_700Bold',
  },
  checklistItemTextBold: {
    flex: 1,
    color: '#343E48',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13.5,
  },
  checklistItemTextBoldActive: {
    color: '#000000',
    fontFamily: 'Outfit_700Bold',
  },
  checklistDivider: {
    height: 1,
    backgroundColor: 'rgba(52,62,72,0.08)',
    marginHorizontal: 14,
  },
  groupsContainer: {
    marginTop: 6,
  },
  summaryBar: {
    marginHorizontal: 14,
    marginTop: 4,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryText: {
    color: 'rgba(52,62,72,0.65)',
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
  },
  toggleAllText: {
    color: '#f78c26',
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
  },
  technicianCard: {
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.10)',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 2,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  avatar: {
    width: 36,
    height: 36,
    overflow: 'hidden',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(247,140,38,0.16)',
  },
  avatarText: {
    color: '#343e48',
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
  },
  personText: {
    flex: 1,
    marginLeft: 10,
  },
  personName: {
    color: '#1E293B',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  personCount: {
    color: 'rgba(52,62,72,0.65)',
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    marginTop: 1,
  },
  accordionChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,62,72,0.05)',
    marginLeft: 6,
  },
  accordionContent: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(52,62,72,0.08)',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 2,
    backgroundColor: '#F8FAFC',
  },
  checkCard: {
    flexDirection: 'row',
    marginBottom: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(52,62,72,0.10)',
    backgroundColor: '#FFFFFF',
  },
  photoButton: {
    width: 96,
    height: 106,
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: 'rgba(52,62,72,0.07)',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  checkBody: {
    flex: 1,
    paddingLeft: 12,
  },
  checkHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f78c26',
  },
  typeIconOut: {
    backgroundColor: '#343e48',
  },
  checkType: {
    color: '#000000',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
  },
  checkTime: {
    color: 'rgba(52,62,72,0.68)',
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
  },
  villa: {
    color: '#343e48',
    fontFamily: 'Outfit_700Bold',
    fontSize: 14,
    marginTop: 8,
  },
  development: {
    color: 'rgba(52,62,72,0.68)',
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
  },
  comments: {
    color: 'rgba(52,62,72,0.8)',
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  centerFull: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  centerLoading: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerMessage: {
    paddingVertical: 40,
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: {
    color: '#000000',
    fontFamily: 'Outfit_700Bold',
    fontSize: 18,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(52,62,72,0.72)',
    fontFamily: 'Outfit_400Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  retry: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#f78c26',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryText: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
  },
  photoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },
  photoClose: {
    position: 'absolute',
    zIndex: 2,
    top: 54,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,62,72,0.86)',
  },
  fullPhoto: {
    width: '100%',
    height: '78%',
  },
  photoCaption: {
    color: '#FFFFFF',
    fontFamily: 'Outfit_500Medium',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
  },
});
