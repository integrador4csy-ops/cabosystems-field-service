import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import {
  Search,
  Plus,
  MessageSquare,
  Users,
  Video,
  Shield,
  Clock,
  Sparkles,
  Camera,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { getMyChatGroups } from '@/lib/chatApi';
import type { ChatGroup } from '@/types/database';

export default function ChatTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isGlobalAdmin =
    profile?.rol === 'admin' || profile?.rol === 'supervisor_instalacion';

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

  const filteredGroups = groups.filter((g) => {
    const q = searchQuery.toLowerCase();
    return (
      g.nombre.toLowerCase().includes(q) ||
      (g.descripcion && g.descripcion.toLowerCase().includes(q))
    );
  });

  const renderLastMessagePreview = (group: ChatGroup) => {
    const lastMsg = group.ultimo_mensaje;
    if (!lastMsg) {
      return (
        <Text style={styles.emptyMsgText} numberOfLines={1}>
          Sin mensajes aún · ¡Comienza la conversación!
        </Text>
      );
    }

    const sender = lastMsg.profiles?.nombre?.split(' ')[0] || 'Técnico';

    if (lastMsg.tipo === 'imagen') {
      return (
        <View style={styles.mediaPreviewRow}>
          <Camera size={13} color={Colors.primary} />
          <Text style={styles.mediaPreviewText} numberOfLines={1}>
            {sender}: Foto de evidencia
          </Text>
        </View>
      );
    }

    if (lastMsg.tipo === 'video') {
      return (
        <View style={styles.mediaPreviewRow}>
          <Video size={13} color={Colors.primary} />
          <Text style={styles.mediaPreviewText} numberOfLines={1}>
            {sender}: Video técnico
          </Text>
        </View>
      );
    }

    if (lastMsg.tipo === 'sticker') {
      return (
        <View style={styles.mediaPreviewRow}>
          <Sparkles size={13} color={Colors.primary} />
          <Text style={styles.mediaPreviewText} numberOfLines={1}>
            {sender}: Sticker de WhatsApp
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
      ? new Date(item.ultimo_mensaje.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';

    const isAdminOfGroup = item.mi_rol === 'admin';

    return (
      <Pressable
        style={({ pressed }) => [styles.groupCard, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`/chat/${item.id}` as any)}
      >
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          {item.foto_url ? (
            <Image source={{ uri: item.foto_url }} style={styles.avatarImage} contentFit="cover" />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarLetter}>
                {item.nombre.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          {isAdminOfGroup && (
            <View style={styles.adminMiniBadge}>
              <Shield size={10} color="#ffffff" />
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

          {/* Badges de atributos */}
          <View style={styles.badgesRow}>
            {item.solo_multimedia && (
              <View style={styles.multimediaBadge}>
                <Video size={10} color={Colors.primary} />
                <Text style={styles.multimediaBadgeText}>Solo Multimedia</Text>
              </View>
            )}
            <View style={styles.membersCountBadge}>
              <Users size={10} color={Colors.textSecondary} />
              <Text style={styles.membersCountText}>{item.miembros_count} miembros</Text>
            </View>
          </View>

          {/* Vista previa último mensaje */}
          <View style={styles.lastMessageContainer}>
            {renderLastMessagePreview(item)}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header Glass CSY */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <View style={styles.titleGroup}>
            <Text style={styles.headerTitle}>GRUPOS DE TRABAJO</Text>
            <Text style={styles.headerSubtitle}>
              {groups.length} {groups.length === 1 ? 'grupo' : 'grupos'} activos
            </Text>
          </View>

          {/* Botón de crear grupo (Solo admins) */}
          {isGlobalAdmin && (
            <Pressable
              style={({ pressed }) => [styles.newGroupBtn, pressed && { opacity: 0.8 }]}
              onPress={() => router.push('/chat/new-group' as any)}
            >
              <Plus size={16} color="#ffffff" strokeWidth={3} />
              <Text style={styles.newGroupBtnText}>Crear</Text>
            </Pressable>
          )}
        </View>

        {/* Buscador */}
        <View style={styles.searchContainer}>
          <Search size={15} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar grupo o proyecto..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Lista de Grupos */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Cargando chats del equipo...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredGroups}
          keyExtractor={(item) => item.id}
          renderItem={renderGroupItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <MessageSquare size={42} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'Sin resultados' : 'Sin grupos asignados'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'No se encontraron grupos que coincidan con tu búsqueda.'
                  : isGlobalAdmin
                  ? 'Crea un nuevo grupo de trabajo e invita a los técnicos con el botón superior.'
                  : 'Tu supervisor te agregará a los grupos correspondientes a tu área de instalación.'}
              </Text>
              {isGlobalAdmin && !searchQuery && (
                <Pressable
                  style={({ pressed }) => [styles.emptyActionBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => router.push('/chat/new-group' as any)}
                >
                  <Plus size={16} color="#ffffff" strokeWidth={2.5} />
                  <Text style={styles.emptyActionText}>Crear Primer Grupo</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundAlt,
  },
  headerWrapper: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingBottom: Spacing.sm,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  headerContent: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  titleGroup: {
    gap: 2,
  },
  headerTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: Colors.textWhite,
    letterSpacing: 1.5,
  },
  headerSubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.70)',
  },
  newGroupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  newGroupBtnText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: '#ffffff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: Spacing.md,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    height: 40,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: Colors.textWhite,
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
  },
  listContent: {
    padding: Spacing.md,
    gap: 10,
    paddingBottom: 100,
  },
  groupCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
    gap: 12,
    alignItems: 'center',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: Colors.primary,
  },
  adminMiniBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    padding: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  groupInfo: {
    flex: 1,
  },
  groupHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  groupName: {
    flex: 1,
    fontFamily: 'Montserrat_700Bold',
    fontSize: 14,
    color: Colors.text,
    marginRight: 8,
  },
  timeText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 10,
    color: Colors.textMuted,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  multimediaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(247, 140, 38, 0.10)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.8,
    borderColor: 'rgba(247, 140, 38, 0.3)',
  },
  multimediaBadgeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 9,
    color: Colors.primary,
  },
  membersCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(52, 62, 72, 0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  membersCountText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 9,
    color: Colors.textSecondary,
  },
  lastMessageContainer: {
    marginTop: 2,
  },
  lastMsgText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  lastMsgSender: {
    fontFamily: 'Montserrat_600SemiBold',
    color: Colors.text,
  },
  emptyMsgText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  mediaPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  mediaPreviewText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },
  centerLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(52, 62, 72, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: 8,
  },
  emptyActionText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 13,
    color: '#ffffff',
  },
});
