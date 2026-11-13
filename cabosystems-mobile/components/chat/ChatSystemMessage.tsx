import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import {
  CheckCircle2,
  Play,
  Clock,
  RotateCcw,
  Camera,
  ExternalLink,
  User,
  MapPin,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { ChatPalette as P } from '@/constants/Theme';
import { useTranslation, useTranslation as useInterfaceTranslation } from '@/lib/i18n';
import type { ChatMessage } from '@/types/database';

export function ChatSystemMessage({
  message,
  onImage,
}: {
  message: ChatMessage;
  onImage?: (url: string) => void;
}) {
  const router = useRouter();
  const { t: tr } = useInterfaceTranslation();
  const { language } = useTranslation();
  const meta = message.media_meta;
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);

  useEffect(() => {
    const evidencePath =
      meta?.evidencia_path ||
      (message.media_url?.includes('/') ? message.media_url : null);
    if (!evidencePath) return;

    let isMounted = true;
    supabase.storage
      .from('task-evidence')
      .createSignedUrl(evidencePath, 3600)
      .then(({ data }) => {
        if (isMounted && data?.signedUrl) {
          setEvidenceUrl(data.signedUrl);
        }
      })
      .catch((err) => {
        console.error('Error fetching signed evidence url in mobile:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [meta?.evidencia_path, message.media_url]);

  // Extract task and subtask titles from meta, with fallback to parsing content
  let taskTitle = meta?.task_title;
  let subtaskTitle = meta?.subtask_title;
  let actorName = message.profiles?.nombre
    ? `${message.profiles.nombre} ${message.profiles.apellidos || ''}`.trim()
    : null;

  if (!taskTitle && message.contenido) {
    const subtaskMatch = message.contenido.match(/«([^»]+)»\s+en\s+«([^»]+)»/);
    if (subtaskMatch) {
      subtaskTitle = subtaskMatch[1];
      taskTitle = subtaskMatch[2];
    } else {
      const taskMatch = message.contenido.match(/cambió\s+«([^»]+)»/);
      if (taskMatch) {
        taskTitle = taskMatch[1];
      }
    }
  }

  if (!actorName && message.contenido) {
    const parts = message.contenido.split(/\s+(?:completó|reabrió|cambió|inició)\s+/);
    if (parts.length > 1) {
      actorName = parts[0].trim();
    }
  }

  // Strip accidental enclosing quotes
  taskTitle = taskTitle ? taskTitle.replace(/^[«"']+|[»"']+$/g, '').trim() : '';
  subtaskTitle = subtaskTitle ? subtaskTitle.replace(/^[«"']+|[»"']+$/g, '').trim() : '';

  // Non-task generic system message fallback
  if (!taskTitle && !subtaskTitle && !meta?.task_id) {
    return (
      <View style={styles.container}>
        <View style={styles.genericBadge}>
          <Text style={styles.genericText}>{message.contenido}</Text>
        </View>
      </View>
    );
  }

  // Action status resolution
  const isSubtask = meta?.action === 'subtarea' || Boolean(subtaskTitle);
  const isSubtaskReopened =
    isSubtask &&
    (meta?.siguiente === 'false' || Boolean(message.contenido?.includes('reabrió')));
  const isSubtaskCompleted = isSubtask && !isSubtaskReopened;

  const isTaskCompleted =
    !isSubtask &&
    (meta?.siguiente === 'completada' ||
      meta?.estado === 'completada' ||
      meta?.siguiente === 'true' ||
      Boolean(message.contenido?.includes('Completada')));

  const isTaskInProgress =
    !isSubtask &&
    (meta?.siguiente === 'en_proceso' ||
      meta?.estado === 'en_proceso' ||
      Boolean(message.contenido?.includes('En Proceso')) ||
      Boolean(message.contenido?.includes('en proceso')));

  let statusConfig = {
    label: tr('Pendiente'),
    icon: <Clock size={12} color="#64748B" />,
    badgeBg: '#F1F5F9',
    badgeBorder: '#E2E8F0',
    badgeColor: '#475569',
    accentColor: '#94A3B8',
  };

  if (isSubtaskReopened) {
    statusConfig = {
      label: tr('Subtarea reabierta'),
      icon: <RotateCcw size={11} color="#B45309" />,
      badgeBg: '#FEF3C7',
      badgeBorder: '#FDE68A',
      badgeColor: '#B45309',
      accentColor: '#F59E0B',
    };
  } else if (isSubtaskCompleted) {
    statusConfig = {
      label: tr('Subtarea completada'),
      icon: <CheckCircle2 size={12} color="#047857" />,
      badgeBg: '#ECFDF5',
      badgeBorder: '#A7F3D0',
      badgeColor: '#047857',
      accentColor: '#10B981',
    };
  } else if (isTaskCompleted) {
    statusConfig = {
      label: tr('Completada'),
      icon: <CheckCircle2 size={12} color="#047857" />,
      badgeBg: '#ECFDF5',
      badgeBorder: '#A7F3D0',
      badgeColor: '#047857',
      accentColor: '#10B981',
    };
  } else if (isTaskInProgress) {
    statusConfig = {
      label: tr('En Proceso'),
      icon: <Play size={10} color="#C2410C" fill="#C2410C" />,
      badgeBg: '#FFF7ED',
      badgeBorder: '#FED7AA',
      badgeColor: '#C2410C',
      accentColor: '#F97316',
    };
  }

  const villaLabel = meta?.villa
    ? `${meta.desarrollo ? `${meta.desarrollo} · ` : ''}${meta.villa}`
    : null;

  const timeFormatted = new Date(message.created_at).toLocaleTimeString(
    language === 'es' ? 'es-MX' : 'en-US',
    { hour: '2-digit', minute: '2-digit' }
  );

  const cleanComment = meta?.comentario
    ? meta.comentario.replace(/^[“"']+|[”"']+$/g, '').trim()
    : null;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.card,
          { borderLeftColor: statusConfig.accentColor, borderLeftWidth: 3.5 },
        ]}
      >
        {/* Header: Action Status Badge & Timestamp */}
        <View style={styles.header}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: statusConfig.badgeBg,
                borderColor: statusConfig.badgeBorder,
              },
            ]}
          >
            {statusConfig.icon}
            <Text
              style={[
                styles.statusBadgeText,
                { color: statusConfig.badgeColor },
              ]}
            >
              {statusConfig.label}
            </Text>
          </View>
          <Text style={styles.timeText}>{timeFormatted}</Text>
        </View>

        {/* Task / Stage info */}
        <View style={styles.contentBlock}>
          {taskTitle ? (
            <Text style={styles.taskTitle} numberOfLines={2}>
              {taskTitle}
            </Text>
          ) : !subtaskTitle ? (
            <Text style={styles.taskTitle} numberOfLines={3}>
              {message.contenido}
            </Text>
          ) : null}

          {subtaskTitle ? (
            <View style={styles.subtaskRow}>
              <Text style={styles.subtaskArrow}>↳</Text>
              <Text style={styles.subtaskTitle} numberOfLines={2}>
                {subtaskTitle}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Metadata row: User & Villa */}
        {actorName || villaLabel ? (
          <View style={styles.metaRow}>
            {actorName ? (
              <View style={styles.actorItem}>
                <User size={11} color="#64748B" />
                <Text style={styles.actorText} numberOfLines={1}>
                  {actorName}
                </Text>
              </View>
            ) : null}

            {actorName && villaLabel ? (
              <Text style={styles.metaDot}>·</Text>
            ) : null}

            {villaLabel ? (
              <View style={styles.villaBadge}>
                <MapPin size={10} color="#EA580C" />
                <Text style={styles.villaText} numberOfLines={1}>
                  {villaLabel}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Optional Comment */}
        {cleanComment ? (
          <View style={styles.commentBox}>
            <Text style={styles.commentText}>{cleanComment}</Text>
          </View>
        ) : null}

        {/* Optional Evidence Photo */}
        {evidenceUrl ? (
          <Pressable
            onPress={() => onImage?.(evidenceUrl)}
            style={({ pressed }) => [
              styles.evidenceButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Image source={{ uri: evidenceUrl }} style={styles.evidenceImage} />
            <View style={styles.evidenceInfo}>
              <View style={styles.evidenceLabelRow}>
                <Camera size={13} color={P.accent} />
                <Text style={styles.evidenceLabel}>
                  {tr('Ver foto de evidencia')}
                </Text>
              </View>
              <Text style={styles.evidenceSubtext} numberOfLines={1}>
                {subtaskTitle || taskTitle || tr('Evidencia')}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* View Task Detail Link */}
        {meta?.task_id ? (
          <View style={styles.footerRow}>
            <Pressable
              onPress={() => router.push(`/task/${meta.task_id}`)}
              style={({ pressed }) => [
                styles.taskLinkButton,
                pressed && { opacity: 0.75, backgroundColor: '#FED7AA' },
              ]}
            >
              <Text style={styles.taskLinkText}>{tr('Ver tarea')}</Text>
              <ExternalLink size={11} color={P.accent} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 6,
    paddingHorizontal: 12,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingTop: 11,
    paddingBottom: 11,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 7.5,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10.5,
    letterSpacing: 0.2,
  },
  timeText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 10.5,
    color: '#94A3B8',
  },
  contentBlock: {
    gap: 2.5,
  },
  taskTitle: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    lineHeight: 19,
    color: '#0F172A',
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 4,
    marginTop: 1,
  },
  subtaskArrow: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    lineHeight: 17,
    color: P.accent,
  },
  subtaskTitle: {
    flex: 1,
    fontFamily: 'Outfit_500Medium',
    fontSize: 12.5,
    lineHeight: 17,
    color: '#334155',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 1,
  },
  actorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
  },
  actorText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11,
    color: '#64748B',
  },
  metaDot: {
    fontSize: 11,
    color: '#CBD5E1',
  },
  villaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  villaText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10,
    color: '#475569',
  },
  commentBox: {
    borderLeftWidth: 2.5,
    borderLeftColor: P.accent,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  commentText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 17,
    color: '#334155',
    fontStyle: 'italic',
  },
  evidenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 6,
    gap: 8,
  },
  evidenceImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  evidenceInfo: {
    flex: 1,
    gap: 2,
  },
  evidenceLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  evidenceLabel: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 12,
    color: P.accent,
  },
  evidenceSubtext: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 10,
    color: '#64748B',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    marginTop: 2,
  },
  taskLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3.5,
    paddingHorizontal: 8,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FFEDD5',
    borderRadius: 6,
  },
  taskLinkText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: P.accent,
  },
  genericBadge: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    maxWidth: '90%',
  },
  genericText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
  },
});
