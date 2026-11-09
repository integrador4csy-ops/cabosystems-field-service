import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import { translateCurrent as translateInterface } from '@/lib/localization';
import { getLocale } from '@/lib/localization';
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { ProfileNavButton } from '@/components/ProfileNavButton';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { afterTabPaint } from '@/lib/tabPreparation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import NetInfo from '@react-native-community/netinfo';
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  Video,
  Sparkles,
  Camera,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { getMyChatGroups, getCachedMyChatGroups } from '@/lib/chatApi';
import { restoreChatRooms, getSavedChatGroups, subscribeChatRooms } from '@/lib/chatRoomCache';
import type { ChatGroup } from '@/types/database';

const LOGO_DARK = require('@/assets/images/Logo-CaboSystems-Field-Service-Dark.png');

function getInitials(name: string): string {
  if (!name) return 'CS';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function formatChatTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(getLocale(), { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return translateInterface("Ayer");
  }

  return date.toLocaleDateString(getLocale(), { month: 'short', day: 'numeric' });
}

type ChatFilter = 'todos' | 'recientes' | 'evidencias';

const LastMessagePreview = React.memo(function LastMessagePreview({ group }: { group: ChatGroup }) {
  const { t: tr } = useInterfaceTranslation();
  const lastMsg = group.ultimo_mensaje;
  if (!lastMsg) {
    return (
      <Text style={styles.emptyMsgText} numberOfLines={1}>{tr("Sin mensajes aún · Toca para abrir")}</Text>
    );
  }

  if (lastMsg.tipo === 'audio' || lastMsg.tipo === 'archivo') return <Text style={styles.lastMsgText} numberOfLines={1}>{lastMsg.tipo === 'audio' ? 'Audio' : lastMsg.media_meta?.fileName || lastMsg.contenido || tr("Documento")}</Text>;

  const sender = lastMsg.profiles?.nombre?.split(' ')[0] || tr("Técnico");

  if (lastMsg.tipo === 'imagen') {
    return (
      <View style={styles.mediaPreviewRow}>
        <Camera size={13} color={Colors.primary} strokeWidth={2.2} />
        <Text style={styles.mediaPreviewText} numberOfLines={1}>
          {sender}{tr(": Foto de evidencia")}</Text>
      </View>
    );
  }

  if (lastMsg.tipo === 'video') {
    return (
      <View style={styles.mediaPreviewRow}>
        <Video size={13} color={Colors.primary} strokeWidth={2.2} />
        <Text style={styles.mediaPreviewText} numberOfLines={1}>
          {sender}{tr(": Video técnico")}</Text>
      </View>
    );
  }

  if (lastMsg.tipo === 'sticker') {
    return (
      <View style={styles.mediaPreviewRow}>
        <Sparkles size={13} color={Colors.primary} strokeWidth={2.2} />
        <Text style={styles.mediaPreviewText} numberOfLines={1}>
          {sender}{tr(": Sticker")}</Text>
      </View>
    );
  }

  return (
    <Text style={styles.lastMsgText} numberOfLines={1}>
      <Text style={styles.lastMsgSender}>{sender}: </Text>
      {lastMsg.contenido}
    </Text>
  );
});

const ChatGroupItem = React.memo(function ChatGroupItem({
  item,
  onPress,
}: {
  item: ChatGroup;
  onPress: (id: string) => void;
}) {
  const { t: tr } = useInterfaceTranslation();
  const lastMsgTime = item.ultimo_mensaje
    ? formatChatTime(item.ultimo_mensaje.created_at)
    : '';

  const isAdminOfGroup = item.mi_rol === 'admin';
  const initials = getInitials(item.nombre);

  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={tr('Abrir chat ') + item.nombre}
      style={({ pressed }) => [styles.groupCard, pressed && styles.groupCardPressed]}
      onPress={handlePress}
    >
      {/* Avatar */}
      <View style={styles.avatarWrapper}>
        {item.foto_url ? (
          <Image
            source={{ uri: item.foto_url }}
            style={styles.avatarImage}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={item.id}
          />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}


      </View>

      {/* Detalles del Grupo */}
      <View style={styles.groupInfo}>
        <View style={styles.groupHeaderRow}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.nombre}
          </Text>
          {!!lastMsgTime && <Text style={styles.timeText}>{lastMsgTime}</Text>}
        </View>

        <View style={styles.lastMessageContainer}><LastMessagePreview group={item} /></View>
        {/* Group attributes */}
        <View style={styles.badgesRow}>
          {item.solo_multimedia ? (
            <View style={styles.multimediaBadge}>
              <Camera size={10.5} color={Colors.primary} strokeWidth={2.2} />
              <Text style={styles.multimediaBadgeText}>{tr("Evidencias")}</Text>
            </View>
          ) : null}

          <View style={styles.membersCountBadge}>
            <Users size={10.5} color={Colors.textSecondary} strokeWidth={2} />
            <Text style={styles.membersCountText}>{item.miembros_count || 1}{tr(" miembros")}</Text>
          </View>

          {isAdminOfGroup && (
            <View style={styles.roleTag}>
              <Text style={styles.roleTagText}>{tr("Admin")}</Text>
            </View>
          )}
        </View>


      </View>

      {/* Indicador flecha derecha */}
      <View style={styles.arrowContainer}>
        <ChevronRight size={17} color={Colors.textDisabled} strokeWidth={2.2} />
      </View>
    </Pressable>
  );
});

