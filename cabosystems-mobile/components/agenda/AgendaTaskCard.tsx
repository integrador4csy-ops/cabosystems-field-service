import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MapPin, ChevronRight, Clock3, Check, Circle, CircleDot } from 'lucide-react-native';
import { AgendaPalette as P } from '@/constants/Theme';
import { isOverdue } from '@/lib/agenda';
import type { AgendaCopy } from '@/lib/agendaCopy';
import type { TaskWithProject } from '@/lib/api';

export const AgendaTaskCard = memo(function AgendaTaskCard({ task, today, copy: c, onOpen }: { task: TaskWithProject; today: string; copy: AgendaCopy; onOpen: (id: string) => void }) {
  const active = task.estatus === 'en_proceso'; const done = task.estatus === 'completada';
  const statusLabel = done ? c.completedTask : active ? c.en_proceso : c.pendingTask;
  const StatusIcon = done ? Check : active ? CircleDot : Circle;
  return <Pressable accessibilityRole="button" accessibilityLabel={`${task.titulo}, ${statusLabel}, ${task.proyectos?.villa || task.proyectos?.unidad || c.noProject}`} onPress={() => onOpen(task.id)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <View style={styles.meta}><Text style={styles.code}>WO-{task.id.slice(0, 6).toUpperCase()}</Text><View style={[styles.status, done && styles.done, active && styles.active]}><StatusIcon size={13} color={done ? P.white : P.ink} /><Text style={[styles.statusText, done && styles.doneText]}>{statusLabel}</Text></View></View>
    <View style={styles.titleRow}><Text style={styles.title}>{task.titulo}</Text><ChevronRight size={18} color={P.slate} /></View>
    {task.descripcion ? <Text style={styles.description} numberOfLines={2}>{task.descripcion}</Text> : null}
    <View style={styles.footer}><MapPin size={14} color={P.slate} /><Text style={styles.project} numberOfLines={2}>{task.proyectos ? [task.proyectos.villa || task.proyectos.unidad, task.proyectos.desarrollo].filter(Boolean).join(' · ') : c.noProject}</Text></View>
    {isOverdue(task, today) ? <View style={styles.overdue}><Clock3 size={13} color={P.slate} /><Text style={styles.overdueText}>{c.overdue}</Text></View> : null}
  </Pressable>;
});
const styles = StyleSheet.create({
  card: { padding: 16, backgroundColor: P.white, borderWidth: 1, borderColor: P.line, borderRadius: 10, marginBottom: 10, gap: 10 }, pressed: { backgroundColor: P.wash }, meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }, code: { fontFamily: 'Outfit_400Regular', fontSize: 11, color: P.muted }, status: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: P.wash }, active: { backgroundColor: P.accent }, done: { backgroundColor: P.ink }, statusText: { fontFamily: 'Outfit_500Medium', fontSize: 11, color: P.ink }, doneText: { color: P.white }, titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, title: { flex: 1, fontFamily: 'Outfit_600SemiBold', color: P.ink, fontSize: 16, lineHeight: 23 }, description: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20, color: P.slate }, footer: { flexDirection: 'row', alignItems: 'center', gap: 6 }, project: { flex: 1, color: P.slate, fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 18 }, overdue: { flexDirection: 'row', gap: 5, alignItems: 'center' }, overdueText: { fontFamily: 'Outfit_500Medium', color: P.slate, fontSize: 12 },
});
