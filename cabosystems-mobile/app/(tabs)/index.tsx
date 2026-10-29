import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import {
  MapPin,
  ChevronRight,
  ClipboardList,
  RefreshCw,
  ArrowUp,
  ArrowDown,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { afterTabPaint } from '@/lib/tabPreparation';
import { useTabStartup } from '@/lib/tabStartup';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import DailyFormCard from '@/components/DailyFormCard';
import { TaskFilterSelect } from '@/components/TaskFilterSelect';
import { matchesTaskAssignee, sortTaskTitles } from '@/lib/taskListFilters';
import { useLanguage } from '@/lib/i18n';
import DailyFormModal from '@/components/DailyFormModal';
import DailyFormConfirmModal from '@/components/DailyFormConfirmModal';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { Badge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { getAccessibleTasks, type TaskWithProject } from '@/lib/api';
import {
  getDailyFormStatus,
  markDailyFormCompleted,
  getDailyFormUrl,
  isNativeWebViewAvailable,
  openDailyFormInBrowser,
} from '@/lib/dailyForm';
import type { Project } from '@/types/database';

const STATUS_META: Record<
  string,
  {
    color: string;
    label: string;
  }
> = {
  pendiente: {
    color: 'rgba(52,62,72,0.25)',
    label: 'To do',
  },
  en_proceso: {
    color: Colors.primary,
    label: 'Doing',
  },
  completada: {
    color: '#000000',
    label: 'Done',
  },
};

// Tarjeta de Tarea Minimalista
const TaskCard = React.memo(function TaskCard({
  item,
  onPress,
}: {
  item: TaskWithProject;
  onPress: (id: string) => void;
}) {
  const meta = STATUS_META[item.estatus] ?? STATUS_META.pendiente;
  const woCode = `WO-${item.id.slice(0, 6).toUpperCase()}`;
  const handlePress = useCallback(() => {
    onPress(item.id);
  }, [item.id, onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.taskCard,
        pressed && styles.taskCardPressed,
      ]}
      onPress={handlePress}
    >
      <View style={styles.taskCardHeader}>
        <Text style={styles.woCodeText}>{woCode}</Text>
        <Badge color="gray" variant="light" size="sm" style={{ backgroundColor: '#FFFFFF', borderColor: meta.color }} textStyle={{ color: Colors.brandSlate }}>
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

const keyExtractor = (item: TaskWithProject) => item.id;
const EMPTY_TASKS: TaskWithProject[] = [];
let taskDataCache: { owner: string; items: TaskWithProject[] } = { owner: '', items: [] };

export async function preloadMainTasks(userId: string): Promise<TaskWithProject[]> {
  if (taskDataCache.owner === userId && taskDataCache.items.length) {
    return taskDataCache.items;
  }
  try {
    const tasks = await getAccessibleTasks(userId);
    taskDataCache = { owner: userId, items: tasks };
    return tasks;
  } catch (e) {
    console.warn('Preload main tasks error:', e);
    return [];
  }
}

export default function DashboardScreen() {
  const { markMainReady } = useTabStartup();
  const { language } = useLanguage();
  const en = language === 'en';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { profile } = useAuth();
  const {
    projects,
    selectedProject,
    setSelectedProject,
    refreshProjects,
  } = useProjects();
  const selectedProjectId = selectedProject?.id;
  const requestVersion = useRef(0);
  const lastLoadTimeRef = useRef(taskDataCache.owner === profile?.id ? Date.now() : 0);
  const [taskData, setTaskData] = useState<{ owner: string; items: TaskWithProject[] }>(() =>
    taskDataCache.owner === profile?.id ? taskDataCache : { owner: '', items: [] }
  );
  const tasks = taskData.owner === profile?.id ? taskData.items : EMPTY_TASKS;
  useEffect(() => {
    if (profile?.id && taskData.owner === profile.id) markMainReady();
  }, [profile?.id, taskData.owner, markMainReady]);
  const [loading, setLoading] = useState(() => taskDataCache.owner !== profile?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_proceso' | 'pendiente' | 'completada'>('all');
  const [assignee, setAssignee] = useState('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  useEffect(() => { setAssignee('all'); }, [profile?.id]);
  const assigneeOptions = useMemo(() => {
    const people = new Map<string, string>();
    for (const task of tasks) {
      if (task.asignado_a) people.set(task.asignado_a, task.profiles?.nombre || (task.asignado_a === profile?.id ? profile.nombre : en ? 'Unavailable name' : 'Nombre no disponible'));
    }
    return [
      { value: 'all', label: en ? 'Any assignee' : 'Cualquier responsable' },
      { value: 'unassigned', label: en ? 'Unassigned' : 'Sin responsable' },
      ...[...people].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    ];
  }, [tasks, en, profile?.id, profile?.nombre]);

  // Estado del Formulario Diario de Campo
  const [dailyFormCompleted, setDailyFormCompleted] = useState(false);
  const [dailyFormCompletedAt, setDailyFormCompletedAt] = useState<string | null>(null);
  const [showDailyForm, setShowDailyForm] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [successModalVisible, setSuccessModalVisible] = useState(false);

  const checkDailyForm = useCallback(async () => {
    if (!profile?.id) return;
    const status = await getDailyFormStatus(profile.id);
    setDailyFormCompleted(status.completed);
    setDailyFormCompletedAt(status.completedAt);
  }, [profile?.id]);

  useFocusEffect(
    useCallback(() => {
      return afterTabPaint(() => { void checkDailyForm(); });
    }, [checkDailyForm])
  );

  const handlePressDailyForm = () => {
    if (!profile) return;
    if (isNativeWebViewAvailable()) {
      setShowDailyForm(true);
    } else {
      const formUrl = getDailyFormUrl(profile);
      openDailyFormInBrowser(formUrl);
      setTimeout(() => {
        setConfirmModalVisible(true);
      }, 500);
    }
  };

  const handleDailyFormCompleted = async () => {
    if (!profile?.id) return;
    await markDailyFormCompleted(profile.id);
    setDailyFormCompleted(true);
    setDailyFormCompletedAt(new Date().toISOString());
  };

  const load = useCallback(
    async (isRefresh = false) => {
      if (!profile?.id) return;
      const version = ++requestVersion.current;
      if (isRefresh) {
        setRefreshing(true);
      } else if (taskData.owner !== profile.id) {
        setLoading(true);
      }
      setError(null);
      try {
        const [, tsks] = await Promise.all([
          refreshProjects(),
          getAccessibleTasks(profile.id),
        ]);
        if (version === requestVersion.current) {
          taskDataCache = { owner: profile.id, items: tsks };
          setTaskData(taskDataCache);
          lastLoadTimeRef.current = Date.now();
        }
      } catch (e) {
        console.error('Task load error:', e);
        if (version === requestVersion.current) setError('No se pudieron cargar las tareas');
      } finally {
        markMainReady();
        if (version === requestVersion.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [profile?.id, refreshProjects, taskData.owner, taskData.items.length, markMainReady]
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useFocusEffect(useCallback(() => {
    let cancel = () => {};
    const now = Date.now();
    const isStale =
      taskData.owner !== profile?.id ||
      now - lastLoadTimeRef.current > 25000;

    if (isStale) {
      cancel = afterTabPaint(() => { void load(); });
    }
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        cancel();
        cancel = afterTabPaint(() => { void load(true); });
      }
    });
    return () => { cancel(); requestVersion.current++; listener.remove(); };
  }, [load, taskData.owner, taskData.items.length, profile?.id]));

  useEffect(() => {
    if (!profile?.id) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const channelName = `tareas-dashboard-${profile.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tareas',
        },
        () => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void loadRef.current(true), 250);
        }
      )
      .subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const filteredTasks = useMemo(
    () => tasks.filter(task => task.proyecto_id === selectedProjectId && matchesTaskAssignee(task, assignee)),
    [tasks, selectedProjectId, assignee]
  );

  const stats = useMemo(() => {
    let en_proceso = 0;
    let pendiente = 0;
    let completada = 0;
    for (const t of filteredTasks) {
      if (t.estatus === 'en_proceso') en_proceso++;
      else if (t.estatus === 'pendiente') pendiente++;
      else if (t.estatus === 'completada') completada++;
    }
    return { en_proceso, pendiente, completada };
  }, [filteredTasks]);

  const displayedTasks = useMemo(() => {
    const visible = statusFilter === 'all' ? filteredTasks : filteredTasks.filter((t) => t.estatus === statusFilter);
    return sortTaskTitles(visible, sortDirection, en ? 'en' : 'es');
  }, [filteredTasks, statusFilter, sortDirection, en]);

  const rawNombre = profile?.nombre || 'Técnico';
  const cleanNombre = rawNombre.includes('@') ? rawNombre.split('@')[0] : rawNombre.split(' ')[0];
  const firstName = cleanNombre.charAt(0).toUpperCase() + cleanNombre.slice(1);

  const handleOpenTask = useCallback(
    (taskId: string) => {
      router.push(`/task/${taskId}` as any);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: TaskWithProject }) => (
      <TaskCard item={item} onPress={handleOpenTask} />
    ),
    [handleOpenTask]
  );

  const listContentStyle = useMemo(
    () => [
      styles.listContent,
      { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 110 },
    ],
    [headerHeight, insets.bottom]
  );

  const ListHeader = useMemo(
    () => (
      <View style={styles.headerContainer}>
        {/* Saludo Minimalista */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingTitle}>Hola, {firstName}</Text>
          </View>
        <DailyFormCard
          compact
          completed={dailyFormCompleted}
          completedAt={dailyFormCompletedAt}
          onPress={handlePressDailyForm}
        />
        </View>

        <View style={styles.workFilters}>
          <HeaderCaboSystems selectorOnly projects={projects} selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProject} />
          <TaskFilterSelect label={en ? 'Assignee' : 'Responsable'} value={assignee} options={assigneeOptions} onChange={setAssignee} />
          <Pressable accessibilityRole="button"
            accessibilityLabel={en ? `Order by title: ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : `Ordenar por título: ${sortDirection === 'asc' ? 'ascendente' : 'descendente'}`}
            accessibilityHint={en ? 'Tap to reverse order' : 'Pulsa para invertir el orden'}
            onPress={() => setSortDirection(direction => direction === 'asc' ? 'desc' : 'asc')}
            style={({ pressed }) => [styles.sortButton, pressed && { opacity: 0.6 }]}>
            {sortDirection === 'asc' ? <ArrowUp size={20} color={Colors.primary} /> : <ArrowDown size={20} color={Colors.primary} />}
          </Pressable>
        </View>
        {/* Barra de Filtros Minimalista (Todas visibles en pantalla) */}
        <View style={styles.filterPillsContainer}>
          <Pressable
            style={({ pressed }) => [
              styles.filterPill,
              statusFilter === 'all' && styles.filterPillActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setStatusFilter('all')}
          >
            <Text
              style={[
                styles.filterPillText,
                statusFilter === 'all' && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              All ({filteredTasks.length})
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.filterPill,
              statusFilter === 'pendiente' && styles.filterPillActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setStatusFilter('pendiente')}
          >
            <Text
              style={[
                styles.filterPillText,
                statusFilter === 'pendiente' && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              To do ({stats.pendiente})
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.filterPill,
              statusFilter === 'en_proceso' && styles.filterPillActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setStatusFilter('en_proceso')}
          >
            <Text
              style={[
                styles.filterPillText,
                statusFilter === 'en_proceso' && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Doing ({stats.en_proceso})
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.filterPill,
              statusFilter === 'completada' && styles.filterPillActive,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => setStatusFilter('completada')}
          >
            <Text
              style={[
                styles.filterPillText,
                statusFilter === 'completada' && styles.filterPillTextActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              Done ({stats.completada})
            </Text>
          </Pressable>
        </View>
      </View>
    ),
    [firstName, filteredTasks.length, dailyFormCompleted, dailyFormCompletedAt, statusFilter, stats, handlePressDailyForm, projects, selectedProjectId, setSelectedProject, en, assignee, assigneeOptions, sortDirection]
  );

  const ListEmpty = useCallback(() => {
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
          <ClipboardList size={32} color={Colors.textSecondary} />
        </View>
        <Text style={styles.emptyTitle}>
          {error ? 'Error de Sincronización' : 'Sin órdenes en esta vista'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {error
            ? 'No se pudo conectar con el servidor. Revisa tu conexión.'
            : statusFilter !== 'all'
            ? 'No hay tareas con este estatus en la villa seleccionada.'
            : 'Aquí aparecen las tareas de la villa seleccionada a las que tienes acceso.'}
        </Text>
        {statusFilter !== 'all' ? (
          <Pressable
            style={({ pressed }) => [styles.resetFilterBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setStatusFilter('all')}
          >
            <Text style={styles.resetFilterText}>Ver todas las órdenes</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
            onPress={() => load()}
          >
            <RefreshCw size={14} color={Colors.textWhite} />
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        )}
      </View>
    );
  }, [loading, tasks.length, error, statusFilter, load]);

  return (
    <View style={styles.container}>
      <HeaderCaboSystems
        showProjectSelector={false}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProject}
      />

      <FlashList
        data={displayedTasks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={listContentStyle}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        showsVerticalScrollIndicator={false}
      />

      <DailyFormModal
        visible={showDailyForm}
        url={getDailyFormUrl(profile)}
        onClose={() => setShowDailyForm(false)}
        onComplete={handleDailyFormCompleted}
      />

      {/* Modal de Confirmación */}
      <DailyFormConfirmModal
        visible={confirmModalVisible}
        type="confirm"
        title="¿Confirmar Envío?"
        message="¿Ya completaste y enviaste tus respuestas en el formulario diario de Google?"
        confirmText="SÍ, ENVIADO"
        cancelText="AÚN NO"
        onConfirm={async () => {
          setConfirmModalVisible(false);
          await handleDailyFormCompleted();
          setSuccessModalVisible(true);
        }}
        onCancel={() => setConfirmModalVisible(false)}
      />

      {/* Modal de Éxito */}
      <DailyFormConfirmModal
        visible={successModalVisible}
        type="success"
        title="¡Formulario Registrado!"
        message="Tu reporte diario de campo ha sido registrado exitosamente para el turno de hoy en CaboSystems."
        confirmText="ENTENDIDO"
        onConfirm={() => setSuccessModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  workFilters: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sortButton: { width: 44, height: 44, flexShrink: 0, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
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
  headerContainer: {
    marginBottom: 16,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: Spacing.xs,
  },
  greetingTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 24,
    color: '#000000',
    letterSpacing: -0.3,
  },
  filterPillsContainer: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
    width: '100%',
  },
  filterPill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  filterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11.5,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  filterPillTextActive: {
    fontFamily: 'Outfit_700Bold',
    color: Colors.textWhite,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderCurve: 'continuous',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
    padding: 16,
    gap: 8,
  },
  taskCardPressed: {
    opacity: 0.9,
    backgroundColor: '#FFFFFF',
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  woCodeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: 'rgba(0,0,0,0.55)',
  },
  taskTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 16,
    color: '#000000',
    lineHeight: 22,
  },
  taskDescription: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.brandSlate,
    lineHeight: 19,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
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
    backgroundColor: '#FFFFFF',
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
  resetFilterBtn: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetFilterText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: Colors.primary,
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
