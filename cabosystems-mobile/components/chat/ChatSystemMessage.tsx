import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { CheckCircle2, Play, Clock, RotateCcw, Camera, ExternalLink } from 'lucide-react-native';
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

  const isCompleted =
    meta?.siguiente === 'true' ||
    meta?.siguiente === 'completada' ||
    meta?.estado === 'completada';
  const isInProgress =
    meta?.siguiente === 'en_proceso' || meta?.estado === 'en_proceso';
  const isReopened =
    meta?.action === 'subtarea' && meta?.siguiente === 'false';

  const icon = isCompleted ? (
    <CheckCircle2 size={15} color="#10B981" />
  ) : isInProgress ? (
    <Play size={13} color={P.accent} />
  ) : isReopened ? (
    <RotateCcw size={13} color="#F59E0B" />
  ) : (
    <Clock size={15} color={P.slate} />
  );

  const villaLabel = meta?.villa
    ? `${meta.desarrollo ? `${meta.desarrollo} · ` : ''}${meta.villa}`
    : null;

  const timeFormatted = new Date(message.created_at).toLocaleTimeString(
    language === 'es' ? 'es-MX' : 'en-US',
    { hour: '2-digit', minute: '2-digit' }
  );

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {icon}
            {villaLabel ? (
              <View style={styles.villaBadge}>
                <Text style={styles.villaText} numberOfLines={1}>
                  {villaLabel}
                </Text>
              </View>
            ) : (
              <Text style={styles.categoryText}>{tr('Actividad')}</Text>
            )}
          </View>
          <Text style={styles.timeText}>{timeFormatted}</Text>
        </View>

        {/* Content */}
        <Text style={styles.contentText}>{message.contenido}</Text>

        {/* Optional Comment */}
        {meta?.comentario ? (
          <View style={styles.commentBox}>
            <Text style={styles.commentText}>“{meta.comentario}”</Text>
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
                {meta?.task_title || tr('Evidencia')}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {/* View Task Detail Link */}
        {meta?.task_id ? (
          <Pressable
            onPress={() => router.push(`/task/${meta.task_id}`)}
            style={({ pressed }) => [
              styles.taskLinkButton,
              pressed && { opacity: 0.8 },
            ]}
          >
            <ExternalLink size={12} color={P.accent} />
            <Text style={styles.taskLinkText}>{tr('Ver tarea')}</Text>
          </Pressable>
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
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 12,
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
    gap: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  villaBadge: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    maxWidth: '85%',
  },
  villaText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10,
    color: '#334155',
  },
  categoryText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10,
    color: P.slate,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 10,
    color: P.slate,
  },
  contentText: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: '#0F172A',
  },
  commentBox: {
    borderLeftWidth: 2,
    borderLeftColor: P.accent,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  commentText: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: '#475569',
    fontStyle: 'italic',
  },
  evidenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
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
    color: P.slate,
  },
  taskLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    marginTop: 2,
  },
  taskLinkText: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 11,
    color: P.accent,
  },
});
