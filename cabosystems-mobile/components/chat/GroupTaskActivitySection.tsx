import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import {
  CheckSquare,
  CheckCircle2,
  Play,
  Clock,
  RotateCcw,
  Camera,
  RefreshCw,
} from 'lucide-react-native';
import { Colors, ChatPalette as P } from '@/constants/Theme';
import { useTranslation, useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import {
  getChatGroupTaskActivity,
  type ChatGroupTaskActivityItem,
} from '@/lib/chatApi';

const PAGE_SIZE = 15;

export function GroupTaskActivitySection({
  groupId,
  onImage,
}: {
  groupId: string;
  onImage?: (url: string) => void;
}) {
  const { t: tr } = useInterfaceTranslation();
  const { language } = useTranslation();
  const [items, setItems] = useState<ChatGroupTaskActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getChatGroupTaskActivity(groupId, PAGE_SIZE, 0);
      setItems(data);
      setOffset(data.length);
      setHasMore(data.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error loading mobile group task activity:', err);
      setError(tr('Error al cargar las tareas realizadas.'));
    } finally {
      setLoading(false);
    }
  }, [groupId, tr]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const nextData = await getChatGroupTaskActivity(groupId, PAGE_SIZE, offset);
      setItems((prev) => [...prev, ...nextData]);
      setOffset((prev) => prev + nextData.length);
      setHasMore(nextData.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more task activity on mobile:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const renderBadge = (item: ChatGroupTaskActivityItem) => {
    if (item.accion === 'subtarea') {
      if (item.siguiente === 'true') {
        return (
          <View style={[styles.badge, styles.badgeSuccess]}>
            <CheckCircle2 size={11} color="#059669" />
            <Text style={[styles.badgeText, styles.badgeSuccessText]}>
              {tr('Subtarea completada')}
            </Text>
          </View>
        );
      }
      return (
        <View style={[styles.badge, styles.badgeWarning]}>
          <RotateCcw size={11} color="#D97706" />
          <Text style={[styles.badgeText, styles.badgeWarningText]}>
            {tr('Subtarea reabierta')}
          </Text>
        </View>
      );
    }

    if (item.siguiente === 'completada') {
      return (
        <View style={[styles.badge, styles.badgeSuccess]}>
          <CheckCircle2 size={11} color="#059669" />
          <Text style={[styles.badgeText, styles.badgeSuccessText]}>
            {tr('Completada')}
          </Text>
        </View>
      );
    }
    if (item.siguiente === 'en_proceso') {
      return (
        <View style={[styles.badge, styles.badgePrimary]}>
          <Play size={10} color={P.accent} />
          <Text style={[styles.badgeText, styles.badgePrimaryText]}>
            {tr('En Proceso')}
          </Text>
        </View>
      );
    }
    return (
      <View style={[styles.badge, styles.badgeNeutral]}>
        <Clock size={11} color="#64748B" />
        <Text style={[styles.badgeText, styles.badgeNeutralText]}>
          {tr('Pendiente')}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <CheckSquare size={16} color={Colors.primary} />
          <Text style={styles.title}>
            {tr('Tareas realizadas')} ({items.length})
          </Text>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            onPress={loadInitial}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && { opacity: 0.8 },
            ]}
          >
            <RefreshCw size={12} color="#DC2626" />
            <Text style={styles.retryText}>{tr('Reintentar')}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <Text style={styles.emptyText}>
          {tr('No hay tareas ni avances registrados en esta villa.')}
        </Text>
      ) : (
        <View style={styles.list}>
          {items.map((item) => {
            const timeStr = new Date(item.captured_at).toLocaleTimeString(
              language === 'es' ? 'es-MX' : 'en-US',
              { hour: '2-digit', minute: '2-digit' }
            );
            const dateStr = new Date(item.captured_at).toLocaleDateString(
              language === 'es' ? 'es-MX' : 'en-US',
              { day: 'numeric', month: 'short' }
            );

            return (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <View style={styles.itemHeaderLeft}>
                    <Text style={styles.taskTitle} numberOfLines={1}>
                      {item.tarea_titulo}
                    </Text>
                    {renderBadge(item)}
                  </View>
                  <Text style={styles.timeText}>{timeStr}</Text>
                </View>

                {item.subtarea_titulo ? (
                  <Text style={styles.subtaskTitle} numberOfLines={1}>
                    {item.subtarea_titulo}
                  </Text>
                ) : null}

                {/* Actor & Date */}
                <Text style={styles.actorMeta}>
                  {item.actor_name} · {dateStr}
                </Text>

                {/* Optional Comment */}
                {item.comentario ? (
                  <View style={styles.commentBox}>
                    <Text style={styles.commentText}>“{item.comentario}”</Text>
                  </View>
                ) : null}

                {/* Optional Evidence Photo */}
                {item.evidence_url ? (
                  <Pressable
                    onPress={() => onImage?.(item.evidence_url!)}
                    style={({ pressed }) => [
                      styles.evidenceButton,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Image
                      source={{ uri: item.evidence_url }}
                      style={styles.evidenceThumb}
                    />
                    <View style={styles.evidenceInfo}>
                      <View style={styles.evidenceLabelRow}>
                        <Camera size={12} color={P.accent} />
                        <Text style={styles.evidenceLabel}>
                          {tr('Ver foto de evidencia')}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            );
          })}

          {hasMore ? (
            <Pressable
              onPress={loadMore}
              disabled={loadingMore}
              style={({ pressed }) => [
                styles.loadMoreBtn,
                pressed && { opacity: 0.8 },
              ]}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>{tr('Cargar más tareas')}</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 12,
    color: '#334155',
    letterSpacing: 0.5,
  },
  centerContainer: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  errorBox: {
    padding: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FEE2E2',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  retryText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: '#DC2626',
  },
  emptyText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 12,
  },
  list: {
    gap: 10,
  },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#EDF2F7',
    padding: 10,
    gap: 4,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    flexWrap: 'wrap',
  },
  taskTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: '#0F172A',
    flexShrink: 1,
  },
  subtaskTitle: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 12,
    color: '#64748B',
  },
  timeText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 10,
    color: '#94A3B8',
  },
  actorMeta: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  badgeSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  badgeSuccessText: {
    color: '#047857',
  },
  badgeWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  badgeWarningText: {
    color: '#B45309',
  },
  badgePrimary: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FFEDD5',
  },
  badgePrimaryText: {
    color: '#C2410C',
  },
  badgeNeutral: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  badgeNeutralText: {
    color: '#475569',
  },
  badgeText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 10,
  },
  commentBox: {
    borderLeftWidth: 2,
    borderLeftColor: P.accent,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  commentText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11,
    lineHeight: 15,
    color: '#475569',
    fontStyle: 'italic',
  },
  evidenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    padding: 4,
    gap: 8,
    marginTop: 4,
  },
  evidenceThumb: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  evidenceInfo: {
    flex: 1,
  },
  evidenceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  evidenceLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: P.accent,
  },
  loadMoreBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  loadMoreText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: '#475569',
  },
});
