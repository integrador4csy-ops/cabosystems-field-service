import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  MapPin,
  ChevronRight,
  ClipboardList,
  RefreshCw,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import DailyFormCard from '@/components/DailyFormCard';
import DailyFormModal from '@/components/DailyFormModal';
import DailyFormConfirmModal from '@/components/DailyFormConfirmModal';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { Badge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { useProjects } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { getMyTasks, type TaskWithProject } from '@/lib/api';
import {
  getDailyFormStatus,
  markDailyFormCompleted,
  getDailyFormUrl,
  isNativeWebViewAvailable,
  openDailyFormInBrowser,
} from '@/lib/dailyForm';
import type { Project } from '@/types/database';

function getMazatlanDate() {
  const text = new Intl.DateTimeFormat('es-MX', {
    timeZone: 'America/Mazatlan',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date());
  return text.charAt(0).toUpperCase() + text.slice(1);
}

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

// Tarjeta de Tarea Minimalista
const TaskCard = React.memo(function TaskCard({
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

const keyExtractor = (item: TaskWithProject) => item.id;

export default function DashboardScreen() {
  const router = useRouter();
  const headerHeight = useHeaderHeight();
  const { profile } = useAuth();
  const {
    projects,
    selectedProject,
    selectedProjectId,
    setSelectedProject,
    setSelectedProjectId,
    refreshProjects,
  } = useProjects();
  const loadingRef = useRef(false);
  const [tasks, setTasks] = useState<TaskWithProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_proceso' | 'pendiente' | 'completada'>('all');

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
      checkDailyForm();
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
        console.error('Task load error:', e);
        setError('No se pudieron cargar las tareas');
      } finally {
        loadingRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profile?.id, refreshProjects]
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!profile?.id) return;
    const channel = supabase
      .channel('tareas-dashboard')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tareas',
          filter: `asignado_a=eq.${profile.id}`,
        },
        () => {
          load();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);

  const filteredTasks = useMemo(
    () => (selectedProjectId ? tasks.filter((t) => t.proyecto_id === selectedProjectId) : tasks),
    [tasks, selectedProjectId]
  );

  const stats = useMemo(() => ({
    en_proceso: filteredTasks.filter((t) => t.estatus === 'en_proceso').length,
    pendiente: filteredTasks.filter((t) => t.estatus === 'pendiente').length,
    completada: filteredTasks.filter((t) => t.estatus === 'completada').length,
  }), [filteredTasks]);

  const displayedTasks = useMemo(() => {
    if (statusFilter === 'all') return filteredTasks;
    return filteredTasks.filter((t) => t.estatus === statusFilter);
  }, [filteredTasks, statusFilter]);

  const rawNombre = profile?.nombre || 'Técnico';
  const cleanNombre = rawNombre.includes('@') ? rawNombre.split('@')[0] : rawNombre.split(' ')[0];
  const firstName = cleanNombre.charAt(0).toUpperCase() + cleanNombre.slice(1);

  const renderItem = useCallback(
    ({ item }: { item: TaskWithProject }) => (
      <TaskCard item={item} onPress={() => router.push(`/task/${item.id}` as any)} />
    ),
    [router]
  );

  const ListHeader = useMemo(
    () => (
      <View style={styles.headerContainer}>
        {/* Saludo Minimalista */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.greetingTitle}>Hola, {firstName}</Text>
            <Text style={styles.greetingSubtitle}>
              {getMazatlanDate()} · {filteredTasks.length} {filteredTasks.length === 1 ? 'orden asignada' : 'órdenes asignadas'}
            </Text>
          </View>
        </View>

        {/* Tarjeta de Formulario Diario */}
        <DailyFormCard
          completed={dailyFormCompleted}
          completedAt={dailyFormCompletedAt}
          onPress={handlePressDailyForm}
        />

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
    [firstName, filteredTasks.length, dailyFormCompleted, dailyFormCompletedAt, statusFilter, stats, handlePressDailyForm]
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
            : 'Las órdenes asignadas a tu villa aparecerán aquí.'}
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
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProject}
      />

      <FlashList
        data={displayedTasks}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md },
        ]}
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
    marginBottom: Spacing.sm,
  },
  greetingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingTop: Spacing.xs,
  },
  greetingTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 22,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  greetingSubtitle: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12.5,
    color: Colors.textSecondary,
    marginTop: 2,
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
    paddingVertical: 7,
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
    fontFamily: 'Outfit_500Medium',
    fontSize: 11.5,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  filterPillTextActive: {
    fontFamily: 'Outfit_700Bold',
    color: '#FFFFFF',
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