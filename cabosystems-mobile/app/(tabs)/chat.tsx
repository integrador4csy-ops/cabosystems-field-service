import React, { useState, useCallback, useMemo } from 'react';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  Video,
  Shield,
  Sparkles,
  Camera,
  ChevronRight,
  X,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { getMyChatGroups } from '@/lib/chatApi';
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
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) {
    return 'Ayer';
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

type ChatFilter = 'todos' | 'recientes' | 'evidencias';

export default function ChatTabScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;
  const { profile } = useAuth();

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('todos');

  const isGlobalAdmin =
    profile?.rol === 'admin' ||
    profile?.rol === 'supervisor_instalacion' ||
    profile?.rol === 'aux_operaciones';

  const loadGroups = async () => {
    if (!profile?.id) return;
    try {
      const data = await getMyChatGroups(profile.id);
      setGroups(data);
    } catch (err) {
      console.error('Error loading chat groups:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [profile?.id])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadGroups();
  };

  // Conteo para las cápsulas de filtro
  const stats = useMemo(() => {
    const recientes = groups.filter((g) => !!g.ultimo_mensaje).length;
    const evidencias = groups.filter(
      (g) =>
        g.solo_multimedia ||
        g.ultimo_mensaje?.tipo === 'imagen' ||
        g.ultimo_mensaje?.tipo === 'video'
    ).length;
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

  const renderLastMessagePreview = (group: ChatGroup) => {
    const lastMsg = group.ultimo_mensaje;
    if (!lastMsg) {
      return (
        <Text style={styles.emptyMsgText} numberOfLines={1}>
          Sin mensajes aún · Toca para abrir
        </Text>
      );
    }

    const sender = lastMsg.profiles?.nombre?.split(' ')[0] || 'Técnico';

    if (lastMsg.tipo === 'imagen') {
      return (
        <View style={styles.mediaPreviewRow}>
          <Camera size={13} color={Colors.primary} strokeWidth={2.2} />
          <Text style={styles.mediaPreviewText} numberOfLines={1}>
            {sender}: Foto de evidencia
          </Text>
        </View>
      );
    }

    if (lastMsg.tipo === 'video') {
      return (
        <View style={styles.mediaPreviewRow}>
          <Video size={13} color={Colors.primary} strokeWidth={2.2} />
          <Text style={styles.mediaPreviewText} numberOfLines={1}>
            {sender}: Video técnico
          </Text>
        </View>
      );
    }

    if (lastMsg.tipo === 'sticker') {
      return (
        <View style={styles.mediaPreviewRow}>
          <Sparkles size={13} color={Colors.primary} strokeWidth={2.2} />
          <Text style={styles.mediaPreviewText} numberOfLines={1}>
            {sender}: Sticker
          </Text>
        </View>
      );
    }

    return (
      <Text style={styles.lastMsgText} numberOfLines={1}>
        <Text style={styles.lastMsgSender}>{sender}: </Text>
        {lastMsg.contenido}
      </Text>
    );
  };

  const renderGroupItem = ({ item }: { item: ChatGroup }) => {
    const lastMsgTime = item.ultimo_mensaje
      ? formatChatTime(item.ultimo_mensaje.created_at)
      : '';

    const isAdminOfGroup = item.mi_rol === 'admin';
    const initials = getInitials(item.nombre);

    return (
      <Pressable
        style={({ pressed }) => [styles.groupCard, pressed && styles.groupCardPressed]}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      >
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          {item.foto_url ? (
            <Image
              source={{ uri: item.foto_url }}
              style={styles.avatarImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}

          {isAdminOfGroup && (
            <View style={styles.adminMiniBadge}>
              <Shield size={9} color="#FFFFFF" strokeWidth={2.4} />
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

          {/* Badges de Atributos */}
          <View style={styles.badgesRow}>
            {item.solo_multimedia ? (
              <View style={styles.multimediaBadge}>
                <Camera size={10.5} color={Colors.primary} strokeWidth={2.2} />
                <Text style={styles.multimediaBadgeText}>Evidencias</Text>
              </View>
            ) : null}

            <View style={styles.membersCountBadge}>
              <Users size={10.5} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={styles.membersCountText}>{item.miembros_count || 1} miembros</Text>
            </View>

            {isAdminOfGroup && (
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>Admin</Text>
              </View>
            )}
          </View>

          {/* Vista previa último mensaje */}
          <View style={styles.lastMessageContainer}>
            {renderLastMessagePreview(item)}
          </View>
        </View>

        {/* Indicador flecha derecha */}
        <View style={styles.arrowContainer}>
          <ChevronRight size={17} color={Colors.textDisabled} strokeWidth={2.2} />
        </View>
      </Pressable>
    );
  };

  const renderListHeader = () => (
    <View style={styles.listHeaderContainer}>
      {/* Título de la Sección */}
      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Canales de Comunicación</Text>
        <Text style={styles.sectionSubtitle}>
            Coordinación técnica y reportes de cuadrilla 
        </Text>
      </View>

      {/* Buscador TailAdmin con Botón Limpiar */}
      <View style={styles.searchContainer}>
        <Search size={16} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar canal, proyecto o mensaje..."
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
          >
            Todos ({stats.todos})
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
          >
            Recientes ({stats.recientes})
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
          >
            Evidencias ({stats.evidencias})
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconBox}>
        <MessageSquare size={30} color={Colors.primary} strokeWidth={2.2} />
      </View>
      <Text style={styles.emptyTitle}>
        {searchQuery ? 'Sin canales encontrados' : 'Sin grupos activos'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery
          ? `No hay canales que coincidan con "${searchQuery}". Intenta con otro término.`
          : filter !== 'todos'
          ? 'No hay conversaciones activas en esta sección. Cambia de filtro para ver otros grupos.'
          : isGlobalAdmin
          ? 'Crea un nuevo canal de cuadrilla para coordinar las labores y enviar reportes técnicos.'
          : 'Tu supervisor te asignará a los canales correspondientes a tus proyectos.'}
      </Text>
      {searchQuery || filter !== 'todos' ? (
        <Pressable
          style={({ pressed }) => [styles.resetFilterBtn, pressed && { opacity: 0.85 }]}
          onPress={() => {
            setSearchQuery('');
            setFilter('todos');
          }}
        >
          <Text style={styles.resetFilterBtnText}>Ver todos los canales</Text>
        </Pressable>
      ) : isGlobalAdmin ? (
        <Pressable
          style={({ pressed }) => [styles.emptyActionBtn, pressed && { opacity: 0.85 }]}
          onPress={() => router.push('/chat/new-group' as any)}
        >
          <Plus size={15} color="#FFFFFF" strokeWidth={2.6} />
          <Text style={styles.emptyActionText}>Crear Primer Canal</Text>
        </Pressable>
      ) : null}
    </View>
  );

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
                hitSlop={8}
              >
                <Plus size={15} color="#FFFFFF" strokeWidth={2.8} />
                <Text style={styles.newGroupBtnText}>Nuevo Chat</Text>
              </Pressable>
            ) : (
              <View style={styles.channelBadge}>
                <MessageSquare size={13} color={Colors.primary} strokeWidth={2.4} />
                <Text style={styles.channelBadgeText}>Canales CSY</Text>
              </View>
            )}
          </View>
        </SafeAreaView>
      </View>

      {/* Lista de Grupos */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando canales del equipo...</Text>
        </View>
      ) : (
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.xs,
    zIndex: 10,
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
    justifyContent: 'center',
    alignItems: 'flex-start',
    transform: [{ translateY: -3 }],
  },
  logo: {
    width: 220,
    height: 54,
  },
  logoTablet: {
    width: 250,
    height: 60,
  },
  newGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 13,
    paddingVertical: 7.5,
    borderRadius: BorderRadius.full,
    gap: 5,
    ...Shadow.xs,
  },
  newGroupBtnText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  channelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 11,
    paddingVertical: 6.5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderBrand,
    gap: 5,
  },
  channelBadgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.primaryDark,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 110,
    gap: Spacing.sm,
  },
  listHeaderContainer: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  sectionHeading: {
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 21,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    borderRadius: BorderRadius.lg,
    height: 44,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    ...Shadow.xs,
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
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: 13,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
    alignItems: 'center',
    ...Shadow.xs,
  },
  groupCardPressed: {
    backgroundColor: '#FDF8F3',
    borderColor: Colors.borderBrand,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFF7ED',
    borderWidth: 1.2,
    borderColor: '#FED7AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 17,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  adminMiniBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    padding: 3.5,
    borderWidth: 2,
    borderColor: '#FFFFFF',
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
    flex: 1,
    fontFamily: 'Outfit_700Bold',
    fontSize: 15,
    color: Colors.text,
    marginRight: 8,
  },
  timeText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: Colors.textMuted,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  multimediaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 0.8,
    borderColor: Colors.borderBrand,
  },
  multimediaBadgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10,
    color: Colors.primaryDark,
  },
  membersCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  membersCountText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 10,
    color: Colors.textSecondary,
  },
  roleTag: {
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 5,
  },
  roleTagText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 9.5,
    color: Colors.textSecondary,
  },
  lastMessageContainer: {
    marginTop: 1,
  },
  lastMsgText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12.5,
    color: Colors.textSecondary,
  },
  lastMsgSender: {
    fontFamily: 'Outfit_600SemiBold',
    color: Colors.text,
  },
  emptyMsgText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  mediaPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
  },
  mediaPreviewText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: Colors.primary,
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
    paddingVertical: 48,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.sm,
    ...Shadow.xs,
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
