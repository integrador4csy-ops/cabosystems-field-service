import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import {
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
import { TaskFilterSelect } from '@/components/TaskFilterSelect';
import { matchesTaskAssignee, sortTasksByPriority } from '@/lib/taskListFilters';
import { useLanguage } from '@/lib/i18n';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';

import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { getAccessibleTasks, type TaskWithProject } from '@/lib/api';
import type { Project } from '@/types/database';

const STATUS_META: Record<
  string,
  {
    color: string;
    label: string;
  }
> = {
  pendiente: {
    color: Colors.brandSlate,
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

const PRIORITY_META = {
  alta: { es: 'Alta', en: 'High', backgroundColor: Colors.primary, borderColor: Colors.primary, color: Colors.textWhite },
  media: { es: 'Media', en: 'Medium', backgroundColor: Colors.brandSlate, borderColor: Colors.brandSlate, color: Colors.textWhite },
  baja: { es: 'Baja', en: 'Low', backgroundColor: Colors.textWhite, borderColor: Colors.text, color: Colors.text },
} as const;

const TaskRow = React.memo(function TaskRow({ item, onPress, en }: {
  item: TaskWithProject; onPress: (id: string) => void; en: boolean;
}) {
  const { t: tr } = useInterfaceTranslation();
  const meta = STATUS_META[item.estatus] ?? STATUS_META.pendiente;
  const priority = PRIORITY_META[item.prioridad || 'media'];
  const status = en ? meta.label : item.estatus === 'completada' ? tr("Completada") : item.estatus === 'en_proceso' ? tr("En proceso") : tr("Pendiente");
  const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.titulo}, ${en ? priority.en : priority.es}, ${status}`}
    onPress={handlePress} style={({ pressed }) => [styles.taskRow, pressed && styles.taskRowPressed]}>
    <View style={styles.taskBody}>
      <Text style={styles.taskTitle} numberOfLines={2}>{item.titulo}</Text>
      {!!item.descripcion && <Text style={styles.taskDescription} numberOfLines={2}>{item.descripcion}</Text>}
      <View style={styles.taskMeta}>
        <Text style={styles.woCodeText}>{'WO-' + item.id.slice(0, 6).toUpperCase()}</Text>
        <View style={[styles.priorityBadge, { backgroundColor: priority.backgroundColor, borderColor: priority.borderColor }]}><Text style={[styles.priorityText, { color: priority.color }]}>{en ? priority.en : priority.es}</Text></View>
        <View style={styles.taskStatus}><View style={[styles.statusDot, { backgroundColor: meta.color }]} /><Text style={styles.statusText}>{status}</Text></View>
      </View>
    </View>
    <ChevronRight size={18} color={Colors.brandSlate} />
  </Pressable>;
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
  const { t: tr } = useInterfaceTranslation();
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
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'alta' | 'media' | 'baja'>('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  useEffect(() => { setAssignee('all'); }, [profile?.id]);
  const assigneeOptions = useMemo(() => {
    const people = new Map<string, string>();
    for (const task of tasks) {
      if (task.asignado_a && task.asignado_a !== profile?.id) {
        people.set(task.asignado_a, task.profiles?.nombre || (en ? 'Unavailable name' : tr("Nombre no disponible")));
      }
    }
    const options = [
      { value: 'all', label: en ? 'All villa tasks' : tr("Todas las tareas de la villa") },
    ];
    if (profile?.id) {
      options.push({ value: profile.id, label: en ? 'My tasks' : tr("Mis tareas") });
    }
    options.push({ value: 'unassigned', label: en ? 'Unassigned' : tr("Sin responsable") });
    options.push(...[...people].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })));
    return options;
  }, [tasks, en, profile?.id, profile?.nombre, tr]);
  const priorityOptions = useMemo(() => [
    { value: 'all', label: en ? 'All priorities' : 'Todas las prioridades' },
    { value: 'alta', label: en ? 'High priority' : 'Prioridad alta' },
    { value: 'media', label: en ? 'Medium priority' : 'Prioridad media' },
    { value: 'baja', label: en ? 'Low priority' : 'Prioridad baja' },
  ], [en]);


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
        if (version === requestVersion.current) setError(tr("No se pudieron cargar las tareas"));
      } finally {
        markMainReady();
        if (version === requestVersion.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [profile?.id, refreshProjects, taskData.owner, taskData.items.length, markMainReady, tr]
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
    () => tasks.filter(task => task.proyecto_id === selectedProjectId && matchesTaskAssignee(task, assignee) && (priorityFilter === 'all' || task.prioridad === priorityFilter)),
    [tasks, selectedProjectId, assignee, priorityFilter]
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
    return sortTasksByPriority(visible, sortDirection, en ? 'en' : 'es');
  }, [filteredTasks, statusFilter, sortDirection, en]);

  const handleOpenTask = useCallback(
    (taskId: string) => {
      router.push(`/task/${taskId}` as any);
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: TaskWithProject }) => (
      <TaskRow item={item} onPress={handleOpenTask} en={en} />
    ),
    [handleOpenTask, en]
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
        <View style={styles.workFilters}>
          <HeaderCaboSystems selectorOnly projects={projects} selectedProjectId={selectedProjectId}
            onSelectProject={setSelectedProject} />
          <TaskFilterSelect label={en ? 'Priority' : 'Prioridad'} value={priorityFilter} options={priorityOptions} onChange={value => setPriorityFilter(value as typeof priorityFilter)} />
        </View>
        <View style={styles.secondaryFilters}>
          <TaskFilterSelect label={en ? 'Assignee' : tr("Responsable")} value={assignee} options={assigneeOptions} onChange={setAssignee} />
          <Pressable accessibilityRole="button"
            accessibilityLabel={en ? `Priority order, titles ${sortDirection === 'asc' ? 'ascending' : 'descending'}` : `Prioridad primero, títulos en orden ${sortDirection === 'asc' ? 'ascendente' : 'descendente'}`}
            accessibilityHint={en ? 'Tap to reverse title order within each priority' : 'Pulsa para invertir los títulos dentro de cada prioridad'}
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
              {en ? 'All' : tr("Todas")} ({filteredTasks.length})
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
              {en ? 'To do' : tr("Pendientes")} ({stats.pendiente})
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
              {en ? 'Doing' : tr("En proceso")} ({stats.en_proceso})
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
              {en ? 'Done' : tr("Completadas")} ({stats.completada})
            </Text>
          </Pressable>
        </View>
        {selectedProject ? <View style={styles.projectHeading}>
          <Text accessibilityRole="header" style={styles.projectTitle} numberOfLines={1}>
            {selectedProject.villa || selectedProject.unidad || (en ? 'No villa' : tr("Sin villa"))}
            {!!selectedProject.desarrollo && <Text style={styles.projectDevelopment}>{' · ' + selectedProject.desarrollo}</Text>}
          </Text>
          <Text style={styles.projectCount}>{displayedTasks.length} {en ? (displayedTasks.length === 1 ? 'task' : 'tasks') : (displayedTasks.length === 1 ? 'tarea' : 'tareas')}</Text>
        </View> : null}
      </View>
    ),
    [selectedProject, displayedTasks.length, filteredTasks.length, statusFilter, stats, projects, selectedProjectId, setSelectedProject, en, assignee, assigneeOptions, priorityFilter, priorityOptions, sortDirection, tr]
  );

  const ListEmpty = useCallback(() => {
  const { t: tr } = useInterfaceTranslation();
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
          {error ? tr("Error de Sincronización") : tr("Sin órdenes en esta vista")}
        </Text>
        <Text style={styles.emptySubtitle}>
          {error
            ? tr("No se pudo conectar con el servidor. Revisa tu conexión.")
            : statusFilter !== 'all' || priorityFilter !== 'all'
            ? (en ? 'No tasks match these status and priority filters.' : 'No hay tareas con este estado y prioridad en la villa seleccionada.')
            : tr("Aquí aparecen las tareas de la villa seleccionada a las que tienes acceso.")}
        </Text>
        {statusFilter !== 'all' || priorityFilter !== 'all' ? (
          <Pressable
            style={({ pressed }) => [styles.resetFilterBtn, pressed && { opacity: 0.8 }]}
            onPress={() => { setStatusFilter('all'); setPriorityFilter('all'); }}
          >
            <Text style={styles.resetFilterText}>{tr("Ver todas las órdenes")}</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
            onPress={() => load()}
          >
            <RefreshCw size={14} color={Colors.textWhite} />
            <Text style={styles.retryText}>{tr("Reintentar")}</Text>
          </Pressable>
        )}
      </View>
    );
  }, [loading, tasks.length, error, statusFilter, priorityFilter, load, tr, en]);

  return (
    <View style={styles.container}>
      <HeaderCaboSystems
        seamless
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

    </View>
  );
}

const styles = StyleSheet.create({
  workFilters: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  secondaryFilters: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sortButton: { width: 44, height: 44, flexShrink: 0, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  headerContainer: {
    marginBottom: 0,
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
  projectHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 16, paddingBottom: 4 },
  projectTitle: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 21, color: '#000000' },
  projectDevelopment: { fontFamily: 'Outfit_400Regular', color: Colors.brandSlate },
  projectCount: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: Colors.brandSlate },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 20, minHeight: 88 },
  taskRowPressed: { opacity: 0.55 },
  taskBody: { flex: 1, gap: 6 },
  taskTitle: { fontFamily: 'Outfit_600SemiBold', fontSize: 17, lineHeight: 23, color: '#000000' },
  taskDescription: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20, color: Colors.brandSlate },
  taskMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 16, rowGap: 6, marginTop: 4 },
  woCodeText: { fontFamily: 'Outfit_400Regular', fontSize: 12, color: Colors.brandSlate },
  taskStatus: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  priorityBadge: { minHeight: 22, justifyContent: 'center', borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 8 },
  priorityText: { fontFamily: 'Outfit_600SemiBold', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontFamily: 'Outfit_500Medium', fontSize: 12, color: Colors.brandSlate },
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
