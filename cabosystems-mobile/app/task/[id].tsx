import { useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import { getLocale } from '@/lib/localization';
import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
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
import { Colors, Spacing } from '@/constants/Theme';
import { Button } from '@/components/ui';
import { getTaskById, getTaskPermissions, updateTaskStatus, type TaskDetail } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { canUpdateTaskProgress } from '@/lib/taskAccess';
import type { Subtarea } from '@/types/database';
import { randomUUID } from 'expo-crypto';
import { recordTaskProgress } from '@/lib/api';
import { TaskProgressModal } from '@/components/TaskProgressModal';
import { TaskProgressHistory } from '@/components/TaskProgressHistory';

const STATUS_META: Record<
  string,
  {
    color: string;
    label: string;
    icon: React.ComponentType<{ size: number; color: string }>;
  }
> = {
  pendiente: {
    color: Colors.brandSlate,
    label: 'Pendiente',
    icon: Clock,
  },
  en_proceso: {
    color: Colors.primary,
    label: 'En Proceso',
    icon: Play,
  },
  completada: {
    color: '#000000',
    label: 'Completada',
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
    return new Intl.DateTimeFormat(getLocale(), {
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
  const { t: tr } = useInterfaceTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
    const [pendingProgress, setPendingProgress] = useState<{
    requestId: string;
    subtask: Subtarea;
  } | null>(null);
  const request = useRef(0);
  const savingLock = useRef(false);
  const canProgress = canUpdateTaskProgress(task, profile);

  const load = useCallback(async () => {
    if (!id) return;
    const sequence = ++request.current;
    setTask(current => {
      if (current?.id !== id) {
        setLoading(true);
        return null;
      }
      return current;
    });
    try {
      const data = await getTaskById(id);
      const permissions = await getTaskPermissions(id);
      if (sequence === request.current) setTask({ ...data, permissions });
    } catch (e) {
      if (sequence === request.current) {
        if ((e as { code?: string })?.code === 'TASK_UNAVAILABLE') {
          setTask(null);
          Alert.alert(tr('No se encontró la tarea'), tr('La tarea fue eliminada o no tienes acceso para verla.'), [{ text: 'OK', onPress: () => router.back() }]);
          return;
        }
        console.error('Task load error:', e);
        Alert.alert(tr("Error"), tr("No se pudo cargar la tarea"));
      }
    } finally {
      if (sequence === request.current) setLoading(false);
    }
  }, [id, tr]);

  useFocusEffect(useCallback(() => {
    void load();
    return () => { request.current++; };
  }, [load]));

  const handleStatusChange = async () => {
    if (!task || !canProgress || savingLock.current) return;
    const next = NEXT_STATUS[task.estatus];
    if (!next) return;
    savingLock.current = true;
    setSaving(true);
    try {
      await updateTaskStatus(task.id, next.estatus);
      setTask((current) =>
        current?.id === task.id ? { ...current, estatus: next.estatus } : current
      );
    } catch (e) {
      console.error('Status update error:', e);
      Alert.alert(tr('Error'), tr('No se pudo actualizar el estatus'));
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };

  const handleToggleSubtarea = (sub: Subtarea) => {
    if (!task || !canProgress || savingLock.current) return;
    setPendingProgress({ requestId: randomUUID(), subtask: sub });
  };

  const confirmProgress = async (comment: string, photoUri: string | null) => {
    if (!task || !profile || !pendingProgress || savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    try {
      const subtask = pendingProgress.subtask;
      const nextCompleted = !subtask.completada;
      await recordTaskProgress({
        requestId: pendingProgress.requestId,
        taskId: task.id,
        projectId: task.proyecto_id,
        actorId: profile.id,
        subtaskId: subtask.id,
        subtaskCompleted: nextCompleted,
        comment,
        photoUri,
      });
      setTask((current) => {
        if (!current || current.id !== task.id) return current;
        return {
          ...current,
          subtareas: (current.subtareas || []).map((s) =>
            s.id === subtask.id ? { ...s, completada: nextCompleted } : s
          ),
        };
      });
      setPendingProgress(null);
    } catch (e: any) {
      console.error('Progress record error:', e);
      throw e;
    } finally {
      savingLock.current = false;
      setSaving(false);
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
        <Text style={styles.emptyText}>{tr("No se encontró la tarea")}</Text>
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
  const historyVersion = `${task.estatus}:${task.subtareas.map(subtask => `${subtask.id}:${subtask.completada}`).join(',')}`;

  return (
    <View style={styles.container}>
      {/* Header Minimalista en Modo Claro */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <View style={styles.headerContent}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
            accessibilityRole="button" accessibilityLabel={tr("Volver a tareas")}
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

        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Tarjeta de Título Principal */}
        <View style={styles.titleCard}>
          <Text style={styles.category}>{villa}{' · ' + development}</Text>
          <Text style={styles.title}>{task.titulo}</Text>
        </View>

        {/* Grilla de Telemetría Técnica (Estilo TailAdmin) */}
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <MapPin size={13} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>{tr("Villa")}</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
              {villa}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <User size={13} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>{tr("Responsable")}</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
              {task.profiles?.nombre ?? '—'}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <Calendar size={13} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>{tr("Fecha")}</Text>
            </View>
            <Text style={styles.infoValue} numberOfLines={1}>
              {formatDate(task.created_at)}
            </Text>
          </View>

          <View style={styles.infoItem}>
            <View style={styles.infoLabelRow}>
              <Clock size={13} color={Colors.textSecondary} />
              <Text style={styles.infoLabel}>{tr("Estado")}</Text>
            </View>
            <Text style={[styles.infoValue, { color: meta.color }]} numberOfLines={1}>
              {tr(meta.label)}
            </Text>
          </View>
        </View>

        {/* Tarjeta: Detalle y Especificaciones */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBox}>
              <FileText size={16} color={Colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>{tr("Detalle y especificaciones")}</Text>
          </View>
          <Text style={styles.scopeText}>
            {task.descripcion || tr("Sin especificaciones adicionales registradas.")}
          </Text>
        </View>

        {/* Tarjeta: Checklist de Actividades */}
        {totalSubsCount > 0 && (
          <View style={styles.sectionCard}>
            <View style={styles.checklistHeader}>
              <View style={styles.sectionHeaderNoMargin}>
                <View style={styles.sectionIconBox}>
                  <ListChecks size={16} color={Colors.primary} />
                </View>
                <Text style={styles.sectionTitle}>{tr("Actividades")}</Text>
              </View>
              <Text style={styles.progressCount}>{completedSubsCount}/{totalSubsCount}</Text>
            </View>

            <View style={styles.checklistContainer}>
              {task.subtareas.map((sub) => (
                <Pressable
                  key={sub.id}
                  style={({ pressed }) => [
                    styles.subtareaRow,

                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => handleToggleSubtarea(sub)}
                  disabled={!canProgress || saving}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: sub.completada, disabled: !canProgress || saving }}
                >
                  {sub.completada ? (
                    <CheckSquare size={18} color="#000000" />
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
          </View>
        )}
        <TaskProgressHistory taskId={task.id} version={historyVersion} />
      </ScrollView>

      {/* Footer de Acciones Ergonómico TailAdmin */}
      {canProgress ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
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
          {tr(next.label)}
        </Button>
      </View> : <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}><Text style={styles.emptyText}>{tr("Solo consulta. El responsable o un administrador puede actualizar esta tarea.")}</Text></View>}
      {pendingProgress ? (
        <TaskProgressModal
          visible
          title={task.titulo}
          actionLabel={
            pendingProgress.subtask.completada
              ? tr('Reabrir subtarea: {value0}', { value0: pendingProgress.subtask.titulo })
              : tr('Completar subtarea: {value0}', { value0: pendingProgress.subtask.titulo })
          }
          onClose={() => {
            if (!saving) setPendingProgress(null);
          }}
          onConfirm={confirmProgress}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#FFFFFF',
  },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', gap: Spacing.md,
  },
  emptyText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  headerWrapper: {
    backgroundColor: '#FFFFFF',
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
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
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
  titleCard: {
    gap: 8, paddingTop: 8, paddingBottom: 8,
  },
  category: {
    fontFamily: 'Outfit_500Medium', fontSize: 14, lineHeight: 20, color: Colors.brandSlate,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold', fontSize: 24, lineHeight: 31, color: '#000000',
  },
  infoGrid: {
    flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 20, paddingVertical: 8,
  },
  infoItem: {
    flex: 1, minWidth: '45%', gap: 4,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoLabel: {
    fontFamily: 'Outfit_400Regular', fontSize: 12, color: Colors.brandSlate,
  },
  infoValue: {
    fontFamily: 'Outfit_500Medium', fontSize: 14, lineHeight: 20, color: '#000000', marginTop: 2,
  },
  sectionCard: {
    gap: 12, paddingVertical: 12,
  },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  sectionHeaderNoMargin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  sectionIconBox: {
    width: 24, height: 24, justifyContent: 'center', alignItems: 'center',
  },
  checklistHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
  },
  sectionTitle: {
    flexShrink: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 15, lineHeight: 21, color: '#000000',
  },
  scopeText: {
    fontFamily: 'Outfit_400Regular', fontSize: 14, color: Colors.brandSlate, lineHeight: 22,
  },
  checklistContainer: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  subtareaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 12,
  },
  progressCount: { fontFamily: 'Outfit_400Regular', fontSize: 13, color: Colors.brandSlate },
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
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, backgroundColor: '#FFFFFF', maxWidth: 960, width: '100%', alignSelf: 'center',
  },
});
