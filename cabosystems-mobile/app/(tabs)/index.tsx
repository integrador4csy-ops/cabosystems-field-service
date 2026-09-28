import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  Play,
  Clock,
  CheckCircle2,
  ChevronRight,
  MapPin,
  RefreshCw,
  ClipboardList,
  SlidersHorizontal,
} from 'lucide-react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { HeaderCaboSystems, useHeaderHeight } from '@/components/HeaderCaboSystems';
import DailyFormCard from '@/components/DailyFormCard';
import DailyFormModal from '@/components/DailyFormModal';
import DailyFormConfirmModal from '@/components/DailyFormConfirmModal';
import { Colors, Spacing, BorderRadius, Glass, Shadow, Animation } from '@/constants/Theme';
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
    weekday: 'long',
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
    shortLabel: string;
    bgAlpha: string;
    icon: React.ComponentType<{ size: number; color: string }>;
  }
> = {
  pendiente: {
    color: Colors.pending,
    label: 'Por Hacer',
    shortLabel: 'Por Hacer',
    bgAlpha: 'rgba(52, 62, 72, 0.1)',
    icon: Clock,
  },
  en_proceso: {
    color: Colors.inProgress,
    label: 'En Proceso',
    shortLabel: 'Activas',
    bgAlpha: 'rgba(247, 140, 38, 0.12)',
    icon: Play,
  },
  completada: {
    color: Colors.completed,
    label: 'Completada',
    shortLabel: 'Listas',
    bgAlpha: 'rgba(0, 0, 0, 0.08)',
    icon: CheckCircle2,
  },
};