export default function ChatTabScreen() {
  const { t: tr } = useInterfaceTranslation();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { profile } = useAuth();
  const cached = profile?.id ? getCachedMyChatGroups(profile.id) : null;
  const [groups, setGroups] = useState<ChatGroup[]>(() => cached ?? []);
  const [loading, setLoading] = useState(() => !cached);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('todos');
  const lastFetchRef = useRef(cached ? Date.now() : 0);
  const listOwner = useRef(profile?.id ?? '');

  useEffect(() => {
    const owner = profile?.id;
    if (listOwner.current !== (owner ?? '')) {
      listOwner.current = owner ?? '';
      const prepared = owner ? getCachedMyChatGroups(owner) : null;
      setGroups(prepared ?? []);
      setLoading(!prepared);
      lastFetchRef.current = prepared ? Date.now() : 0;
    }
    if (!owner) return;
    let active = true;
    void restoreChatRooms(owner).then(() => {
      if (!active || listOwner.current !== owner) return;
      const saved = getSavedChatGroups(owner);
      if (saved.length) { setGroups(previous => previous.length ? previous : saved); setLoading(false); }
    });
    return () => { active = false; };
  }, [profile?.id]);


  useEffect(() => {
    if (!profile?.id) return;
    return subscribeChatRooms(profile.id, () => { setGroups(getSavedChatGroups(profile.id!)); setLoading(false); });
  }, [profile?.id]);

  const isGlobalAdmin =
    profile?.rol === 'admin' ||
    profile?.rol === 'supervisor_instalacion' ||
    profile?.rol === 'aux_operaciones';

  const loadGroups = async () => {
    if (!profile?.id) return;
    const owner = profile.id;
    try {
      const connection = await NetInfo.fetch();
      if (listOwner.current !== owner) return;
      if (connection.isConnected === false || connection.isInternetReachable === false) {
        await restoreChatRooms(profile.id);
        setGroups(getSavedChatGroups(profile.id));
        return;
      }
      const data = await getMyChatGroups(profile.id);
      if (listOwner.current !== owner) return;
      setGroups(data);
      lastFetchRef.current = Date.now();
    } catch (err) {
      console.error('Error loading chat groups:', err);
    } finally {
      if (listOwner.current === owner) { setLoading(false); setRefreshing(false); }
    }
  };

  useFocusEffect(
    useCallback(() => {
      // Idle preparation may finish after this eagerly mounted tab's first render.
      const prepared = profile?.id ? getCachedMyChatGroups(profile.id, 20_000) : null;
      if (prepared) {
        setGroups(prepared);
        setLoading(false);
        return;
      }
      if (Date.now() - lastFetchRef.current > 20000) {
        return afterTabPaint(() => { void loadGroups(); });
      }
    }, [profile?.id])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };

  // Conteo para las cápsulas de filtro
  const stats = useMemo(() => {
    let recientes = 0;
    let evidencias = 0;
    for (const g of groups) {
      if (g.ultimo_mensaje) recientes++;
      if (
        g.solo_multimedia ||
        g.ultimo_mensaje?.tipo === 'imagen' ||
        g.ultimo_mensaje?.tipo === 'video'
      ) {
        evidencias++;
      }
    }
    return {
      todos: groups.length,
      recientes,
      evidencias,
    };
  }, [groups]);

  // Lista filtrada
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      // 1. Filtro por buscador
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = g.nombre.toLowerCase().includes(q);
        const matchesDesc = g.descripcion && g.descripcion.toLowerCase().includes(q);
        const matchesLastMsg =
          g.ultimo_mensaje?.contenido &&
          g.ultimo_mensaje.contenido.toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesLastMsg) {
          return false;
        }
      }

      // 2. Filtro por cápsula activa
      if (filter === 'recientes') {
        return !!g.ultimo_mensaje;
      }
      if (filter === 'evidencias') {
        return (
          g.solo_multimedia ||
          g.ultimo_mensaje?.tipo === 'imagen' ||
          g.ultimo_mensaje?.tipo === 'video'
        );
      }
      return true;
    });
  }, [groups, searchQuery, filter]);

  const handleOpenGroup = useCallback((groupId: string) => {
    router.push(`/chat/${groupId}` as any);
  }, [router]);

  const renderGroupItem = useCallback(
    ({ item }: { item: ChatGroup }) => (
      <ChatGroupItem item={item} onPress={handleOpenGroup} />
    ),
    [handleOpenGroup]
  );

  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* Buscador TailAdmin con Botón Limpiar */}
      <View style={styles.searchContainer}>
        <Search size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          accessibilityLabel={tr("Buscar canal, proyecto o mensaje")}
          placeholder={tr("Buscar canal, proyecto o mensaje...")}
          placeholderTextColor={Colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery('')}
            hitSlop={8}
            style={styles.clearSearchBtn}
          >
            <X size={15} color={Colors.textSecondary} />
          </Pressable>
        )}
      </View>

      {/* Cápsulas de Filtro (Todas visibles sin deslizar, naranja y letras blancas al estar activas) */}
      <View style={styles.filterPillsContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.filterPill,
            filter === 'todos' && styles.filterPillActive,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setFilter('todos')}
        >
          <Text
            style={[
              styles.filterPillText,
              filter === 'todos' && styles.filterPillTextActive,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >{tr("Todos (")}{stats.todos})
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.filterPill,
            filter === 'recientes' && styles.filterPillActive,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setFilter('recientes')}
        >
          <Text
            style={[
              styles.filterPillText,
              filter === 'recientes' && styles.filterPillTextActive,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >{tr("Recientes (")}{stats.recientes})
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.filterPill,
            filter === 'evidencias' && styles.filterPillActive,
            pressed && { opacity: 0.8 },
          ]}
          onPress={() => setFilter('evidencias')}
        >
          <Text
            style={[
              styles.filterPillText,
              filter === 'evidencias' && styles.filterPillTextActive,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >{tr("Evidencias (")}{stats.evidencias})
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderEmptyState = () => {
    if (loading && groups.length === 0) {
      return (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>{tr("Cargando canales del equipo...")}</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <MessageSquare size={30} color={Colors.primary} strokeWidth={2.2} />
        </View>
        <Text style={styles.emptyTitle}>
          {searchQuery ? tr("Sin canales encontrados") : tr("Sin grupos activos")}
        </Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery
            ? tr("No hay canales que coincidan con \"{value0}\". Intenta con otro término.", { value0: searchQuery })
            : filter !== 'todos'
            ? tr("No hay conversaciones activas en esta sección. Cambia de filtro para ver otros grupos.")
            : isGlobalAdmin
            ? tr("Crea un nuevo canal de cuadrilla para coordinar las labores y enviar reportes técnicos.")
            : tr("Tu supervisor te asignará a los canales correspondientes a tus proyectos.")}
        </Text>
        {searchQuery || filter !== 'todos' ? (
          <Pressable
            style={({ pressed }) => [styles.resetFilterBtn, pressed && { opacity: 0.85 }]}
            onPress={() => {
              setSearchQuery('');
              setFilter('todos');
            }}
          >
            <Text style={styles.resetFilterBtnText}>{tr("Ver todos los canales")}</Text>
          </Pressable>
        ) : isGlobalAdmin ? (
          <Pressable
            style={({ pressed }) => [styles.emptyActionBtn, pressed && { opacity: 0.85 }]}
            onPress={() => router.push('/chat/new-group' as any)}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={2.6} />
            <Text style={styles.emptyActionText}>{tr("Crear Primer Canal")}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top Navbar Minimalista con Logo Oficial CSY pegado a la izquierda */}
      <View style={styles.headerWrapper}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={[styles.navContainer, isTablet && styles.navContainerTablet]}>
            <View style={styles.logoGroup}>
              <Image
                source={LOGO_DARK}
                style={[styles.logo, isTablet && styles.logoTablet]}
                contentFit="contain"
                contentPosition="left center"
                priority="high"
              />
            </View>

            {isGlobalAdmin ? (
              <Pressable
                style={({ pressed }) => [styles.newGroupBtn, pressed && { opacity: 0.85 }]}
                onPress={() => router.push('/chat/new-group' as any)}
                accessibilityRole="button"
                accessibilityLabel={tr("Crear nuevo chat")}
                hitSlop={8}
              >
                <Plus size={15} color="#FFFFFF" strokeWidth={2.8} />
                <Text style={styles.newGroupBtnText}>{tr("Nuevo")}</Text>
              </Pressable>
            ) : null}
            <ProfileNavButton />
          </View>
        </SafeAreaView>
      </View>

      {/* Lista de Grupos */}
      <FlatList
        data={filteredGroups}
        keyExtractor={(item) => item.id}
        renderItem={renderGroupItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#FFFFFF',
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF', zIndex: 10,
  },
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  navContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 10,
    paddingRight: Spacing.md,
    height: 72,
    minHeight: 72,
  },
  navContainerTablet: {
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xl,
    height: 78,
    minHeight: 78,
  },
  logoGroup: {
    flex: 1, minWidth: 0, justifyContent: 'center', alignItems: 'flex-start',
    transform: [{ translateY: -3 }],
  },
  logo: {
    width: '100%', maxWidth: 220, height: 54,
  },
  logoTablet: {
    maxWidth: 250,
    height: 60,
  },
  newGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    borderRadius: BorderRadius.sm,
    gap: 5,
    marginRight: 10,
    ...Shadow.xs,
  },
  newGroupBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: Spacing.md, paddingBottom: 110, width: '100%', maxWidth: 960, alignSelf: 'center',
  },
  listHeaderContainer: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 12, borderRadius: 10, height: 44, gap: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: Colors.text,
    fontFamily: 'Outfit_400Regular',
    fontSize: 13.5,
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterPillsContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.xs,
    width: '100%',
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7.5,
    paddingHorizontal: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11.5,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  groupCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 92, paddingVertical: 18,
  },
  groupCardPressed: {
    opacity: 0.55,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 44, height: 44, borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(52,62,72,0.06)', justifyContent: 'center', alignItems: 'center',
  },
  avatarInitials: {
    fontFamily: 'Outfit_600SemiBold', fontSize: 15, color: Colors.brandSlate,
  },
  groupInfo: {
    flex: 1,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  groupName: {
    flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 22, color: '#000000', marginRight: 8,
  },
  timeText: {
    fontFamily: 'Outfit_400Regular', fontSize: 11, color: Colors.brandSlate,
  },
  badgesRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 12, rowGap: 4, marginTop: 6,
  },
  multimediaBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  multimediaBadgeText: {
    fontFamily: 'Outfit_500Medium', fontSize: 11, color: Colors.brandSlate,
  },
  membersCountBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  membersCountText: {
    fontFamily: 'Outfit_400Regular', fontSize: 11, color: Colors.brandSlate,
  },
  roleTag: {
    justifyContent: 'center',
  },
  roleTagText: {
    fontFamily: 'Outfit_400Regular', fontSize: 11, color: Colors.brandSlate,
  },
  lastMessageContainer: {
    marginTop: 3,
  },
  lastMsgText: {
    fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 19, color: Colors.brandSlate,
  },
  lastMsgSender: {
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  emptyMsgText: {
    fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 19, color: Colors.brandSlate,
  },
  mediaPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  mediaPreviewText: {
    flexShrink: 1, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 19, color: Colors.brandSlate,
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 2,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13.5,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: 48, alignItems: 'center', paddingHorizontal: Spacing.lg, marginTop: Spacing.sm,
  },
  emptyIconBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16.5,
    color: Colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 18,
    maxWidth: 290,
  },
  resetFilterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.borderBrand,
  },
  resetFilterBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.primary,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
    gap: 6,
  },
  emptyActionText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
});
