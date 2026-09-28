import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ClipboardCheck, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react-native';
import { Colors, Spacing, BorderRadius, Shadow } from '@/constants/Theme';
import { formatCompletedTime } from '@/lib/dailyForm';

interface DailyFormCardProps {
  completed: boolean;
  completedAt?: string | null;
  onPress: () => void;
  loading?: boolean;
}

export default function DailyFormCard({
  completed,
  completedAt,
  onPress,
  loading = false,
}: DailyFormCardProps) {
  const timeFormatted = formatCompletedTime(completedAt);

  if (completed) {
    return (
      <View style={[styles.card, styles.cardCompleted]}>
        <View style={styles.contentRow}>
          <View style={[styles.iconBox, styles.iconBoxCompleted]}>
            <CheckCircle2 size={22} color={Colors.text} strokeWidth={2.2} />
          </View>

          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text style={styles.titleCompleted}>Formulario Diario Completado</Text>
            </View>
            <Text style={styles.subtitleCompleted}>
              Registrado hoy {timeFormatted ? `· ${timeFormatted}` : ''}
            </Text>
          </View>

          <View style={styles.badgeCompleted}>
            <Text style={styles.badgeTextCompleted}>Completado</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        styles.cardPending,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={styles.contentRow}>
        <View style={[styles.iconBox, styles.iconBoxPending]}>
          <ClipboardCheck size={22} color={Colors.primary} strokeWidth={2.2} />
        </View>

        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.titlePending}>Formulario Diario de Campo</Text>
            <View style={styles.pulseDot} />
          </View>
          <Text style={styles.subtitlePending}>
            Pendiente de registrar para el turno de hoy
          </Text>
        </View>

        <View style={styles.actionRow}>
          <View style={styles.badgePending}>
            <Text style={styles.badgeTextPending}>Llenar</Text>
          </View>
          <ChevronRight size={18} color={Colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: Spacing.md,
  },
  cardPending: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(247, 140, 38, 0.40)',
    ...Shadow.sm,
  },
  cardCompleted: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.10)',
    opacity: 0.92,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxPending: {
    backgroundColor: 'rgba(247, 140, 38, 0.12)',
  },
  iconBoxCompleted: {
    backgroundColor: 'rgba(52, 62, 72, 0.08)',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  titlePending: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 13.5,
    color: Colors.text,
  },
  titleCompleted: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 13.5,
    color: Colors.text,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  subtitlePending: {
    fontFamily: 'Outfit_500Medium',
    fontSize: 11.5,
    color: Colors.primary,
  },
  subtitleCompleted: {
    fontFamily: 'Outfit_400Regular',
    fontSize: 11.5,
    color: Colors.textMuted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgePending: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  badgeTextPending: {
    fontFamily: 'Outfit_700Bold',
    fontSize: 11,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  badgeCompleted: {
    backgroundColor: 'rgba(52, 62, 72, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(52, 62, 72, 0.12)',
  },
  badgeTextCompleted: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 10.5,
    color: Colors.text,
  },
});
