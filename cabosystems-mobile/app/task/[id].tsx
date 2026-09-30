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
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { Badge, Card, Button } from '@/components/ui';
import { getTaskById, updateTaskStatus, toggleSubtarea, type TaskDetail } from '@/lib/api';
import type { Subtarea } from '@/types/database';

const STATUS_META: Record<
  string,
  {
    color: string;
    label: string;
    badgeColor: 'gray' | 'primary' | 'success';
    icon: React.ComponentType<{ size: number; color: string }>;
  }
> = {
  pendiente: {
    color: Colors.pending,
    label: 'Pendiente',
    badgeColor: 'gray',
    icon: Clock,
  },
  en_proceso: {
    color: Colors.inProgress,
    label: 'En Proceso',
    badgeColor: 'primary',
    icon: Play,
  },
  completada: {
    color: Colors.completed,
    label: 'Completada',
    badgeColor: 'success',
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
  const completedSubsCount = task.subtareas.filter((s) => s.completada).length;
  const totalSubsCount = task.subtareas.length;

  return (
    <View style={styles.container}>
      {/* Header Minimalista en Modo Claro */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            hitSlop={10}
          >
            <ArrowLeft size={18} color={Colors.text} />
          </Pressable>

          <View style={styles.headerInfo}>
            <Text style={styles.taskId}>{woCode}</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {task.titulo}
            </Text>
          </View>

          <Badge color={meta.badgeColor} variant="light" size="sm">
            {meta.label}
          </Badge>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Ubicación / Villa Bar */}
        <View style={styles.locationBar}>
          <View style={styles.locationIconBox}>
            <MapPin size={16} color={Colors.primary} />
          </View>
          <Text style={styles.address} numberOfLines={1}>
            {villa} · {development}
          </Text>
        </View>

        {/* Tarjeta de Título Principal */}
        <View style={styles.titleCard}>
          <Text style={styles.category}>{development.toUpperCase()}</Text>
          <Text style={styles.title}>{task.titulo}</Text>
        </View>

        {/* Grilla de Telemetría Técnica (Estilo TailAdmin) */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <MapPin size={13} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>VILLA</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
              {villa}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <User size={13} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>ASIGNADO A</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
              {task.profiles?.nombre ?? '—'}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <Calendar size={13} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>FECHA</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
              {formatDate(task.created_at)}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <Clock size={13} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>ESTADO</Text>
            </View>
            <Text style={[styles.infoValue, { color: meta.color }]} numberOfLines={1}>
              {meta.label}
            </Text>
          </View>
        </View>

        {/* Tarjeta: Detalle y Especificaciones */}
        <Card elevated={false} style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <FileText size={16} color={Colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>DETALLE Y ESPECIFICACIONES</Text>
          </View>
          <Text style={styles.scopeText}>
            {task.descripcion || 'Sin especificaciones adicionales registradas.'}
          </Text>
        </Card>

        {/* Tarjeta: Checklist de Actividades */}
        {totalSubsCount > 0 && (
          <Card elevated={false} style={styles.sectionCard}>
            <View style={styles.checklistHeader}>
              <View style={styles.sectionHeaderNoMargin}>
                <View style={styles.sectionIconBox}>
                  <ListChecks size={16} color={Colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>CHECKLIST DE ACTIVIDADES</Text>
              </View>
              <Badge
                color={completedSubsCount === totalSubsCount ? 'success' : 'primary'}
                variant="light"
                size="sm"
              >
                {`${completedSubsCount}/${totalSubsCount}`}
              </Badge>
            </View>

            <View style={styles.checklistContainer}>
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
                    <CheckSquare size={18} color={Colors.success} />
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
          </Card>
        )}
      </ScrollView>

      {/* Footer de Acciones Ergonómico TailAdmin */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <Button
          variant={task.estatus === 'completada' ? 'outline' : 'primary'}
          size="lg"
          loading={saving}
          startIcon={
            <NextIcon
              size={18}
              color={task.estatus === 'completada' ? Colors.text : '#FFFFFF'}
            />
          }
          onPress={handleStatusChange}
        >
          {next.label}
        </Button>
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
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    ...Shadow.xs,
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
    width: 34,
    height: 34,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    flex: 1,
  },
  taskId: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 10,
    color: Colors.primary,
    letterSpacing: 0.8,
  },
  headerTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: Colors.text,
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
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadow.xs,
  },
  locationIconBox: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  address: {
    flex: 1,
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.text,
  },
  titleCard: {
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    ...Shadow.xs,
  },
  category: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.primary,
    letterSpacing: 1,
  },
  title: {
    fontFamily: 'Outfit_700Bold',
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
    backgroundColor: Colors.card,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    ...Shadow.xs,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  infoValue: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13,
    color: Colors.text,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    ...Shadow.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionHeaderNoMargin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  scopeText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
    paddingTop: Spacing.xs,
  },
  checklistContainer: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  subtareaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F2F4F7',
  },
  subtareaRowCompleted: {
    backgroundColor: '#FCFCFD',
    borderColor: '#EAECF0',
  },
  subtareaText: {
    fontFamily: 'Outfit_500Medium',
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
    backgroundColor: Colors.card,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    ...Shadow.sm,
  },
});