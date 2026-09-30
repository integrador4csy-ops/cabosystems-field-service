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
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { Badge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import { getMyTasks, type TaskWithProject } from '@/lib/api';

const STATUS_META: Record<
  string,
  {
    color: string;
    label: string;
    badgeColor: 'warning' | 'gray' | 'success';
  }
> = {
  pendiente: {
    color: Colors.textSecondary,
    label: 'Por Hacer',
    badgeColor: 'gray',
  },
  en_proceso: {
    color: Colors.primary,
    label: 'En Proceso',
    badgeColor: 'warning',
  },
  completada: {
    color: Colors.success,
    label: 'Completada',
    badgeColor: 'success',
  },
};

const ScheduleTaskCard = React.memo(function ScheduleTaskCard({
  item,
  onPress,
}: {
  item: TaskWithProject;
  onPress: () => void;
}) {
  const meta = STATUS_META[item.estatus] ?? STATUS_META.pendiente;
  const woCode = `WO-${item.id.slice(0, 6).toUpperCase()}`;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.taskCard,
        pressed && styles.taskCardPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.taskCardHeader}>
        <Text style={styles.woCodeText}>{woCode}</Text>
        <Badge color={meta.badgeColor} variant="light" size="sm">
          {meta.label}
        </Badge>
      </View>

      <Text style={styles.taskTitle} numberOfLines={2}>
        {item.titulo}
      </Text>

      {!!item.descripcion && (
        <Text style={styles.taskDescription} numberOfLines={2}>
          {item.descripcion}
        </Text>
      )}

      {item.proyectos && (
        <View style={styles.taskFooter}>
          <View style={styles.locationChip}>
            <MapPin size={12} color={Colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.proyectos.villa || item.proyectos.unidad} · {item.proyectos.desarrollo}
            </Text>
          </View>
          <ChevronRight size={15} color={Colors.textDisabled} />
        </View>
      )}
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
        <Calendar size={15} color={Colors.primary} />
        <Text style={styles.sectionTitle}>AGENDA DE CAMPO</Text>
      </View>
      <Badge color="warning" variant="light" size="sm">
        {`${pendientes.length} pendientes`}
      </Badge>
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
          <Calendar size={32} color={Colors.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>
          {error ? 'No se pudieron cargar los datos' : 'Sin tareas pendientes'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {error
            ? 'Revisa tu conexión de red e intenta de nuevo.'
            : 'Las órdenes pendientes de ejecución para hoy se organizarán aquí.'}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
          onPress={() => load()}
        >
          <RefreshCw size={14} color={Colors.textWhite} />
          <Text style={styles.retryText}>Reintentar</Text>
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
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  taskCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
    ...Shadow.xs,
  },
  taskCardPressed: {
    opacity: 0.9,
    backgroundColor: '#FAFBFD',
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  woCodeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  taskTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
  },
  taskDescription: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11.5,
    color: Colors.textSecondary,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 1.5,
    gap: Spacing.xs,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  emptyTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 16,
    color: Colors.text,
  },
  emptySubtitle: {
    fontFamily: 'Outfit_400Regular',
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
  },
  retryText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.textWhite,
  },
});
