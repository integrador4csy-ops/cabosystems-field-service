import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  Calendar,
  Clock,
  Play,
  CheckCircle2,
  ChevronRight,
  MapPin,
  RefreshCw,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { getMyTasks, type TaskWithProject } from '@/lib/api';
import type { Project } from '@/types/database';

const STATUS_META: Record<
  string,
  {
    color: string;
    label: string;
    bgAlpha: string;
    icon: React.ComponentType<{ size: number; color: string }>;
  }
> = {
  pendiente: {
    color: Colors.pending,
    label: 'Pendiente',
    bgAlpha: 'rgba(52, 62, 72, 0.1)',
    icon: Clock,
  },
  en_proceso: {
    color: Colors.inProgress,
    label: 'En Proceso',
    bgAlpha: 'rgba(247, 140, 38, 0.12)',
    icon: Play,
  },
  completada: {
    color: Colors.completed,
    label: 'Completada',
    bgAlpha: 'rgba(0, 0, 0, 0.08)',
    icon: CheckCircle2,
  },
};

const ScheduleTaskCard = React.memo(function ScheduleTaskCard({
  item,
  onPress,
}: {
  item: TaskWithProject;
  onPress: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const meta = STATUS_META[item.estatus] ?? STATUS_META.pendiente;
  const woCode = `WO-${item.id.slice(0, 6).toUpperCase()}`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.taskCard,
        isHovered && styles.taskCardHovered,
        pressed && styles.taskCardPressed,
      ]}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
      onPress={onPress}
    >
      <View
        style={[
          styles.taskCardAccentLine,
          { backgroundColor: isHovered ? Colors.primary : meta.color },
        ]}
      />

      <View style={styles.taskCardInner}>
        <View style={styles.taskCardHeader}>
          <View style={styles.headerLeftGroup}>
            <Text style={styles.woCodeText}>{woCode}</Text>
            <View style={[styles.statusBadge, { backgroundColor: meta.bgAlpha }]}>
              <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
              <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>

          <View style={[styles.chevronBox, isHovered && styles.chevronBoxHovered]}>
            <ChevronRight
              size={18}
              color={isHovered ? Colors.primary : Colors.textSecondary}
            />
          </View>
        </View>

        <Text style={styles.taskTitle} numberOfLines={2}>
          {item.titulo}
        </Text>

        {item.proyectos && (
          <View style={styles.locationChip}>
            <MapPin size={13} color={Colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.proyectos.villa || item.proyectos.unidad} · {item.proyectos.desarrollo}
            </Text>
          </View>
        )}

        {!!item.descripcion && (
          <Text style={styles.taskDescription} numberOfLines={2}>
            {item.descripcion}
          </Text>
        )}
      </View>
    </Pressable>
  );
});

const scheduleKeyExtractor = (item: TaskWithProject) => item.id;

export default function ScheduleScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { profile } = useAuth();
  const {
    projects,
    selectedProjectId,
    setSelectedProject,
    refreshProjects,
  } = useProjects();
  const loadingRef = useRef(false);
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!profile?.id) return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [, tsks] = await Promise.all([
        refreshProjects(),
        getMyTasks(profile.id),
      ]);
      setTasks(tsks);
    } catch (e) {
      console.error('Schedule load error:', e);
      setError('No se pudieron cargar los datos');
    } finally {
      loadingRef.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, [profile?.id, refreshProjects]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTasks = useMemo(
    () => (selectedProjectId ? tasks.filter((t) => t.proyecto_id === selectedProjectId) : tasks),
    [tasks, selectedProjectId]
  );

  const pendientes = useMemo(
    () => filteredTasks.filter((t) => t.estatus === 'pendiente'),
    [filteredTasks]
  );

  const renderItem = useCallback(
    ({ item }: { item: TaskWithProject }) => (
      <ScheduleTaskCard
        item={item}
        onPress={() => router.push(`/task/${item.id}` as any)}
      />
    ),
    [router]
  );

  const listHeader = (
    <View style={styles.scheduleHeader}>
      <View style={styles.headerLeft}>
        <Calendar size={16} color={Colors.primary} />
        <Text style={styles.sectionTitle}>AGENDA OPERATIVA</Text>
      </View>
      <View style={styles.countBadge}>
        <Text style={styles.countValue}>{pendientes.length}</Text>
        <Text style={styles.countLabel}>PENDIENTES</Text>
      </View>
    </View>
  );

  const listEmpty = () => {
    if (loading && tasks.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <Calendar size={36} color={Colors.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>
          {error ? 'No se pudieron cargar los datos' : 'Sin pendientes en la agenda'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {error
            ? 'Revisa tu conexión e intenta de nuevo.'
            : 'Las tareas asignadas para ejecución hoy aparecerán organizadas aquí.'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
          onPress={() => load()}
        >
          <RefreshCw size={15} color={Colors.textWhite} />
          <Text style={styles.retryText}>Reintentar carga</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <HeaderCaboSystems
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProject}
      />
      <FlashList
        data={filteredTasks}
        renderItem={renderItem}
        keyExtractor={scheduleKeyExtractor}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md },
        ]}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 62, 72, 0.08)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.15)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
    borderRadius: BorderRadius.md,
  },
  countValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: Colors.primary,
  },
  countLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  taskCard: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
    flexDirection: 'row',
    overflow: 'hidden',
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  taskCardHovered: {
    borderColor: Colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  taskCardPressed: {
    opacity: 0.9,
    backgroundColor: 'rgba(52, 62, 72, 0.02)',
  },
  taskCardAccentLine: {
    width: 4,
  },
  taskCardInner: {
    flex: 1,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  woCodeText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.3,
  },
  chevronBox: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(52, 62, 72, 0.04)',
  },
  chevronBoxHovered: {
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
  },
  taskTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: 2,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  taskDescription: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 1.5,
    gap: Spacing.sm,
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(52, 62, 72, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  emptySubtitle: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    lineHeight: 19,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    gap: Spacing.xs,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  retryText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.textWhite,
  },
});