// Tarjeta de Tarea con soporte interactivo de Hover y micro-animaciones
const TaskCard = React.memo(function TaskCard({
  item,
  onPress,
}: {
  item: TaskWithProject;
  onPress: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const meta = STATUS_META[item.estatus] ?? STATUS_META.pendiente;
  const StatusIcon = meta.icon;
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
      {/* Barra de acento tecnológico sutil en el borde izquierdo */}
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

        <Text style={[styles.taskTitle, isHovered && styles.taskTitleHovered]} numberOfLines={2}>
          {item.titulo}
        </Text>

        {!!item.descripcion && (
          <Text style={styles.taskDescription} numberOfLines={2}>
            {item.descripcion}
          </Text>
        )}

        <View style={styles.taskFooter}>
          {item.proyectos && (
            <View style={styles.locationChip}>
              <MapPin size={13} color={Colors.primary} />
              <Text style={styles.locationText} numberOfLines={1}>
                {item.proyectos.villa || item.proyectos.unidad} · {item.proyectos.desarrollo}
              </Text>
            </View>
          )}

          <View style={styles.actionPrompt}>
            <StatusIcon size={12} color={meta.color} />
            <Text style={[styles.actionPromptText, { color: meta.color }]}>
              {item.estatus === 'pendiente' ? 'Start' : item.estatus === 'en_proceso' ? 'Continue' : 'Review'}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
});

// Tarjeta de Métrica interactiva con Hover
const StatCard = React.memo(function StatCard({
  value,
  label,
  type,
}: {
  value: number;
  label: string;
  type: 'en_proceso' | 'pendiente' | 'completada';
}) {
  const [isHovered, setIsHovered] = useState(false);
  const meta = STATUS_META[type];
  const IconComponent = meta.icon;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.statCard,
        isHovered && styles.statCardHovered,
        pressed && { opacity: 0.85 },
      ]}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
    >
      <View style={styles.statCardTop}>
        <View style={[styles.statDotHalo, { backgroundColor: meta.bgAlpha }]}>
          <IconComponent size={13} color={meta.color} />
        </View>
        <Text
          style={[styles.statLabel, isHovered && { color: Colors.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {label}
        </Text>
      </View>
      <Text style={[styles.statValue, { color: meta.color }]}>{value}</Text>
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

  useEffect(() => {
    checkDailyForm();
  }, [checkDailyForm]);

  useFocusEffect(
    useCallback(() => {
      checkDailyForm();
    }, [checkDailyForm])
  );

  const handleDailyFormCompleted = useCallback(async () => {
    if (!profile?.id) return;
    const now = await markDailyFormCompleted(profile.id);
    setDailyFormCompleted(true);
    setDailyFormCompletedAt(now);
  }, [profile?.id]);

  const handlePressDailyForm = useCallback(async () => {
    if (dailyFormCompleted) return;
    const url = getDailyFormUrl(profile);
    if (!isNativeWebViewAvailable()) {
      await openDailyFormInBrowser(url);
      setTimeout(() => {
        setConfirmModalVisible(true);
      }, 150);
    } else {
      setShowDailyForm(true);
    }
  }, [dailyFormCompleted, profile]);

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
      console.error('Dashboard load error:', e);
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

  useEffect(() => {
    if (!profile) return;
    const topic = `tareas-realtime-${profile.id}-${Date.now()}`;
    const channel = supabase
      .channel(topic)
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

  const handleSelectProject = useCallback((project: Project) => {
    setSelectedProjectId(project.id);
  }, []);

  const filteredTasks = useMemo(
    () => (selectedProjectId ? tasks.filter((t) => t.proyecto_id === selectedProjectId) : tasks),
    [tasks, selectedProjectId]
  );

  const stats = useMemo(() => ({
    en_proceso: filteredTasks.filter((t) => t.estatus === 'en_proceso').length,
    pendiente: filteredTasks.filter((t) => t.estatus === 'pendiente').length,
    completada: filteredTasks.filter((t) => t.estatus === 'completada').length,
  }), [filteredTasks]);

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
      <>
        {/* Sección de Saludo y Telemetría */}
        <View style={styles.greetingSection}>
          <View style={styles.greetingGroup}>
            <View style={styles.metaBadge}>
              <View style={styles.pulseIndicator} />
              <Text style={styles.dateText}>{getMazatlanDate()}</Text>
            </View>
            <Text style={styles.greetingText}>Hola, {firstName}</Text>
          </View>

          <View style={styles.taskCountBadge}>
            <Text style={styles.taskCountValue}>{filteredTasks.length}</Text>
            <Text style={styles.taskCountLabel}>TAREAS</Text>
          </View>
        </View>

        {/* Tarjeta / Botón de Formulario Diario hasta arriba */}
        <DailyFormCard
          completed={dailyFormCompleted}
          completedAt={dailyFormCompletedAt}
          onPress={handlePressDailyForm}
        />

        {/* Fila de Métricas / Estadísticas Tecnológicas */}
        <View style={styles.statsRow}>
          <StatCard value={stats.en_proceso} label="Activas" type="en_proceso" />
          <StatCard value={stats.pendiente} label="Por Hacer" type="pendiente" />
          <StatCard value={stats.completada} label="Listas" type="completada" />
        </View>

        {/* Encabezado de la lista con filtro activo */}
        <View style={styles.scheduleHeader}>
          <View style={styles.sectionTitleRow}>
            <SlidersHorizontal size={14} color={Colors.primary} />
            <Text style={styles.sectionTitle} numberOfLines={1}>ÓRDENES ASIGNADAS</Text>
          </View>

          {selectedProject && (
            <View style={styles.filterChip}>
              <MapPin size={12} color={Colors.primary} />
              <Text style={styles.filterText} numberOfLines={1}>
                {selectedProject.villa || selectedProject.unidad}
              </Text>
            </View>
          )}
        </View>
      </>
    ),
    [firstName, filteredTasks.length, stats, selectedProject, dailyFormCompleted, dailyFormCompletedAt, handlePressDailyForm]
  );

  const ListEmpty = useCallback(
    () => {
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
            <ClipboardList size={36} color={Colors.textSecondary} />
          </View>
          <Text style={styles.emptyTitle}>
            {error ? 'Error de Sincronización' : 'Sin tareas asignadas'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {error
              ? 'No se pudo conectar con el servidor. Revisa tu conexión de red.'
              : 'Las órdenes de servicio asignadas a tu villa aparecerán aquí.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.retryButton, pressed && { opacity: 0.8 }]}
            onPress={() => load()}
          >
            <RefreshCw size={15} color={Colors.textWhite} />
            <Text style={styles.retryText}>Reintentar</Text>
          </Pressable>
        </View>
      );
    },
    [loading, tasks.length, error, load]
  );

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

      {/* Modal de Confirmación Estilo CaboSystems (Idéntico a Cerrar Sesión) */}
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

      {/* Modal de Éxito Estilo CaboSystems */}
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
  greetingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  greetingGroup: {
    flexShrink: 1,
    gap: 4,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  dateText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  greetingText: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  taskCountBadge: {
    alignItems: 'center',
    backgroundColor: Colors.backgroundAlt,
    borderWidth: 1,
    borderColor: Glass.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    ...Shadow.sm,
  },
  taskCountValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: Colors.primary,
    lineHeight: 24,
  },
  taskCountLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 9,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Glass.border,
    justifyContent: 'space-between',
    minHeight: 82,
    ...Shadow.sm,
  },
  statCardHovered: {
    borderColor: 'rgba(247, 140, 38, 0.35)',
    backgroundColor: Colors.primaryLight,
    ...Shadow.md,
  },
  statCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: '100%',
  },
  statDotHalo: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  statLabel: {
    flex: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  statValue: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 24,
    lineHeight: 28,
    marginTop: Spacing.xs,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 62, 72, 0.08)',
    gap: Spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  sectionTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(247, 140, 38, 0.08)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(247, 140, 38, 0.25)',
    flexShrink: 0,
    maxWidth: 140,
  },
  filterText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    color: Colors.primary,
  },
  taskCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Glass.border,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  taskCardHovered: {
    borderColor: Colors.primary,
    ...Shadow.md,
    backgroundColor: Colors.card,
  },
  taskCardPressed: {
    opacity: 0.9,
    backgroundColor: 'rgba(247, 140, 38, 0.05)',
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
    backgroundColor: Colors.backgroundAlt,
  },
  chevronBoxHovered: {
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
  },
  taskTitle: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 15,
    color: Colors.text,
    lineHeight: 21,
  },
  taskTitleHovered: {
    color: Colors.text,
  },
  taskDescription: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: 2,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: 'rgba(52, 62, 72, 0.06)',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  locationText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  actionPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: Spacing.sm,
  },
  actionPromptText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 11,
    letterSpacing: 0.5,
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