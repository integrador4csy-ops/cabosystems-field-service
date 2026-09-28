import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  RotateCcw,
  MapPin,
  Calendar,
  User,
  FileText,
  ListChecks,
  CheckSquare,
  Square,
  Clock,
} from 'lucide-react-native';
import { Colors, Spacing, BorderRadius } from '@/constants/Theme';
import { getTaskById, updateTaskStatus, toggleSubtarea, type TaskDetail } from '@/lib/api';
import type { Subtarea } from '@/types/database';

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

const NEXT_STATUS: Record<
  string,
  {
    estatus: 'en_proceso' | 'completada';
    label: string;
    icon: React.ComponentType<{ size: number; color: string }>;
  }
> = {
  pendiente: { estatus: 'en_proceso', label: 'Iniciar Tarea', icon: Play },
  en_proceso: { estatus: 'completada', label: 'Marcar Completada', icon: CheckCircle2 },
  completada: { estatus: 'en_proceso', label: 'Reabrir Tarea', icon: RotateCcw },
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('es-MX', {
      timeZone: 'America/Mazatlan',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isStatusBtnHovered, setIsStatusBtnHovered] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getTaskById(id);
      setTask(data);
    } catch (e) {
      console.error('Task load error:', e);
      Alert.alert('Error', 'No se pudo cargar la tarea');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async () => {
    if (!task) return;
    const next = NEXT_STATUS[task.estatus];
    if (!next) return;
    setSaving(true);
    try {
      await updateTaskStatus(task.id, next.estatus);
      setTask({ ...task, estatus: next.estatus });
    } catch (e) {
      console.error('Status update error:', e);
      Alert.alert('Error', 'No se pudo actualizar el estatus');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSubtarea = async (sub: Subtarea) => {
    if (!task) return;
    try {
      await toggleSubtarea(sub.id, !sub.completada);
      setTask({
        ...task,
        subtareas: task.subtareas.map((s) =>
          s.id === sub.id ? { ...s, completada: !s.completada } : s
        ),
      });
    } catch (e) {
      console.error('Subtarea toggle error:', e);
      Alert.alert('Error', 'No se pudo actualizar la subtarea');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No se encontró la tarea</Text>
      </View>
    );
  }

  const meta = STATUS_META[task.estatus] ?? STATUS_META.pendiente;
  const next = NEXT_STATUS[task.estatus] ?? NEXT_STATUS.pendiente;
  const NextIcon = next.icon;
  const development = task.proyectos?.desarrollo ?? '—';
  const villa = task.proyectos?.villa ?? task.proyectos?.unidad ?? '—';
  const woCode = `WO-${task.id.slice(0, 6).toUpperCase()}`;

  return (
    <View style={styles.container}>
      {/* Header Glass CSY */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <BlurView tint="dark" intensity={70} style={StyleSheet.absoluteFill} />
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            hitSlop={10}
          >
            <ArrowLeft size={22} color={Colors.textWhite} />
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.taskId}>{woCode}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {task.titulo}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: meta.bgAlpha }]}>
            <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
            <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ubicación / Villa Tag */}
        <View style={styles.locationBar}>
          <View style={styles.locationIconBox}>
            <MapPin size={16} color={Colors.primary} />
          </View>
          <Text style={styles.address} numberOfLines={1}>
            {villa} · {development}
          </Text>
        </View>

        {/* Sección de Título Principal */}
        <View style={styles.titleCard}>
          <Text style={styles.category}>{development.toUpperCase()}</Text>
          <Text style={styles.title}>{task.titulo}</Text>
        </View>

        {/* Grilla de Telemetría Técnica */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <MapPin size={12} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>VILLA</Text>
            </View>
            <Text style={styles.infoValue}>{villa}</Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <User size={12} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>ASIGNADO A</Text>
            </View>
            <Text style={styles.infoValue}>{task.profiles?.nombre ?? '—'}</Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <Calendar size={12} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>FECHA</Text>
            </View>
            <Text style={styles.infoValue}>{formatDate(task.created_at)}</Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <Clock size={12} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>ESTADO</Text>
            </View>
            <Text style={[styles.infoValue, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>

        {/* Sección de Descripción */}
        <View style={styles.scopeSection}>
          <View style={styles.scopeHeader}>
            <FileText size={16} color={Colors.primary} />
            <Text style={styles.scopeTitle}>DETALLE Y ESPECIFICACIONES</Text>
          </View>
          <Text style={styles.scopeText}>
            {task.descripcion || 'Sin especificaciones adicionales registradas.'}
          </Text>
        </View>

        {/* Sección de Subtareas con interactividad */}
        {task.subtareas.length > 0 && (
          <View style={styles.scopeSection}>
            <View style={styles.scopeHeader}>
              <ListChecks size={16} color={Colors.primary} />
              <Text style={styles.scopeTitle}>
                CHECKLIST DE ACTIVIDADES ({task.subtareas.filter((s) => s.completada).length}/
                {task.subtareas.length})
              </Text>
            </View>
            {task.subtareas.map((sub) => (
              <Pressable
                key={sub.id}
                style={({ pressed }) => [
                  styles.subtareaRow,
                  sub.completada && styles.subtareaRowCompleted,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => handleToggleSubtarea(sub)}
              >
                {sub.completada ? (
                  <CheckSquare size={18} color={Colors.completed} />
                ) : (
                  <Square size={18} color={Colors.textSecondary} />
                )}
                <Text
                  style={[
                    styles.subtareaText,
                    sub.completada && styles.subtareaTextCompleted,
                  ]}
                >
                  {sub.titulo}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Footer de Acciones */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <Pressable
          style={({ pressed }) => [
            styles.statusButton,
            isStatusBtnHovered && styles.statusButtonHovered,
            pressed && { opacity: 0.85 },
            saving && { opacity: 0.6 },
          ]}
          onHoverIn={() => setIsStatusBtnHovered(true)}
          onHoverOut={() => setIsStatusBtnHovered(false)}
          onPress={handleStatusChange}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color={Colors.textWhite} />
          ) : (
            <>
              <NextIcon size={16} color={Colors.textWhite} />
              <Text style={styles.statusButtonText}>{next.label}</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: Spacing.md,
  },
  emptyText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  headerWrapper: {
    overflow: 'hidden',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  headerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    height: 56,
    gap: Spacing.sm,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  taskId: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 15,
    color: Colors.textWhite,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    gap: 4,
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
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    gap: Spacing.md,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
  },
  locationIconBox: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  address: {
    flex: 1,
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  titleCard: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
    gap: 4,
  },
  category: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 1,
  },
  title: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 20,
    color: Colors.text,
    lineHeight: 26,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  infoItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
    gap: 2,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  infoValue: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 13,
    color: Colors.text,
    marginTop: 2,
  },
  scopeSection: {
    backgroundColor: Colors.background,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
    gap: Spacing.sm,
  },
  scopeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(52, 62, 72, 0.08)',
  },
  scopeTitle: {
    fontFamily: 'Montserrat_700Bold',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  scopeText: {
    fontFamily: 'Montserrat_400Regular',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  subtareaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(52, 62, 72, 0.03)',
  },
  subtareaRowCompleted: {
    backgroundColor: 'transparent',
  },
  subtareaText: {
    fontFamily: 'Montserrat_500Medium',
    fontSize: 13,
    color: Colors.text,
    flex: 1,
  },
  subtareaTextCompleted: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  footer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: 'rgba(52, 62, 72, 0.12)',
    gap: Spacing.xs,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  statusButtonHovered: {
    shadowOpacity: 0.45,
    shadowRadius: 10,
    transform: [{ scale: 1.01 }],
  },
  statusButtonText: {
    fontFamily: 'Montserrat_600SemiBold',
    fontSize: 14,
    color: Colors.textWhite,
  },
});